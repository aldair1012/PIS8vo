import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin para inyectar import L from 'leaflet' en Geoman antes de evaluarse
function leafletGeomanPlugin() {
  return {
    name: 'leaflet-geoman-global-l',
    enforce: 'pre',
    transform(code, id) {
      if ((id.includes('leaflet-geoman') || id.includes('@geoman-io')) && !id.endsWith('.css')) {
        console.log('[leafletGeomanPlugin] Transforming:', id);
        return {
          code: `import L from 'leaflet';\nif (typeof window !== 'undefined') { window.L = L; }\nif (typeof globalThis !== 'undefined') { globalThis.L = L; }\n${code}`,
          map: null
        };
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [leafletGeomanPlugin(), react()],
  server: {
    port: 5500,
    strictPort: true
  },
  base: './',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (name && name.endsWith('.css')) {
            return 'assets/estilo-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/three/') || id.includes('\\three\\')) {
              return 'modelo-3d';
            }
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
              return 'graficos';
            }
            if (id.includes('lucide-react')) {
              return 'iconos';
            }
            if (id.includes('leaflet') || id.includes('@geoman-io')) {
              return 'mapas';
            }
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
              return 'react';
            }
            if (id.includes('axios')) {
              return 'http';
            }
            return 'terceros';
          }
        }
      }
    }
  }
})
