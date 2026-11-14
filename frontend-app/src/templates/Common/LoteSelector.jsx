import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  Search, 
  Sprout, 
  Grid, 
  MapPin, 
  Layers, 
  Plus, 
  Calendar,
  X,
  Check
} from 'lucide-react';

/**
 * LoteSelector — Premium dropdown panel for selecting parcelas/lotes and year.
 * Replaces the native <select> dropdowns in the Navbar.
 * Reuses visual language from the lote-card styles in Cultivos.jsx.
 * 
 * Props:
 *  - cultivos: Array of cultivo objects
 *  - cultivoElegidoId: Currently selected cultivo ID
 *  - setCultivoElegidoId: Setter for selected cultivo
 *  - añoSeleccionado: Currently selected year
 *  - setAnioSeleccionado: Setter for selected year
 *  - setVistaActual: Navigation setter (to go to 'cultivos' view)
 */
export default function LoteSelector({
  cultivos,
  cultivoElegidoId,
  setCultivoElegidoId,
  añoSeleccionado,
  setAnioSeleccionado,
  aniosDisponibles,
  vistaActual,
  setVistaActual
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  const cultivoActivo = cultivos.find(c => c.id === cultivoElegidoId);
  
  // Extraer dinámicamente todos los años únicos de las parcelas del usuario
  const years = React.useMemo(() => {
    const yearSet = new Set();
    if (Array.isArray(aniosDisponibles)) for (const year of aniosDisponibles) if (Number.isInteger(year) && year >= 2000 && year <= 2100) yearSet.add(year);
    const currentYear = new Date().getFullYear();

    (cultivos || []).forEach(c => {
      let y = null;
      if (c.fecha_siembra) {
        const parsedY = parseInt(String(c.fecha_siembra).substring(0, 4), 10);
        if (!isNaN(parsedY) && parsedY > 2000) y = parsedY;
      }
      if (!y && c.fecha_registro) {
        const parsedY = parseInt(String(c.fecha_registro).substring(0, 4), 10);
        if (!isNaN(parsedY) && parsedY > 2000) y = parsedY;
      }
      if (!y && c.created_at) {
        const parsedY = parseInt(String(c.created_at).substring(0, 4), 10);
        if (!isNaN(parsedY) && parsedY > 2000) y = parsedY;
      }
      if (y) yearSet.add(y);
    });

    // Si aún no hay parcelas registradas, mostrar el año actual
    if (yearSet.size === 0) {
      yearSet.add(currentYear);
    }

    // Asegurar que el año seleccionado actualmente esté presente
    if (!['yield','scenarios'].includes(vistaActual) && añoSeleccionado) {
      yearSet.add(Number(añoSeleccionado));
    }

    return Array.from(yearSet).sort((a, b) => a - b);
  }, [cultivos, añoSeleccionado, vistaActual, aniosDisponibles]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isOpen &&
        panelRef.current && !panelRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Los lotes siguen disponibles aunque se simulen en un año distinto al de
  // su registro o siembra. El año sólo filtra los datos del dashboard.
  const filteredCultivos = cultivos.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.nombre_parcela || '').toLowerCase().includes(q) ||
      (c.ubicacion || '').toLowerCase().includes(q) ||
      (c.variedad_maiz || '').toLowerCase().includes(q)
    );
  });

  const handleSelectLote = (id) => {
    setCultivoElegidoId(id);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleAddField = () => {
    setIsOpen(false);
    setSearchQuery('');
    setVistaActual('cultivos');
  };

  return (
    <div className="lote-selector-wrapper">
      {/* Trigger Button */}
      <button 
        ref={triggerRef}
        className={`lote-selector-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={['yield','scenarios'].includes(vistaActual) ? 'Seleccionar parcela' : 'Seleccionar parcela y año'}
        aria-label={cultivoActivo ? `Seleccionar parcela. Actual: ${cultivoActivo.nombre_parcela}` : 'Seleccionar parcela'}
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'selector-parcelas' : undefined}
        type="button"
      >
        <div className="lote-selector-trigger-icon">
          <Sprout size={15} />
        </div>
        <div className="lote-selector-trigger-text">
          <span className="lote-selector-trigger-label">
            {cultivoActivo ? cultivoActivo.nombre_parcela : 'Sin lotes'}
          </span>
          <span className="lote-selector-trigger-sub">
            {cultivoActivo 
              ? `${cultivoActivo.area} ha${['yield','scenarios'].includes(vistaActual) ? '' : ` · ${añoSeleccionado}`}`
              : 'Elige un lote'
            }
          </span>
        </div>
        <ChevronDown 
          size={16} 
          className="lote-selector-chevron" 
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', 
            transition: 'transform 0.25s ease' 
          }} 
        />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="lote-selector-backdrop"
          onClick={() => { setIsOpen(false); setSearchQuery(''); }}
        />
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div ref={panelRef} id="selector-parcelas" role="dialog" aria-label="Seleccionar parcela" className="lote-selector-panel">
          {/* Panel Header */}
          <div className="lote-selector-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={16} className="text-success" />
              <h3 className="lote-selector-panel-title">Mis Parcelas</h3>
              <span className="lote-selector-count">{cultivos.length}</span>
            </div>
            <button 
              className="lote-selector-close" 
              type="button"
              aria-label="Cerrar selector de parcelas"
              onClick={() => { setIsOpen(false); setSearchQuery(''); triggerRef.current?.focus(); }}
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Year Selector */}
          {!['yield','scenarios'].includes(vistaActual) && <div className="lote-selector-year-row">
            <span className="lote-selector-year-label">
              <Calendar size={13} />
              Año:
            </span>
            <div className="lote-selector-year-pills">
              {years.map(y => (
                <button
                  key={y}
                  className={`lote-selector-year-pill ${añoSeleccionado === y ? 'active' : ''}`}
                  onClick={() => setAnioSeleccionado(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>}

          {/* Search */}
          <div className="lote-selector-search">
            <Search size={14} className="lote-selector-search-icon" />
            <input
              type="text"
              className="lote-selector-search-input"
              placeholder="Buscar parcela..."
              aria-label="Buscar parcela"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Cards List */}
          <div className="lote-selector-list">
            {filteredCultivos.length === 0 ? (
              <div className="lote-selector-empty">
                <Sprout size={32} style={{ color: 'var(--border-strong)', strokeWidth: 1.5 }} />
                <p>{searchQuery ? 'No se encontraron parcelas' : 'No tienes parcelas registradas'}</p>
              </div>
            ) : (
              filteredCultivos.map(c => {
                const isActive = c.id === cultivoElegidoId;
                return (
                  <button
                    key={c.id}
                    className={`lote-selector-card ${isActive ? 'selected' : ''}`}
                    onClick={() => handleSelectLote(c.id)}
                  >
                    {/* Selection indicator */}
                    {isActive && (
                      <div className="lote-selector-card-check">
                        <Check size={12} />
                      </div>
                    )}

                    {/* Card header */}
                    <div className="lote-selector-card-top">
                      <div className="lote-card-icon" style={{ width: '32px', height: '32px' }}>
                        <Sprout size={15} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 className="lote-card-title" style={{ fontSize: '0.88rem' }}>
                          {c.nombre_parcela}
                        </h4>
                        <span className="lote-card-subtitle">
                          {c.ubicacion || 'Sin ubicación'}
                        </span>
                      </div>
                    </div>

                    {/* Card info row */}
                    <div className="lote-selector-card-info">
                      <span className="lote-selector-card-tag">
                        <Layers size={11} /> {c.variedad_maiz || 'N/D'}
                      </span>
                      <span className="lote-selector-card-tag">
                        <Grid size={11} /> {c.area} ha
                      </span>
                      {c.latitud && c.longitud && (
                        <span className="lote-selector-card-tag muted">
                          <MapPin size={10} /> {Number(c.latitud).toFixed(3)}, {Number(c.longitud).toFixed(3)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer: Add new */}
          <div className="lote-selector-footer">
            <button 
              className="lote-selector-add-btn"
              onClick={handleAddField}
            >
              <Plus size={16} />
              <span>Añadir Nueva Parcela</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
