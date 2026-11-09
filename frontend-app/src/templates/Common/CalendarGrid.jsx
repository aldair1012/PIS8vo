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

    const popoverWidth = Math.min(330, windowWidth - 32);
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

      {popoverData && (() => {
        const evt = popoverData.events[0];
        const badge = getEventBadgeStyle(evt?.color, isLight);
        const description = typeof evt?.description === 'string'
          ? evt.description.replace(/\s*\|\s*/g, ' · ').trim()
          : 'Consulta el evento seleccionado de esta simulación.';
        return createPortal(
          <aside
            className="calendar-popover-portal"
            role="status"
            aria-label="Detalle del evento de la simulación"
            style={{
              position: 'fixed', left: popoverData.left, top: popoverData.top,
              width: popoverData.width, maxHeight: 'min(320px, 50dvh)', overflowY: 'auto',
              transform: popoverData.openAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
              zIndex: 1002, padding: 16, borderRadius: 16,
              background: isLight ? '#fff' : '#1b2a22',
              color: isLight ? '#173b2c' : '#effaf3',
              border: `1px solid ${isLight ? '#bdd4c4' : '#536d5b'}`,
              boxShadow: '0 16px 42px #0004',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ flex: 1, color: badge.text, fontSize: 12, fontWeight: 750 }}>
                {evt?.title || evt?.etapa || 'Evento del cultivo'}
              </span>
              <button type="button" onClick={() => setPopoverData(null)} aria-label="Cerrar información" style={{ flex: '0 0 44px', width: 44, height: 44, margin: '-10px -10px 0 0', border: 0, borderRadius: 10, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.55, color: 'inherit' }}>{description}</p>
          </aside>,
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
