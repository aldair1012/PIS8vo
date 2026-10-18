import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export default function CalendarGrid({ events = [], initialDate = new Date(), title = "" }) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedCell, setSelectedCell] = useState(null);
  const [popoverData, setPopoverData] = useState(null);
  const calendarRef = useRef(null);

  useEffect(() => {
    const reset = setTimeout(() => {
      setCurrentDate(initialDate);
      setPopoverData(null);
      setSelectedCell(null);
    }, 0);
    return () => clearTimeout(reset);
  }, [initialDate]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoverData && !e.target.closest('.calendar-popover-portal') && !e.target.closest('.calendar-day-cell')) {
        setPopoverData(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [popoverData]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getStartDayOfWeek = (y, m) => new Date(y, m, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedCell(null);
    setPopoverData(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedCell(null);
    setPopoverData(null);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedCell(null);
    setPopoverData(null);
  };

  const generateCells = () => {
    const cells = [];
    const startDay = getStartDayOfWeek(year, month);
    const totalDays = getDaysInMonth(year, month);

    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthTotalDays = getDaysInMonth(prevYear, prevMonth);
    
    for (let i = startDay - 1; i >= 0; i--) {
      cells.push({
        date: new Date(prevYear, prevMonth, prevMonthTotalDays - i),
        isCurrentMonth: false,
        dayNum: prevMonthTotalDays - i
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
        dayNum: i
      });
    }

    const totalCellsNeeded = 42;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const remaining = totalCellsNeeded - cells.length;
    
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(nextYear, nextMonth, i),
        isCurrentMonth: false,
        dayNum: i
      });
    }

    return cells;
  };

  const cells = generateCells();

  const getEventsForDate = (date) => {
    const cellTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return events.filter((event) => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
      const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
      return cellTime >= startTime && cellTime <= endTime;
    });
  };

  const getEventBadgeStyle = (colorName, isLight) => {
    switch(colorName) {
      case 'success': 
        return {
          bg: isLight ? '#dcfce7' : 'rgba(34, 197, 94, 0.22)',
          text: isLight ? '#15803d' : '#86efac',
          border: isLight ? '#86efac' : 'rgba(34, 197, 94, 0.45)',
          bar: '#10b981'
        };
      case 'warning': 
        return {
          bg: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.22)',
          text: isLight ? '#b45309' : '#fde047',
          border: isLight ? '#fde047' : 'rgba(245, 158, 11, 0.45)',
          bar: '#f59e0b'
        };
      case 'danger': 
        return {
          bg: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.22)',
          text: isLight ? '#b91c1c' : '#fca5a5',
          border: isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.45)',
          bar: '#ef4444'
        };
      default: 
        return {
          bg: isLight ? '#dcfce7' : 'rgba(34, 197, 94, 0.22)',
          text: isLight ? '#15803d' : '#86efac',
          border: isLight ? '#86efac' : 'rgba(34, 197, 94, 0.45)',
          bar: '#10b981'
        };
    }
  };

  useEffect(() => {
    const handleScrollOrResize = () => {
      setPopoverData(null);
    };
    if (popoverData) {
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [popoverData]);

  const handleCellClick = (e, cell, dateEvents) => {
    e.stopPropagation();
    if (dateEvents.length === 0) {
      setPopoverData(null);
      return;
    }

    const cellRect = e.currentTarget.getBoundingClientRect();
    const windowWidth = typeof window !== 'undefined' ? (window.innerWidth || 1200) : 1200;
    const windowHeight = typeof window !== 'undefined' ? (window.innerHeight || 800) : 800;

    const cellCenterLeft = cellRect.left + cellRect.width / 2;
    // Si la casilla está en la mitad inferior (45%), se abre hacia arriba
    const openAbove = cellRect.top > (windowHeight * 0.45);

    const evt = dateEvents[0];
    const isLongContent = (evt?.description && (evt.description.length > 75 || evt.description.includes('|')));
    const popoverWidth = Math.min(isLongContent ? 640 : 420, windowWidth - 40);
    const halfWidth = popoverWidth / 2;

    // Garantizar estrictamente que la tarjeta flotante quede a mínimo 20px de los bordes izquierdo y derecho
    let leftPos = cellCenterLeft;
    if (leftPos - halfWidth < 20) {
      leftPos = halfWidth + 20;
    } else if (leftPos + halfWidth > windowWidth - 20) {
      leftPos = windowWidth - halfWidth - 20;
    }

    let topPos;
    if (openAbove) {
      topPos = Math.max(20, cellRect.top - 8);
    } else {
      topPos = Math.min(windowHeight - 200, cellRect.bottom + 8);
    }

    // La flecha siempre apunta directamente al centro del día cliqueado
    const arrowLeft = Math.max(24, Math.min(popoverWidth - 24, cellCenterLeft - (leftPos - halfWidth)));

    setPopoverData({
      cell,
      events: dateEvents,
      left: leftPos,
      top: topPos,
      openAbove,
      arrowLeft,
      width: popoverWidth
    });
  };

  const renderCalendarDescription = (rawText) => {
    if (!rawText) return <div style={{ fontSize: '0.75rem', color: isLight ? '#334155' : 'rgba(255,255,255,0.85)' }}>Ventana climáticamente adecuada para la germinación y desarrollo del cultivo.</div>;
    if (typeof rawText !== 'string') return rawText;

    let text = rawText.trim();

    if (text.includes('|') || /(?:Suelo|Densidad|Riego|Plagas|Bajo Riesgo|Riesgo Alto|Umbral|Control):/i.test(text)) {
      let segments = [];
      
      if (text.includes('|')) {
        const firstPipe = text.indexOf('|');
        let intro = text.substring(0, firstPipe).trim();
        let rest = text.substring(firstPipe + 1).trim();

        const keyValMatches = [];
        const keyRegex = /(Suelo|Densidad objetivo|Densidad|Riego|Plagas clave|Patógenos|Bajo Riesgo|Riesgo Alto|Umbral|Control):\s*/gi;
        let match;
        while ((match = keyRegex.exec(intro)) !== null) {
          keyValMatches.push({ label: match[1], index: match.index, endIndex: match.index + match[0].length });
        }

        if (keyValMatches.length > 0) {
          for (let i = 0; i < keyValMatches.length; i++) {
            const curr = keyValMatches[i];
            const next = keyValMatches[i + 1];
            const val = intro.substring(curr.endIndex, next ? next.index : intro.length).trim().replace(/\.$/, '');
            if (val) segments.push(`${curr.label}: ${val}`);
          }
        } else if (intro) {
          segments.push(intro);
        }

        const pipeItems = rest.split('|').map(s => s.trim()).filter(Boolean);
        segments.push(...pipeItems);
      } else {
        const keyRegex = /(Suelo|Densidad objetivo|Densidad|Riego|Plagas clave|Patógenos|Bajo Riesgo|Riesgo Alto|Umbral|Control):\s*/gi;
        const keyValMatches = [];
        let match;
        while ((match = keyRegex.exec(text)) !== null) {
          keyValMatches.push({ label: match[1], index: match.index, endIndex: match.index + match[0].length });
        }
        for (let i = 0; i < keyValMatches.length; i++) {
          const curr = keyValMatches[i];
          const next = keyValMatches[i + 1];
          const val = text.substring(curr.endIndex, next ? next.index : text.length).trim().replace(/\.$/, '');
          if (val) segments.push(`${curr.label}: ${val}`);
        }
      }

      if (segments.length > 0) {
        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: segments.length >= 3 ? 'repeat(auto-fit, minmax(250px, 1fr))' : '1fr',
            gap: '0.45rem',
            margin: '0.3rem 0 0.65rem 0'
          }}>
            {segments.map((seg, idx) => {
              const colonIdx = seg.indexOf(':');
              let label = '';
              let val = seg;
              if (colonIdx > 0 && colonIdx < 35) {
                label = seg.substring(0, colonIdx + 1);
                val = seg.substring(colonIdx + 1).trim();
              }

              return (
                <div key={idx} style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                  padding: '0.45rem 0.65rem',
                  background: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '7px',
                  border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.09)',
                  fontSize: '0.73rem',
                  lineHeight: '1.4'
                }}>
                  <span style={{
                    color: '#38bdf8',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    lineHeight: 1,
                    marginTop: '2px',
                    flexShrink: 0
                  }}>•</span>
                  <div style={{ color: isLight ? '#0f172a' : '#f1f5f9', flex: 1 }}>
                    {label ? (
                      <>
                        <strong style={{ color: '#38bdf8', fontWeight: 700 }}>{label}</strong>{' '}
                        {val}
                      </>
                    ) : (
                      val
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    }

    return (
      <div style={{ color: isLight ? '#334155' : 'rgba(255,255,255,0.88)', fontSize: '0.75rem', marginBottom: '0.65rem', lineHeight: 1.45 }}>
        {text}
      </div>
    );
  };

  const isLight = typeof document !== 'undefined' && document.body.classList.contains('light-theme');

  return (
    <div 
      ref={calendarRef} 
      className="glass-panel" 
      style={{ 
        padding: '0.85rem 1rem 1rem 1rem', 
        width: '100%', 
        height: '100%',
        minHeight: '380px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        borderRadius: '16px',
        boxShadow: isLight ? '0 8px 24px rgba(13, 13, 13, 0.03)' : '0 10px 30px rgba(0, 0, 0, 0.25)'
      }}
    >
      {/* Sleek Header Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '0.75rem',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '0.6rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            background: isLight ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.2)',
            color: '#10b981',
            padding: '0.4rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CalendarIcon size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {monthNames[month]} <span style={{ fontWeight: 500, color: 'var(--text-subtle)' }}>{year}</span>
            </h3>
            {title && <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0.1rem 0 0 0' }}>{title}</p>}
            {events.length === 0 && <p role="status" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0.1rem 0 0 0' }}>Sin datos para este periodo.</p>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            onClick={handleToday}
            style={{
              padding: '0.25rem 0.55rem',
              fontSize: '0.68rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-elevated)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Hoy
          </button>

          <div style={{ display: 'flex', gap: '0.2rem', background: 'var(--surface-elevated)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button 
              onClick={handlePrevMonth}
              style={{
                width: '26px',
                height: '26px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Mes Anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <button 
              onClick={handleNextMonth}
              style={{
                width: '26px',
                height: '26px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Mes Siguiente"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Weekdays Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        textAlign: 'center', 
        fontWeight: 700, 
        fontSize: '0.68rem', 
        color: 'var(--text-subtle)',
        marginBottom: '0.4rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
      }}>
        {dayNames.map(d => (
          <div key={d} style={{ padding: '0.2rem 0' }}>{d}</div>
        ))}
      </div>

      {/* Days Grid - Expandido Proporcionalmente */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gridTemplateRows: 'repeat(6, 1fr)',
        gap: '5px',
        flex: 1
      }}>
        {cells.map((cell, index) => {
          const dateEvents = getEventsForDate(cell.date);
          const isToday = new Date().toDateString() === cell.date.toDateString();
          const isSelected = selectedCell && selectedCell.date.toDateString() === cell.date.toDateString();
          const hasEvents = dateEvents.length > 0;
          
          let cellBg;
          if (isLight) {
            cellBg = cell.isCurrentMonth
              ? (isSelected ? '#e0f2fe' : (isToday ? '#f0fdf4' : '#ffffff'))
              : '#f8fafc';
          } else {
            cellBg = cell.isCurrentMonth
              ? (isSelected ? 'rgba(59, 130, 246, 0.25)' : (isToday ? 'rgba(34, 197, 94, 0.15)' : 'var(--surface-elevated)'))
              : 'rgba(15, 23, 42, 0.15)';
          }

          let numberColor;
          if (isToday) {
            numberColor = '#10b981';
          } else if (isSelected) {
            numberColor = '#3b82f6';
          } else if (cell.isCurrentMonth) {
            numberColor = isLight ? '#0d0d0d' : 'rgba(255,255,255,0.92)';
          } else {
            numberColor = isLight ? '#94a3b8' : 'rgba(255,255,255,0.3)';
          }

          return (
            <div 
              key={index} 
              onClick={(e) => {
                setSelectedCell(cell);
                handleCellClick(e, cell, dateEvents);
              }}
              style={{
                background: cellBg,
                padding: '0.35rem 0.2rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '100%',
                minHeight: '44px',
                border: isToday 
                  ? '2px solid #10b981' 
                  : (isSelected 
                      ? '2px solid #3b82f6' 
                      : (isLight ? '1px solid rgba(13, 13, 13, 0.08)' : '1px solid var(--border-subtle)')),
                borderRadius: '8px',
                position: 'relative',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                boxShadow: isToday ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none'
              }}
              className="calendar-day-cell"
            >
              {/* Day Number */}
              <span style={{ 
                fontSize: '0.74rem', 
                fontWeight: isToday || isSelected || hasEvents ? 800 : 600,
                color: numberColor,
                lineHeight: 1
              }}>
                {cell.dayNum}
              </span>

              {/* Status Badge Chip */}
              {hasEvents ? (
                dateEvents.slice(0, 1).map((evt, idx) => {
                  const label = evt.color === 'danger' ? 'alerta' : (evt.color === 'warning' ? 'precaución' : 'evento');
                  const bStyle = getEventBadgeStyle(evt.color, isLight);

                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        width: '92%', 
                        background: bStyle.bg,
                        border: `1px solid ${bStyle.border}`,
                        borderRadius: '4px',
                        padding: '1px 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px'
                      }}
                    >
                      <span style={{ 
                        fontSize: '0.58rem', 
                        fontWeight: 800, 
                        color: bStyle.text,
                        textTransform: 'lowercase',
                        lineHeight: 1
                      }}>
                        {label}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ height: '12px' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Popover Modal Card — Renderizado vía React Portal para evitar contención de backdrop-filter */}
      {popoverData && (() => {
        const popoverWidth = popoverData.width || 410;
        const leftPos = popoverData.left;
        const arrowLeft = popoverData.arrowLeft;
        const openAbove = popoverData.openAbove;
        const evt = popoverData.events[0];
        const bStyle = getEventBadgeStyle(evt?.color, isLight);
        const popBg = isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.96)';

        return createPortal(
          <div 
            className="calendar-popover-portal"
            style={{
              position: 'fixed',
              left: `${leftPos}px`,
              top: `${popoverData.top}px`,
              width: `${popoverWidth}px`,
              maxHeight: 'calc(100vh - 40px)',
              overflowY: 'auto',
              transform: openAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
              background: popBg,
              border: `1.5px solid ${bStyle.border}`,
              borderRadius: '14px',
              padding: '0.85rem 1rem',
              boxShadow: isLight 
                ? '0 16px 36px rgba(15, 23, 42, 0.25)' 
                : '0 24px 55px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              zIndex: 999999,
              color: isLight ? '#0f172a' : '#fff',
              fontSize: '0.78rem',
              lineHeight: '1.4',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              animation: 'fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Popover Arrow */}
            <div style={{
              position: 'absolute',
              top: openAbove ? 'auto' : '-6px',
              bottom: openAbove ? '-6px' : 'auto',
              left: `${arrowLeft}px`,
              transform: 'translateX(-50%) rotate(45deg)',
              width: '11px',
              height: '11px',
              background: popBg,
              borderLeft: openAbove ? 'none' : `1.5px solid ${bStyle.border}`,
              borderTop: openAbove ? 'none' : `1.5px solid ${bStyle.border}`,
              borderRight: openAbove ? `1.5px solid ${bStyle.border}` : 'none',
              borderBottom: openAbove ? `1.5px solid ${bStyle.border}` : 'none',
              zIndex: 1
            }} />

            {/* Popover Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  background: bStyle.bg,
                  color: bStyle.text,
                  border: `1px solid ${bStyle.border}`,
                  letterSpacing: '0.02em'
                }}>
                  <span style={{ 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    background: bStyle.bar,
                    boxShadow: `0 0 6px ${bStyle.bar}`
                  }} />
                  {(() => {
                    const cName = evt?.color;
                    if (cName === 'danger') return 'Alerta informada';
                    if (cName === 'warning') return 'Precaución informada';
                    return 'Evento informado';
                  })()}
                </span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setPopoverData(null);
                }}
                style={{
                  background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isLight ? '#64748b' : 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  transition: 'all 0.15s ease'
                }}
              >
                ✕
              </button>
            </div>

            {/* Formatted Agronomic Description / Bullet Cards */}
            {renderCalendarDescription(evt?.description)}

            {evt?.color && (
              <div role="note" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Clasificación informada: {evt.color === 'danger' ? 'alerta' : (evt.color === 'warning' ? 'precaución' : 'evento')}
              </div>
            )}
          </div>,
          document.body
        );
      })()}

      {/* Legend Badges at Bottom */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '0.85rem', 
        marginTop: '0.85rem', 
        fontSize: '0.72rem', 
        color: 'var(--text-muted)',
        justifyContent: 'center',
        padding: '0.4rem 0.2rem 0 0.2rem',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        {[
          { color: '#10b981', label: 'Evento favorable' },
          { color: '#f59e0b', label: 'Precaución' },
          { color: '#ef4444', label: 'Alerta' }
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '8px', height: '8px', background: item.color, borderRadius: '50%', boxShadow: `0 0 6px ${item.color}60` }}></div>
            <span style={{ fontWeight: 600 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
