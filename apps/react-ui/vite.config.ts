import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forwards same-origin /api/<backend> calls to the matching local
      // backend during `npm run dev`; mirrors the Cloudflare Tunnel ingress
      // routing used in production (see deploy/cloudflared/config.yml).
      '/api/go': 'http://localhost:8080',
      '/api/rust': 'http://localhost:8081',
      '/api/ts': 'http://localhost:8082'
    }
  }
});
