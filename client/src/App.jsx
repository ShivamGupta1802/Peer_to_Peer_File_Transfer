import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button, Form, ListGroup, InputGroup } from 'react-bootstrap';
import Peer from 'peerjs';
import io from 'socket.io-client';
import 'bootstrap/dist/css/bootstrap.min.css';

const SERVER_URL = 'http://localhost:5002';

function App() {
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState('');
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [connectPeerId, setConnectPeerId] = useState('');
  
  const socketRef = useRef();
  const connectionsRef = useRef({});
  const peerRef = useRef(null);

  useEffect(() => {
    // Initialize PeerJS with a specific ID
    const newPeer = new Peer(undefined, {
      host: 'localhost',
      port: 5002,
      path: '/',
      debug: 3,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      },
      proxied: true,
      secure: false,
      key: 'peerjs'
    });

    newPeer.on('open', (id) => {
      console.log('My peer ID is:', id);
      setPeerId(id);
      socketRef.current.emit('register-peer', { peerId: id, files: [] });
    });

    newPeer.on('connection', (conn) => {
      console.log('Received connection from:', conn.peer);
      
      conn.on('open', () => {
        console.log('Connection opened with:', conn.peer);
        setConnectedPeers(prev => {
          if (!prev.includes(conn.peer)) {
            return [...prev, conn.peer];
          }
          return prev;
        });
        connectionsRef.current[conn.peer] = conn;
      });

      conn.on('data', (data) => {
        console.log('Received data from peer:', data);
        
        if (data.type === 'file-metadata') {
          // Handle incoming file metadata
          setSharedFiles(prev => {
            if (!prev.some(f => f.id === data.fileData.id)) {
              return [...prev, data.fileData];
            }
            return prev;
          });
        } else if (data.type === 'request-file') {
          // Handle file request
          if (selectedFile && selectedFile.name === data.fileName) {
            const chunkSize = 16384; // 16KB chunks
            const totalChunks = Math.ceil(selectedFile.size / chunkSize);
            let currentChunk = 0;

            const sendChunk = () => {
              const start = currentChunk * chunkSize;
              const end = Math.min(start + chunkSize, selectedFile.size);
              const chunk = selectedFile.slice(start, end);

              const reader = new FileReader();
              reader.onload = (e) => {
                conn.send({
                  type: 'file-chunk',
                  fileName: data.fileName,
                  chunk: e.target.result,
                  chunkIndex: currentChunk,
                  totalChunks: totalChunks
                });

                currentChunk++;
                if (currentChunk < totalChunks) {
                  sendChunk();
                }
              };
              reader.readAsArrayBuffer(chunk);
            };

            sendChunk();
          }
        } else if (data.type === 'file-chunk') {
          // Handle incoming file chunks
          if (!window.receivedChunks) {
            window.receivedChunks = {};
          }
          if (!window.receivedChunks[data.fileName]) {
            window.receivedChunks[data.fileName] = [];
          }

          window.receivedChunks[data.fileName][data.chunkIndex] = data.chunk;
          
          // Update progress
          setDownloadProgress(prev => ({
            ...prev,
            [data.fileName]: ((data.chunkIndex + 1) / data.totalChunks) * 100
          }));

          // If all chunks received, combine and download
          if (data.chunkIndex === data.totalChunks - 1) {
            const chunks = window.receivedChunks[data.fileName];
            const blob = new Blob(chunks);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            delete window.receivedChunks[data.fileName];
          }
        }
      });

      conn.on('close', () => {
        console.log('Connection closed with:', conn.peer);
        setConnectedPeers(prev => prev.filter(id => id !== conn.peer));
        delete connectionsRef.current[conn.peer];
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        delete connectionsRef.current[conn.peer];
      });
    });

    newPeer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (err.type === 'peer-unavailable') {
        alert('Peer is not available. Please check the Peer ID and try again.');
      } else if (err.type === 'server-error') {
        alert('Server error. Please try again later.');
      } else if (err.type === 'network') {
        alert('Network error. Please check your connection.');
      } else {
        alert('Failed to initialize peer connection. Please refresh the page.');
      }
    });

    setPeer(newPeer);
    peerRef.current = newPeer;

    // Initialize Socket.IO
    socketRef.current = io(SERVER_URL, {
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Socket event handlers
    socketRef.current.on('peer-list', (peers) => {
      console.log('Received peer list:', peers);
      setConnectedPeers(peers);
    });

    socketRef.current.on('peer-joined', (data) => {
      console.log('Peer joined:', data);
      setConnectedPeers(prev => {
        if (!prev.includes(data.peerId)) {
          return [...prev, data.peerId];
        }
        return prev;
      });
      if (data.files && data.files.length > 0) {
        setSharedFiles(prev => [...prev, ...data.files]);
      }
    });

    socketRef.current.on('peer-left', (peerId) => {
      console.log('Peer left:', peerId);
      setConnectedPeers(prev => prev.filter(id => id !== peerId));
      setSharedFiles(prev => prev.filter(file => file.peerId !== peerId));
    });

    return () => {
      newPeer.destroy();
      socketRef.current.disconnect();
    };
  }, []);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleShareFile = () => {
    if (!selectedFile) return;

    const fileData = {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      peerId: peerId,
      id: Date.now().toString() // Add unique ID for the file
    };

    // Share file metadata with all connected peers
    Object.values(connectionsRef.current).forEach(conn => {
      conn.send({
        type: 'file-metadata',
        fileData: fileData
      });
    });

    // Also emit to server for discovery
    socketRef.current.emit('share-file', fileData);
    setSharedFiles(prev => [...prev, fileData]);
    setSelectedFile(null);
  };

  const handleSearch = () => {
    socketRef.current.emit('search-files', searchQuery);
  };

  const handleDownload = async (file, peerId) => {
    const conn = connectionsRef.current[peerId];
    if (!conn) {
      console.error('No connection to peer');
      return;
    }

    setDownloadProgress(prev => ({
      ...prev,
      [file.name]: 0
    }));

    // Request file from peer
    conn.send({
      type: 'request-file',
      fileName: file.name,
      fileId: file.id
    });
  };

  const handleConnect = () => {
    if (!connectPeerId || !peerRef.current) {
      console.error('No peer ID provided or peer not initialized');
      return;
    }

    try {
      console.log('Attempting to connect to peer:', connectPeerId);
      
      // Check if already connected
      if (connectionsRef.current[connectPeerId]) {
        console.log('Already connected to peer:', connectPeerId);
        return;
      }

      const conn = peerRef.current.connect(connectPeerId, {
        reliable: true,
        metadata: { peerId: peerId }
      });
      
      conn.on('open', () => {
        console.log('Successfully connected to peer:', connectPeerId);
        connectionsRef.current[connectPeerId] = conn;
        setConnectedPeers(prev => {
          if (!prev.includes(connectPeerId)) {
            return [...prev, connectPeerId];
          }
          return prev;
        });
        setConnectPeerId('');
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        alert('Failed to connect to peer. Please check the Peer ID and try again.');
        delete connectionsRef.current[connectPeerId];
      });

      conn.on('data', (data) => {
        console.log('Received data from peer:', data);
      });

      conn.on('close', () => {
        console.log('Connection closed with peer:', connectPeerId);
        setConnectedPeers(prev => prev.filter(id => id !== connectPeerId));
        delete connectionsRef.current[connectPeerId];
      });

    } catch (error) {
      console.error('Error connecting to peer:', error);
      alert('Failed to connect to peer. Please check the Peer ID and try again.');
    }
  };

  return (
    <Container className="mt-4">
      <Row>
        <Col>
          <Card>
            <Card.Header>
              <h3>P2P File Sharing</h3>
              <p>Your Peer ID: {peerId}</p>
            </Card.Header>
            <Card.Body>
              <Form className="mb-4">
                <Form.Group className="mb-3">
                  <Form.Label>Connect to Peer</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      placeholder="Enter Peer ID"
                      value={connectPeerId}
                      onChange={(e) => setConnectPeerId(e.target.value)}
                    />
                    <Button 
                      variant="primary" 
                      onClick={handleConnect}
                      disabled={!connectPeerId}
                    >
                      Connect
                    </Button>
                  </InputGroup>
                </Form.Group>
              </Form>

              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Share File</Form.Label>
                  <Form.Control type="file" onChange={handleFileSelect} />
                  <Button 
                    variant="primary" 
                    className="mt-2"
                    onClick={handleShareFile}
                    disabled={!selectedFile}
                  >
                    Share File
                  </Button>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Search Files</Form.Label>
                  <Form.Control
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter file name..."
                  />
                  <Button 
                    variant="secondary" 
                    className="mt-2"
                    onClick={handleSearch}
                  >
                    Search
                  </Button>
                </Form.Group>
              </Form>

              <h4>Connected Peers ({connectedPeers.length})</h4>
              <ListGroup>
                {connectedPeers.map(peer => (
                  <ListGroup.Item key={peer}>{peer}</ListGroup.Item>
                ))}
              </ListGroup>

              <h4 className="mt-4">Shared Files</h4>
              <ListGroup>
                {sharedFiles.map((file, index) => (
                  <ListGroup.Item key={index}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{file.name}</strong>
                        <br />
                        <small>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</small>
                      </div>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleDownload(file, file.peerId)}
                      >
                        Download
                      </Button>
                    </div>
                    {downloadProgress[file.name] !== undefined && (
                      <div className="progress mt-2">
                        <div
                          className="progress-bar"
                          role="progressbar"
                          style={{ width: `${downloadProgress[file.name]}%` }}
                        />
                      </div>
                    )}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default App; 