# P2P File Sharing Application

A decentralized peer-to-peer file sharing application built with the MERN stack, PeerJS, and Socket.IO.

## Features

- Real-time peer discovery and connection
- Direct peer-to-peer file transfer
- Chunked file transfer for large files
- Progress tracking for uploads and downloads
- Modern Material-UI interface

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd p2p-project
```

2. Install backend dependencies:
```bash
npm install
```

3. Install frontend dependencies:
```bash
cd client
npm install
```

4. Create a `.env` file in the root directory:
```
MONGODB_URI=mongodb://localhost:27017/p2p-sharing
PORT=5000
```

## Running the Application

1. Start the backend server:
```bash
npm run dev
```

2. In a new terminal, start the frontend:
```bash
cd client
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

## How It Works

1. When you open the application, it generates a unique peer ID
2. Other peers can connect to you using your peer ID
3. To share a file:
   - Click "Select File" to choose a file
   - Click "Share File" to start the transfer
   - The file will be split into chunks and sent to all connected peers
4. Connected peers will see the file transfer progress and can download the file

## Technical Details

- Uses WebRTC (via PeerJS) for direct peer-to-peer connections
- Socket.IO for signaling and peer discovery
- Chunked file transfer for efficient large file sharing
- MongoDB for storing file metadata and peer information

## Security Considerations

- All peer-to-peer connections are encrypted using WebRTC's built-in encryption
- File transfers happen directly between peers, not through a central server
- The server only handles signaling and peer discovery

## Contributing

Feel free to submit issues and enhancement requests! 