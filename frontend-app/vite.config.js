import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { gzipSync } from 'node:zlib'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function comprimirRecursos() {
  return {
    name: 'gzip-estatico',
    apply: 'build',
    async writeBundle({ dir }, bundle) {
      // Vite termina de sustituir las rutas de precarga después de generateBundle.
      await Promise.all(Object.keys(bundle).filter(nombre => /\.(js|css)$/.test(nombre)).map(async nombre => {
        const ruta = resolve(dir, nombre);
        const contenido = await readFile(ruta);
        if (contenido.length >= 4096) await writeFile(ruta + '.gz', gzipSync(contenido, { level: 9 }));
      }));
    },
  };
}

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
  plugins: [leafletGeomanPlugin(), react(), comprimirRecursos()],
  server: {
    port: 5500,
    strictPort: true
  },
  base: './',
  build: {
    cssTarget: 'chrome111',
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/app-r2-[hash].js',
        chunkFileNames: 'assets/[name]-r2-[hash].js',
        assetFileNames: ({ name }) => {
          if (name && name.endsWith('.css')) {
            return 'assets/estilo-r2-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'modelo-3d-core', test: /[\\/]three[\\/]build[\\/]three\.core\.js$/, priority: 30 },
            { name: 'modelo-3d', test: /node_modules[\\/]three[\\/]/, priority: 20 },
            { name: 'graficos', test: /node_modules[\\/](?:echarts|zrender)[\\/]/ },
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
