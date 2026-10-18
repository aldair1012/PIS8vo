import { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import './index.css';
import App from './App.jsx';

// Exponer Leaflet en window y globalThis antes de que plugins dependientes se evalúen
window.L = L;
globalThis.L = L;

// Importar Geoman dinámicamente garantizando que L ya existe en el ámbito global
import('@geoman-io/leaflet-geoman-free').catch((err) => {
  console.warn('Advertencia al cargar Geoman:', err);
});

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Critical Runtime Error in ZeaSys App:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#0f172a',
          color: '#ffffff',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            maxWidth: '650px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1.5px solid #ef4444',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ color: '#f87171', fontSize: '1.5rem', marginBottom: '1rem' }}>
              ⚠️ Error de Ejecución en ZeaSys
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1rem' }}>
              El sistema ha detectado una excepción durante la inicialización:
            </p>
            <pre style={{
              background: '#020617',
              padding: '1rem',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1.5rem',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🔄 Limpiar Caché y Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
