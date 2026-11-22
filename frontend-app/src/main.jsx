import { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import StartupRecovery from './components/StartupRecovery';
import { leerPreferencia } from './utils/preferenciasLocales';
import './assets/product-design.css';
import './assets/kpi-design.css';
import './assets/chart-panel.css';
import './assets/campo-interior.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error crítico en tiempo de ejecución de ZeaSys App:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <StartupRecovery title="No se pudo abrir ZeaSys" action="Volver a cargar"
          light={document.body.classList.contains('light-theme') || leerPreferencia('theme') === 'light'}
          onRetry={() => window.location.reload()}>
          Vuelve a cargar la aplicación. Si el problema continúa, contacta con el equipo de ZeaSys.
        </StartupRecovery>
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

// Instalable y con página sin conexión. Solo en producción y en contextos seguros (https o localhost).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
