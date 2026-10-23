import PlatformLogo from './PlatformLogo';
import {
  Sprout, CloudRainWind, TrendingUp, DollarSign, Map,
  PlusCircle, History, LogOut, MapPin,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Decidir',
    items: [
      { id: 'yield', name: 'Rendimiento', icon: TrendingUp },
      { id: 'scenarios', name: 'Siembra', icon: Sprout },
      { id: 'climate', name: 'Clima y cultivo', icon: CloudRainWind },
      { id: 'finance', name: 'Finanzas', icon: DollarSign },
    ],
  },
  {
    label: 'Explorar',
    items: [
      { id: 'map', name: 'Mapa de parcelas', icon: Map },
      { id: 'history', name: 'Historial', icon: History },
    ],
  },
  {
    label: 'Gestionar',
    items: [
      { id: 'simular', name: 'Nueva simulación', icon: PlusCircle },
      { id: 'cultivos', name: 'Mis lotes', icon: MapPin },
    ],
  },
];

export default function Sidebar({ vistaActual, setVistaActual, cerrarSesion, menuColapsado, setMenuColapsado }) {
  const elegirVista = (id) => {
    setVistaActual(id);
    if (window.innerWidth <= 1080) setMenuColapsado(true);
  };

  return (
    <aside className={`sidebar ${menuColapsado ? 'collapsed' : ''}`} aria-label="Navegación de ZeaSys">
      <div className="sidebar-logo">
        <PlatformLogo variant="wordmark" size={34} />
        <span className="sidebar-brand-caption">Centro de decisiones agrícolas</span>
      </div>

      <nav className="sidebar-navigation" aria-label="Secciones del sistema">
        {NAV_GROUPS.map((group) => (
          <div className="sidebar-section" key={group.label}>
            <h2 className="sidebar-section-title">{group.label}</h2>
            <ul className="sidebar-menu">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = vistaActual === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`sidebar-item-btn ${active ? 'active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => elegirVista(item.id)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{item.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <span className="sidebar-bottom-caption">Datos claros. Mejores decisiones.</span>
        <button type="button" className="sidebar-logout" onClick={cerrarSesion}>
          <LogOut size={18} aria-hidden="true" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
