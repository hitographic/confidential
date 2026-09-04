import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Frontend murni — backend tetap Google Apps Script (Code.gs).
// Deploy frontend ke Vercel / Netlify / GitHub Pages,
// lalu isi VITE_GAS_URL dengan URL Web App (/exec) dari Apps Script.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'sweetalert2'],
          export: ['exceljs', 'jspdf', 'html2canvas'],
        },
      },
    },
  },
})
