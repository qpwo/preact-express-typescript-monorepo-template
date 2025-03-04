import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact({
      // prerender: { enabled: true },
    }),
    basicSsl(),
  ],
  server: {
    host: '127.0.0.1',
    port: 57563,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:15347/',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
})
