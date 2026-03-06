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
      '/api/movies': {
        target: 'https://rt6xvm5qvr.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/movies/, ''),
      },
      '/api/templates': {
        target: 'https://y2jtqf58bf.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/templates/, ''),
      },
      '/api/bgm': {
        target: 'https://2b7tgw8s7h.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bgm/, ''),
      },
      '/api/dubbing': {
        target: 'https://4cnpfpw2q7.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dubbing/, ''),
      },
      '/api/script': {
        target: 'https://fhwpnktkcp.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/script/, ''),
      },
      '/api/clip': {
        target: 'https://wsk44rd4dv.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/clip/, ''),
      },
      '/api/video': {
        target: 'https://q77shf4jhf.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/video/, ''),
      },
      '/api/status': {
        target: 'https://fnd4r5gvww.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/status/, ''),
      },
      '/api/cloud_files': {
        target: 'https://m83sqwjvdv.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cloud_files/, ''),
      },
      '/api/viral_learn': {
        target: 'https://s6zrzf9gxs.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/viral_learn/, ''),
      },
    },
  }
})
