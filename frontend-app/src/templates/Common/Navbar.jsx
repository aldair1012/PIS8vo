import { User, Cpu, Menu, ChevronDown, ChevronLeft, Sun, Moon } from 'lucide-react';
import LoteSelector from './LoteSelector';

export default function Navbar({ 
  title, theme, onToggleTheme,
  cultivos, 
  cultivoElegidoId, 
  setCultivoElegidoId, 
  añoSeleccionado, 
  setAnioSeleccionado,
  aniosDisponibles,
  user,
  iaEncendida,
  menuCerrado,
  setMenuCerrado,
  vistaActual,
  setVistaActual
}) {
  return (
    <header className="navbar">
      <div className="navbar-left" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <button
          onClick={() => setMenuCerrado(!menuCerrado)}
          className="navbar-sidebar-toggle-btn"
          title={menuCerrado ? "Expandir barra lateral" : "Contraer barra lateral"}
          aria-label={menuCerrado ? "Expandir barra lateral" : "Contraer barra lateral"}
          aria-expanded={!menuCerrado}
          aria-controls="workspace-sidebar"
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
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, border-color 0.2s ease',
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
        <div className="workspace-heading"><span className="workspace-eyebrow">ZeaSys / Centro de cultivo</span><h2 className="navbar-title" style={{ margin: 0 }}>{title}</h2></div>
      </div>
      
      <div className="navbar-right">
        <button type="button" className="workspace-theme-switch" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        {/* ML Engine Status */}
        <div className="status-indicator" role="status" aria-label={iaEncendida ? "Servidor de IA conectado" : "Servidor de IA desconectado"} title={iaEncendida ? "Servidor de IA responde" : "Servidor de IA desconectado"}>
          <Cpu size={15} className={iaEncendida ? "text-success" : "text-danger"} />
          <span className="ia-status-label">IA</span>
          <span className={`status-dot ${iaEncendida ? "active" : "inactive"}`} />
        </div>

        {/* Lote & Year Selector — Premium Panel (only visible on DSS views) */}
        {['yield', 'scenarios', 'climate', 'finance'].includes(vistaActual) && (
          <LoteSelector
            cultivos={cultivos}
            cultivoElegidoId={cultivoElegidoId}
            setCultivoElegidoId={setCultivoElegidoId}
            añoSeleccionado={añoSeleccionado}
            setAnioSeleccionado={setAnioSeleccionado}
            aniosDisponibles={aniosDisponibles}
            vistaActual={vistaActual}
            setVistaActual={setVistaActual}
          />
        )}

        {/* User & Settings Button Integrated */}
        {user && (
          <div className="workspace-account">
            <button 
              onClick={() => setVistaActual(vistaActual === 'configuracion' ? 'yield' : 'configuracion')}
              className={`lote-selector-trigger workspace-account-trigger ${vistaActual === 'configuracion' ? 'active' : ''}`}
              title="Configuración de Cuenta y Sistema"
              aria-label={`Configuración de cuenta de ${user.nombre}`}
              type="button"
            >
              <div className="workspace-account-avatar"
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  overflow: 'hidden', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'var(--zs-raised)',
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
    </header>
  );
}
