import React from 'react';
import {
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import { Person } from '@mui/icons-material';

function PeerList({ peers }) {
  return (
    <div>
      <Typography variant="h5" gutterBottom>
        Connected Peers
      </Typography>
      
      <List>
        {peers.map((peerId) => (
          <ListItem key={peerId}>
            <ListItemIcon>
              <Person />
            </ListItemIcon>
            <ListItemText
              primary={peerId}
              secondary="Connected"
            />
          </ListItem>
        ))}
        
        {peers.length === 0 && (
          <ListItem>
            <ListItemText
              primary="No peers connected"
              secondary="Share your peer ID to connect"
            />
          </ListItem>
        )}
      </List>
    </div>
  );
}

export default PeerList; 