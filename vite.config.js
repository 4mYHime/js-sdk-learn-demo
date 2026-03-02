import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    proxy: {
      '/api/drama': {
        target: 'https://y2jtqf58bf.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/drama/, ''),
      },
      '/api/files': {
        target: 'https://m83sqwjvdv.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/files/, ''),
      },
      '/api/narrate': {
        target: 'https://fhwpnktkcp.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/narrate/, ''),
      },
    },
  }
})
