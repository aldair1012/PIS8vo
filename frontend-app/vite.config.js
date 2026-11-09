import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  plugins: [leafletGeomanPlugin(), react(), tailwindcss()],
  server: {
    port: 5500,
    strictPort: true
  },
  base: './',
  build: {
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/app-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (name && name.endsWith('.css')) {
            return 'assets/estilo-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'modelo-3d-core', test: /[\\/]three[\\/]build[\\/]three\.core\.js$/, priority: 30 },
            { name: 'modelo-3d', test: /node_modules[\\/]three[\\/]/, priority: 20 },
            { name: 'graficos', test: /node_modules[\\/](?:chart\.js|react-chartjs-2)[\\/]/ },
            { name: 'iconos', test: /node_modules[\\/]lucide-react[\\/]/ },
            { name: 'mapas', test: /node_modules[\\/](?:leaflet|@geoman-io)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/ },
            { name: 'http', test: /node_modules[\\/]axios[\\/]/ },
          ],
        }
      }
    }
  }
})
