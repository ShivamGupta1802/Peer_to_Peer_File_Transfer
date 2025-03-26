import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@libp2p/webrtc', '@libp2p/websockets'],
  },
  resolve: {
    alias: {
      'process': 'process/browser',
      'buffer': 'buffer',
    },
  },
});