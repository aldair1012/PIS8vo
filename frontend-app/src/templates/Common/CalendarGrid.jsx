import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

function popoverPosition(rect) {
  const width = Math.min(330, window.innerWidth - 40);
  const center = rect.left + rect.width / 2;
  const left = Math.max(width / 2 + 20, Math.min(window.innerWidth - width / 2 - 20, center));
  const openAbove = rect.top > window.innerHeight * .45;
  return {width,left,openAbove,top:openAbove?Math.max(20,rect.top-8):Math.min(window.innerHeight-200,rect.bottom+8)};
}

export default function CalendarGrid({ events = [], initialDate = new Date(), title = "", referenceYear = null, legendItems, eventDetailLabel, resetToInitial = false, fillHeight = true, embedded = false }) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedCell, setSelectedCell] = useState(null);
  const [popoverData, setPopoverData] = useState(null);
  const calendarRef = useRef(null);
  const eventTriggerRef = useRef(null);

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
    const escape = event => { if (event.key === 'Escape' && popoverData) { setPopoverData(null); eventTriggerRef.current?.focus(); } };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', handleOutsideClick); document.removeEventListener('keydown', escape); };
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
    const firstEvent = resetToInitial ? events.find(event => event.start instanceof Date && !Number.isNaN(event.start.getTime())) : null;
    const eventDate = firstEvent ? new Date(firstEvent.start.getFullYear(),firstEvent.start.getMonth(),1) : initialDate;
    setCurrentDate(resetToInitial ? eventDate : referenceYear === null ? now : new Date(referenceYear,now.getMonth(),1));
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

  const getEventBadgeStyle = colorName => {
    const token=({harvest:'warning',info:'info',success:'success',warning:'warning',danger:'danger'})[colorName] || 'info';
    const ink=`var(--zs-${token})`;
    return {bg:`color-mix(in srgb, ${ink} 10%, var(--zs-surface))`,text:ink,border:'var(--zs-border-strong)',bar:ink};
  };

  useEffect(() => {
    const handleScrollOrResize = (event) => {
      if (event.target instanceof Element && event.target.closest('.calendar-popover-portal')) return;
      const rect = eventTriggerRef.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) { setPopoverData(null);return; }
      setPopoverData(current => current ? {...current,...popoverPosition(rect)} : current);
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

    eventTriggerRef.current = e.currentTarget;
    setPopoverData({cell,events:dateEvents,...popoverPosition(e.currentTarget.getBoundingClientRect())});
  };


  return (
    <div
      ref={calendarRef}
      className={embedded ? 'calendar-grid' : 'glass-panel'}
      style={{
        padding: embedded ? 0 : '0.85rem 1rem 1rem 1rem',
        width: '100%',
        height: fillHeight ? '100%' : 'auto',
        minHeight: '380px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        borderRadius: embedded ? 0 : '16px',
        boxShadow: embedded ? 'none' : 'var(--zs-shadow-raised)'
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
            background: 'var(--zs-inset-surface)',
            color: 'var(--zs-accent)',
            padding: '0.4rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CalendarIcon size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {monthNames[month]} <span style={{ fontWeight: 500, color: 'var(--text-subtle)' }}>{year}</span>
            </h3>
            {title && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.1rem 0 0 0' }}>{title}</p>}
            {events.length === 0 && <p role="status" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.1rem 0 0 0' }}>Sin datos para este periodo.</p>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            onClick={handleToday}
            style={{
              padding: '0.5rem 0.75rem',
              minHeight: '44px',
              fontSize: '0.875rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-elevated)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            {resetToInitial ? 'Con fechas' : referenceYear === null ? 'Hoy' : 'Mes actual'}
          </button>

          <div style={{ display: 'flex', gap: '0.2rem', background: 'var(--surface-elevated)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={handlePrevMonth}
              disabled={referenceYear !== null && month === 0}
              aria-label="Mes anterior"
              style={{
                width: '44px',
                height: '44px',
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
              disabled={referenceYear !== null && month === 11}
              aria-label="Mes siguiente"
              style={{
                width: '44px',
                height: '44px',
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

      {events.length>0&&<p style={{fontSize:14,lineHeight:1.5,color:'var(--zs-muted)',margin:'0 0 12px'}}>Pulsa un día marcado con «Ver» para consultar sus fechas.</p>}

      {/* Weekdays Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        textAlign: 'center',
        fontWeight: 700,
        fontSize: '0.875rem',
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
        gap: referenceYear === null ? '5px' : '2px',
        flex: 1
      }}>
        {cells.map((cell, index) => {
          const dateEvents = getEventsForDate(cell.date);
          const isToday = new Date().toDateString() === cell.date.toDateString();
          const isSelected = selectedCell && selectedCell.date.toDateString() === cell.date.toDateString();
          const hasEvents = dateEvents.length > 0;

          const cellBg=isSelected?'var(--zs-raised)':cell.isCurrentMonth?'var(--zs-surface)':'var(--zs-inset-surface)';
          const numberColor=isToday?'var(--zs-accent)':cell.isCurrentMonth?'var(--zs-text)':'var(--zs-muted)';

          return (
            <button type="button"
              key={index}
              className="calendar-day-cell"
              disabled={!hasEvents}
              aria-label={`${cell.date.toLocaleDateString('es-EC',{day:'numeric',month:'long',year:'numeric'})}${hasEvents ? `: ${dateEvents.map(event=>event.title).join('; ')}` : ': sin evento registrado'}`}
              aria-expanded={hasEvents ? Boolean(popoverData && isSelected) : undefined}
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
                  ? '2px solid var(--zs-accent)'
                  : (isSelected
                      ? '2px solid var(--zs-focus)'
                      : '1px solid var(--zs-border)'),
                borderRadius: '8px',
                position: 'relative',
                cursor: 'pointer',
                boxShadow: isToday ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none'
              }}
            >
              {/* Day Number */}
              <span style={{
                fontSize: '0.875rem',
                fontWeight: isToday || isSelected || hasEvents ? 800 : 600,
                color: numberColor,
                lineHeight: 1
              }}>
                {cell.dayNum}
              </span>

              {/* Status Badge Chip */}
              {hasEvents ? (
                dateEvents.slice(0, 1).map((evt, idx) => {
                  const label = 'Ver';
                  const bStyle = getEventBadgeStyle(evt.color);

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
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: bStyle.text,
                        textTransform: 'none',
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
            </button>
          );
        })}
      </div>

      {popoverData && (() => {
        return createPortal(
          <div
            className="calendar-popover-portal"
            role="status"
            aria-label={eventDetailLabel || (referenceYear === null ? 'Detalle del evento de la simulación' : 'Detalle de la referencia de siembra')}
            style={{
              position: 'fixed', left: popoverData.left, top: popoverData.top,
              width: popoverData.width, maxHeight: 'min(320px, 50dvh)', overflowY: 'auto',
              transform: popoverData.openAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
              zIndex: 1002, padding: 16, borderRadius: 16,
              background: 'var(--zs-surface)',
              color: 'var(--zs-text)',
              border: '1px solid var(--zs-border-strong)',
              boxShadow: '0 16px 42px #0004',
            }}
          >
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
              <strong style={{fontSize:14,lineHeight:1.5}}>{popoverData.cell.date.toLocaleDateString('es-EC',{day:'numeric',month:'long',year:'numeric'})}</strong>
              <button type="button" onClick={()=>{setPopoverData(null);eventTriggerRef.current?.focus();}} aria-label="Cerrar información" style={{flex:'0 0 44px',width:44,height:44,margin:'-10px -10px 0 0',border:0,borderRadius:10,background:'transparent',color:'inherit',cursor:'pointer'}}>×</button>
            </div>
            {popoverData.events.map((event,index)=>{
              const badge=getEventBadgeStyle(event.color);
              const description=typeof event.description==='string'?event.description.replace(/\s*\|\s*/g,' · ').trim():'';
              return <div key={`${event.title}:${index}`} style={{borderTop:'1px solid var(--zs-border)',paddingTop:12,marginTop:12}}><strong style={{display:'block',color:badge.text,fontSize:14,lineHeight:1.5}}>{event.title||event.etapa||'Evento del cultivo'}</strong>{description&&<p style={{margin:'8px 0 0',fontSize:14,lineHeight:1.6,color:'inherit'}}>{description}</p>}</div>;
            })}
          </div>,
          document.querySelector('.zeasys-workspace') || document.body
        );
      })()}

      {/* Legend Badges at Bottom */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.85rem',
        marginTop: '0.85rem',
        fontSize: '0.875rem',
        color: 'var(--text-muted)',
        justifyContent: 'center',
        padding: '0.4rem 0.2rem 0 0.2rem',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        {(legendItems ?? (referenceYear !== null ? [{color:'var(--zs-info)',label:'Referencia de catálogo; no evalúa condiciones futuras'}] : [
          { color: 'var(--zs-accent)', label: 'Evento registrado' },
          { color: 'var(--zs-warning)', label: 'Precaución' },
          { color: 'var(--zs-danger)', label: 'Alerta' }
        ])).map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '8px', height: '8px', background: item.color, borderRadius: '50%', boxShadow: 'none' }}></div>
            <span style={{ fontWeight: 600 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
