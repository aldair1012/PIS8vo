import PlatformLogo from './PlatformLogo';
import { 
  Sprout, 
  CloudRainWind, 
  TrendingUp, 
  DollarSign, 
  Map, 
  PlusCircle, 
  History, 
  LogOut,
  MapPin,
} from 'lucide-react';

export default function Sidebar({ vistaActual, setVistaActual, cerrarSesion, menuColapsado, setMenuColapsado }) {
  const menuItems = [
    { id: 'yield', name: 'Brecha Productiva', icon: TrendingUp },
    { id: 'scenarios', name: 'Viabilidad de Siembra', icon: Sprout },
    { id: 'climate', name: 'Calendario Fenológico', icon: CloudRainWind },
    { id: 'finance', name: 'Viabilidad Financiera', icon: DollarSign },
    { id: 'history', name: 'Historial', icon: History },
    { id: 'map', name: 'Mapa de Parcelas', icon: Map },
    { id: 'simular', name: 'Nueva Simulación', icon: PlusCircle },
    { id: 'cultivos', name: 'Gestionar Lotes', icon: MapPin }
  ];

  return (
    <aside
      className={`sidebar ${menuColapsado ? 'collapsed' : ''}`}
      style={{
        background: 'var(--bg-card)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: '1px solid var(--border)',
        transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="sidebar-logo" style={{ padding: '1rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: menuColapsado ? 'center' : 'flex-start' }}>
        <PlatformLogo size={menuColapsado ? 36 : 48} isIconOnly={menuColapsado} />
      </div>
      <ul className="sidebar-menu" style={{ listStyle: 'none', padding: '0.5rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = vistaActual === item.id;
          return (
            <li key={item.id}>
              <button
                className={`sidebar-item-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setVistaActual(item.id);
                  if (window.innerWidth <= 1080) {
                    setMenuColapsado(true);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: isActive ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 500,
                  textAlign: 'left',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '3px',
                    height: '60%',
                    background: 'var(--accent-primary)',
                    borderRadius: '0 2px 2px 0',
                  }} />
                )}
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!menuColapsado && <span>{item.name}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Logout button */}
      <div style={{ marginTop: 'auto', padding: '0.5rem' }}>
        <button
          onClick={cerrarSesion}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            width: '100%',
            padding: '0.625rem 0.875rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <LogOut size={18} style={{ flexShrink: 0 }} />
          {!menuColapsado && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}