import React, { useState } from 'react';
import {
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  LinearProgress,
} from '@mui/material';
import { CloudUpload, GetApp } from '@mui/icons-material';

const CHUNK_SIZE = 16384; // 16KB chunks

function FileShare({ peer, connections }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [downloadProgress, setDownloadProgress] = useState({});

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile || !peer) return;

    const fileReader = new FileReader();
    const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
    let currentChunk = 0;

    fileReader.onload = async (e) => {
      const chunk = e.target.result;
      
      // Send chunk to all connected peers
      Object.values(connections).forEach(conn => {
        conn.send({
          type: 'file-chunk',
          fileName: selectedFile.name,
          chunkIndex: currentChunk,
          totalChunks: totalChunks,
          data: chunk
        });
      });

      currentChunk++;
      setUploadProgress(prev => ({
        ...prev,
        [selectedFile.name]: (currentChunk / totalChunks) * 100
      }));

      if (currentChunk < totalChunks) {
        // Read next chunk
        const start = currentChunk * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
        fileReader.readAsArrayBuffer(selectedFile.slice(start, end));
      }
    };

    // Start reading the first chunk
    fileReader.readAsArrayBuffer(selectedFile.slice(0, CHUNK_SIZE));
  };

  const downloadFile = (fileData) => {
    const { fileName, chunks, totalChunks } = fileData;
    
    if (chunks.length === totalChunks) {
      const blob = new Blob(chunks);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div>
      <Typography variant="h5" gutterBottom>
        File Sharing
      </Typography>

      <input
        type="file"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        id="file-input"
      />
      <label htmlFor="file-input">
        <Button
          variant="contained"
          color="primary"
          component="span"
          startIcon={<CloudUpload />}
          style={{ marginBottom: '1rem' }}
        >
          Select File
        </Button>
      </label>

      {selectedFile && (
        <div>
          <Typography variant="body1" gutterBottom>
            Selected: {selectedFile.name}
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            onClick={uploadFile}
            disabled={!peer}
          >
            Share File
          </Button>
          {uploadProgress[selectedFile.name] && (
            <LinearProgress
              variant="determinate"
              value={uploadProgress[selectedFile.name]}
              style={{ marginTop: '1rem' }}
            />
          )}
        </div>
      )}

      <List>
        {Object.entries(downloadProgress).map(([fileName, progress]) => (
          <ListItem key={fileName}>
            <ListItemText
              primary={fileName}
              secondary={`Download Progress: ${Math.round(progress)}%`}
            />
            <LinearProgress
              variant="determinate"
              value={progress}
              style={{ width: '100px', marginRight: '1rem' }}
            />
          </ListItem>
        ))}
      </List>
    </div>
  );
}

export default FileShare; 