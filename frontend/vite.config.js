import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'; 
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  // plugins: [react()],
  plugins: [react(), cesium()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://10.10.60.131:5221',
        changeOrigin: true,
      }
    }
  }
})