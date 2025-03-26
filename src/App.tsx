import React, { useEffect, useState, useRef } from 'react';
import { Network, Users, MessageSquare, Share2, Loader2, Upload, Download, FileBox } from 'lucide-react';
import Peer from 'peerjs';

interface Message {
  from: string;
  content: string;
  timestamp: number;
}

interface FileTransfer {
  id: string;
  name: string;
  size: number;
  from: string;
  timestamp: number;
  status: 'pending' | 'downloading' | 'complete';
}

function App() {
  const [peerId, setPeerId] = useState<string>('');
  const [targetPeerId, setTargetPeerId] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const peerRef = useRef<Peer>();
  const connectionsRef = useRef<Map<string, Peer.DataConnection>>(new Map());
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const peer = new Peer();

    peer.on('open', (id) => {
      setPeerId(id);
      console.log('My peer ID is:', id);
    });

    peer.on('connection', (conn) => {
      handleConnection(conn);
    });

    peer.on('error', (err) => {
      setError(`Connection error: ${err.message}`);
      setConnecting(false);
    });

    peerRef.current = peer;

    return () => {
      peer.destroy();
    };
  }, []);

  const downloadFile = (transfer: FileTransfer) => {
    // Assuming you have the file data stored somewhere, you can retrieve it.
    const fileData = transfers.find(t => t.id === transfer.id);
    if (fileData) {
      const blob = new Blob([fileData.fileData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = transfer.name;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  const handleConnection = (conn: Peer.DataConnection) => {
    conn.on('data', (data: any) => {
      if (typeof data === 'object') {
        if ('content' in data) {
          setMessages(prev => [...prev, {
            from: conn.peer,
            content: data.content,
            timestamp: Date.now()
          }]);
        } else if ('fileInfo' in data) {
          // Handle incoming file info
          setTransfers(prev => [...prev, {
            id: data.fileInfo.id,
            name: data.fileInfo.name,
            size: data.fileInfo.size,
            from: conn.peer,
            timestamp: Date.now(),
            status: 'pending'
          }]);
        } else if ('fileData' in data) {
          // Handle incoming file data
          const file = new Blob([data.fileData]);
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = data.fileName;
          a.click();
          URL.revokeObjectURL(url);
          
          setTransfers(prev => 
            prev.map(t => 
              t.id === data.fileId 
                ? { ...t, status: 'complete' } 
                : t
            )
          );
        }
      }
    });

    conn.on('open', () => {
      connectionsRef.current.set(conn.peer, conn);
      setConnectedPeers(prev => [...new Set([...prev, conn.peer])]);
      setConnecting(false);
      setError('');
    });

    conn.on('close', () => {
      connectionsRef.current.delete(conn.peer);
      setConnectedPeers(prev => prev.filter(p => p !== conn.peer));
    });
  };

  const connectToPeer = () => {
    if (!targetPeerId || !peerRef.current) return;
    
    setConnecting(true);
    setError('');

    try {
      const conn = peerRef.current.connect(targetPeerId);
      handleConnection(conn);
    } catch (err) {
      setError('Failed to connect to peer');
      setConnecting(false);
    }
  };

  const sendMessage = () => {
    if (!message) return;

    connectionsRef.current.forEach((conn) => {
      conn.send({ content: message });
    });

    setMessages(prev => [...prev, {
      from: peerId,
      content: message,
      timestamp: Date.now()
    }]);

    setMessage('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError('');
    }
  };

  // const sendFile = async () => {
  //   if (!selectedFile || connectedPeers.length === 0) return;
  //    if (!selectedFile || !targetPeerId) return;

  //   const fileId = Math.random().toString(36).substring(7);
  //   const fileInfo = {
  //     id: fileId,
  //     name: selectedFile.name,
  //     size: selectedFile.size
  //   };

  //   // Send file info to all peers
  //   connectionsRef.current.forEach((conn) => {
  //     conn.send({ fileInfo });
  //   });

  //   // Read and send the file
  //   const reader = new FileReader();
  //   reader.onload = (e) => {
  //     const fileData = e.target?.result;
  //     connectionsRef.current.forEach((conn) => {
  //       conn.send({
  //         fileId,
  //         fileName: selectedFile.name,
  //         fileData
  //       });
  //     });
  //   };
  //   reader.readAsArrayBuffer(selectedFile);

  //   setSelectedFile(null);
  // };
  const sendFile = async () => {
    if (!selectedFile || connectedPeers.length === 0) return;

    const selectedUserId = document.getElementById("userSelect").value; // Get the selected user ID from the dropdown

    const fileId = Math.random().toString(36).substring(7);
    const fileInfo = {
        id: fileId,
        name: selectedFile.name,
        size: selectedFile.size
    };

    // If "Send to All" is selected, send to all peers
    if (selectedUserId === "all") {
        connectionsRef.current.forEach((conn) => {
            conn.send({ fileInfo });
        });
    } else {
        // Send file info to the selected peer only
        const targetConnection = connectionsRef.current.get(selectedUserId);
        if (targetConnection) {
            targetConnection.send({ fileInfo });
        }
    }

    // Read and send the file
    const reader = new FileReader();
    reader.onload = (e) => {
        const fileData = e.target?.result;
        if (selectedUserId === "all") {
            connectionsRef.current.forEach((conn) => {
                conn.send({
                    fileId,
                    fileName: selectedFile.name,
                    fileData
                });
            });
        } else {
            const targetConnection = connectionsRef.current.get(selectedUserId);
            if (targetConnection) {
                targetConnection.send({
                    fileId,
                    fileName: selectedFile.name,
                    fileData
                });
            }
        }
    };
    reader.readAsArrayBuffer(selectedFile);

    setSelectedFile(null);
};

  

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Network className="w-8 h-8 text-indigo-600" />
              <h1 className="text-3xl font-bold text-gray-800">P2P File Sharing</h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>{connectedPeers.length} peers connected</span>
            </div>
          </div>
         
          {/* Peer ID Display */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-md">
  <h2 className="text-lg font-semibold mb-2">Set Your Name</h2>
  <div className="flex items-center">
    <input
      type="text"
      value={userName}
      onChange={(e) => setUserName(e.target.value)}
      placeholder="Enter your name"
      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
    <button
      onClick={() => {
        // Logic to handle setting the name can be added here
        console.log("Name set to:", userName);
      }}
      className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
    >
      Set Name
    </button>
  </div>
  <div className="mt-2">
    <span className="text-sm text-gray-600">Your Peer ID:</span>
    <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
      {peerId || 'Connecting...'}
    </code>
  </div>
</div>

          {/* Connect to Peer */}
          <div className="mb-8">
            <div className="flex gap-2">
              <input
                type="text"
                value={targetPeerId}
                onChange={(e) => setTargetPeerId(e.target.value)}
                placeholder="Enter peer ID to connect"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={connectToPeer}
                disabled={!targetPeerId || connecting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Connect</span>
                  </>
                )}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          {/* Connected Users */}
          <div className="mb-8">
  <h2 className="text-lg font-semibold mb-2">Connected Users</h2>
  <ul className="list-disc pl-5">
    {connectedPeers.map((peer) => (
      <li key={userName} className="text-gray-800">
        <span className="font-bold">{peer}</span> - 
        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{peerId}</code>
      </li>
    ))}
    {connectedPeers.length === 0 && (
      <p className="text-gray-500">No connected users</p>
    )}
  </ul>
</div>

          {/* File Transfer */}
          <div className="mb-8">
    <h2 className="text-lg font-semibold mb-2">File Transfer</h2>
    
    {/* File Input Area */}
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
        <input
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            id="fileInput"
        />
        <label
            htmlFor="fileInput"
            className="cursor-pointer flex flex-col items-center justify-center"
        >
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <span className="text-gray-600">
                {selectedFile ? selectedFile.name : 'Choose a file or drag it here'}
            </span>
        </label>
    </div>

    {/* User Selection Area */}
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
        <h3 className="text-md font-semibold mb-2">Select User to Send File</h3>
        <select 
            id="userSelect" 
            className="border rounded-lg p-2 w-full"
            onChange={(e) => setSelectedUser(e.target.value)} // Assuming you have a state for selectedUser 
        >
            <option value="all">Send to All</option>
            {connectedPeers.map((peer) => (
                <option key={peer} value={peer}>{peer}</option>
            ))}
        </select>
    </div>

    {/* Send File Button */}
    <button
        onClick={sendFile}
        disabled={!selectedFile || connectedPeers.length === 0}
        className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
        <FileBox className="w-5 h-5" />
        <span>Send File</span>
    </button>
</div>

          {/* File Transfers */}
          {/* <div className="mb-8">
            <h2 className="text-lg font-semibold mb-2">Transfers</h2>
            <div className="space-y-2">
              {transfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {transfer.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      From: {transfer.from === peerId ? 'You' : transfer.from}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {(transfer.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    {transfer.status === 'complete' ? (
                      <span className="text-green-600 text-sm">Complete</span>
                    ) : transfer.status === 'downloading' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    ) : (
                      <Download className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                </div>
              ))}
              {transfers.length === 0 && (
                <p className="text-center text-gray-500">No transfers yet</p>
              )}
            </div>
          </div> */}


          {/* File Transfers */}
<div className="mb-8">
  <h2 className="text-lg font-semibold mb-2">Transfers</h2>
  <div className="space-y-2">
    {transfers.map((transfer) => (
      <div
        key={transfer.id}
        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {transfer.name}
          </p>
          <p className="text-xs text-gray-500">
            From: {transfer.from === peerId ? 'You' : transfer.from}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {(transfer.size / 1024 / 1024).toFixed(2)} MB
          </span>
          {transfer.status === 'complete' ? (
            <>
              <span className="text-green-600 text-sm">Complete</span>
              <button
                onClick={() => downloadFile(transfer)}
                className="px-2 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Download
              </button>
            </>
          ) : transfer.status === 'downloading' ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          ) : (
            <Download className="w-4 h-4 text-indigo-600" />
          )}
        </div>
      </div>
    ))}
    {transfers.length === 0 && (
      <p className="text-center text-gray-500">No transfers yet</p>
    )}
  </div>
</div>

          {/* Messages */}
          {/* <div>
            <h2 className="text-lg font-semibold mb-2">Messages</h2>
            <div className="h-64 overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-2 p-2 rounded-lg ${
                    msg.from === peerId
                      ? 'bg-indigo-100 ml-auto'
                      : 'bg-gray-100'
                  } max-w-[80%] ${msg.from === peerId ? 'ml-auto' : ''}`}
                >
                  <p className="text-sm text-gray-600 mb-1">
                    {msg.from === peerId ? 'You' : `Peer: ${msg.from}`}
                  </p>
                  <p className="text-gray-800">{msg.content}</p>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-gray-500 text-center">No messages yet</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={sendMessage}
                disabled={!message || connectedPeers.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send</span>
              </button>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
}

export default App;