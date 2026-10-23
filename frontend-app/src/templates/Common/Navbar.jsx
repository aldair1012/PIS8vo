import { User, Cpu, Menu, ChevronDown, ChevronLeft } from 'lucide-react';
import LoteSelector from './LoteSelector';

export default function Navbar({ 
  title, 
  cultivos, 
  cultivoElegidoId, 
  setCultivoElegidoId, 
  anioSeleccionado, 
  setAnioSeleccionado,
  user,
  iaEncendida,
  menuCerrado,
  setMenuCerrado,
  vistaActual,
  setVistaActual
}) {
  return (
    <div className="navbar">
      <div className="navbar-left" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <button
          onClick={() => setMenuCerrado(!menuCerrado)}
          className="navbar-sidebar-toggle-btn"
          title={menuCerrado ? "Expandir barra lateral" : "Ocultar barra lateral"}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: 'var(--zs-inset-surface)',
            color: 'var(--zs-text)',
            border: '1px solid var(--zs-border)',
            cursor: 'pointer',
            boxShadow: 'var(--zs-shadow-raised)',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {menuCerrado ? <Menu size={19} /> : <ChevronLeft size={19} />}
        </button>
        <h2 className="navbar-title" style={{ margin: 0 }}>{title}</h2>
      </div>
      
      <div className="navbar-right">
        {/* ML Engine Status */}
        <div className="status-indicator" style={{ flexShrink: 0 }} title={iaEncendida ? "Servidor de IA responde" : "Servidor de IA desconectado"}>
          <Cpu size={15} className={iaEncendida ? "text-success" : "text-danger"} />
          <span className="ia-status-label" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>IA</span>
          <span className={`status-dot ${iaEncendida ? "active" : "inactive"}`} />
        </div>

        {/* Lote & Year Selector — Premium Panel (only visible on DSS views) */}
        {['yield', 'scenarios', 'climate', 'finance'].includes(vistaActual) && (
          <LoteSelector
            cultivos={cultivos}
            cultivoElegidoId={cultivoElegidoId}
            setCultivoElegidoId={setCultivoElegidoId}
            anioSeleccionado={anioSeleccionado}
            setAnioSeleccionado={setAnioSeleccionado}
            setVistaActual={setVistaActual}
          />
        )}

        {/* User & Settings Button Integrated */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button 
              onClick={() => setVistaActual(vistaActual === 'configuracion' ? 'yield' : 'configuracion')}
              className={`lote-selector-trigger ${vistaActual === 'configuracion' ? 'active' : ''}`}
              style={{ 
                border: '1.5px solid var(--border-subtle)',
                padding: '0.4rem 0.65rem',
                gap: '0.55rem'
              }}
              title="Configuración de Cuenta y Sistema"
            >
              <div 
                style={{ 
                  width: '26px', 
                  height: '26px', 
                  borderRadius: '50%', 
                  overflow: 'hidden', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid var(--border-strong)',
                  flexShrink: 0
                }}
              >
                {user?.foto_perfil ? (
                  <img 
                    src={user.foto_perfil} 
                    alt={user.nombre} 
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextElementSibling) {
                        e.currentTarget.nextElementSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <span 
                  style={{ 
                    display: user?.foto_perfil ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    fontSize: '0.72rem', 
                    fontWeight: 800, 
                    color: 'var(--accent-primary)' 
                  }}
                >
                  {user?.nombre ? user.nombre.charAt(0).toUpperCase() : <User size={14} />}
                </span>
              </div>
              <div className="lote-selector-trigger-text" style={{ textAlign: 'left' }}>
                <span className="lote-selector-trigger-label" style={{ fontWeight: 700 }}>
                  {user.nombre}
                </span>
                <span className="lote-selector-trigger-sub">
                  Productor
                </span>
              </div>
              <ChevronDown 
                size={16} 
                className="lote-selector-chevron" 
                style={{ 
                  transform: vistaActual === 'configuracion' ? 'rotate(180deg)' : 'rotate(0)', 
                  transition: 'transform 0.25s ease' 
                }} 
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
