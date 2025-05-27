const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const { ExpressPeerServer } = require('peer');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Create PeerJS server with proper configuration
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/',
  port: 5002,
  proxied: true,
  allow_discovery: true,
  ssl: false,
  key: 'peerjs',
  ip_limit: 5000,
  concurrent_limit: 5000
});

// Use PeerJS server
app.use('/', peerServer);

// Configure CORS for both Express and Socket.IO
const corsOptions = {
  origin: ["http://localhost:3000", "http://localhost:3001"],
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

const io = socketIo(server, {
  cors: corsOptions,
  path: '/socket.io'
});

// Middleware
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/p2p-sharing')
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Connection Error:', err));

// Store active peers and their shared files
const activePeers = new Map();
const sharedFiles = new Map();

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle peer discovery
  socket.on('register-peer', (peerData) => {
    const { peerId, files } = peerData;
    console.log('Peer registered:', peerId);
    socket.peerId = peerId;
    activePeers.set(peerId, socket.id);
    
    // Store shared files
    if (files && files.length > 0) {
      sharedFiles.set(peerId, files);
    }

    // Send list of active peers to the new peer
    socket.emit('peer-list', Array.from(activePeers.keys()));
    
    // Notify other peers about the new peer
    socket.broadcast.emit('peer-joined', {
      peerId,
      files: files || []
    });
  });

  // Handle signaling for WebRTC
  socket.on('signal', (data) => {
    console.log('Received signal from:', socket.peerId, 'to:', data.target);
    const targetSocketId = activePeers.get(data.target);
    if (targetSocketId) {
      io.to(targetSocketId).emit('signal', {
        sender: socket.peerId,
        signal: data.signal
      });
    } else {
      console.log('Target peer not found:', data.target);
      socket.emit('error', {
        type: 'peer-unavailable',
        message: 'Target peer is not available'
      });
    }
  });

  // Handle file metadata sharing
  socket.on('share-file', (fileData) => {
    console.log('File shared:', fileData);
    const peerFiles = sharedFiles.get(socket.peerId) || [];
    
    // Check if file already exists
    const fileExists = peerFiles.some(file => file.id === fileData.id);
    if (!fileExists) {
      peerFiles.push(fileData);
      sharedFiles.set(socket.peerId, peerFiles);
      
      // Broadcast to all connected peers
      socket.broadcast.emit('new-file', {
        peerId: socket.peerId,
        fileData: fileData
      });
    }
  });

  // Handle file search
  socket.on('search-files', (query) => {
    console.log('Search query:', query);
    const results = [];
    sharedFiles.forEach((files, peerId) => {
      const matchingFiles = files.filter(file => 
        file.name.toLowerCase().includes(query.toLowerCase())
      );
      if (matchingFiles.length > 0) {
        results.push({
          peerId,
          files: matchingFiles
        });
      }
    });
    socket.emit('search-results', results);
  });

  // Handle peer disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (socket.peerId) {
      // Remove peer's files from shared files
      sharedFiles.delete(socket.peerId);
      activePeers.delete(socket.peerId);
      
      // Notify other peers
      socket.broadcast.emit('peer-left', socket.peerId);
    }
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
    socket.emit('error', {
      type: 'server-error',
      message: 'An error occurred on the server'
    });
  });
});

// Basic route
app.get('/', (req, res) => {
  res.send('P2P File Sharing Server is running');
});

const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 