import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

window.L = L;
globalThis.L = L;
// El módulo de las vistas espera a que Geoman esté listo antes de montar mapas.
await import('@geoman-io/leaflet-geoman-free');
