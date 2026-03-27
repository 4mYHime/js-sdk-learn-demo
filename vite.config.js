import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3100,
    open: false,
    hmr: {
      host: 'localhost',
      timeout: 3000,
    },
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
      '/api/v2': {
        target: 'https://openapi.jieshuo.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v2/, '/v2'),
      },
      '/api/pre_upload': {
        target: 'https://zzz7f2thfq.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pre_upload/, ''),
      },
      '/api/upload_task': {
        target: 'https://3mby87347p.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/upload_task/, ''),
      },
      '/api/transfer_list': {
        target: 'https://v6ztd4tn4r.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/transfer_list/, ''),
      },
      '/api/delete_file': {
        target: 'https://hptt42558m.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/delete_file/, ''),
      },
      '/api/update_pre_file': {
        target: 'https://mj2dzv4fkn.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/update_pre_file/, ''),
      },
      '/api/user_balance': {
        target: 'https://f9cmyyvhjx.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/user_balance/, ''),
      },
      '/api/cloud_drive_usage': {
        target: 'https://ybm8p77ydh.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cloud_drive_usage/, ''),
      },
      '/api/estimate_points': {
        target: 'https://3y69rshy4q.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/estimate_points/, ''),
      },
      '/api/order_api': {
        target: 'https://9jx9k4wgkx.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/order_api/, ''),
      },
      '/api/file_download': {
        target: 'https://rkf588fr4n.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/file_download/, ''),
      },
      '/api/movie_search': {
        target: 'https://bkvwdm8fpf.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/movie_search/, ''),
      },
      '/api/original_script': {
        target: 'https://knh3yghcjg.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/original_script/, ''),
      },
      '/api/original_clip': {
        target: 'https://b3k9vphmc4.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/original_clip/, ''),
      },
      '/api/task_consum_calc_points': {
        target: 'https://p3bvh2ss7f.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/task_consum_calc_points/, ''),
      },
      '/api/presigned_upload': {
        target: 'https://y7qm5w7nt6.coze.site',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/presigned_upload/, ''),
      },
    },
  }
})
