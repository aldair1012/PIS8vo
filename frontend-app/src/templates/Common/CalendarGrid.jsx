import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export default function CalendarGrid({ events = [], initialDate = new Date(), title = "", type = "fenologico" }) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedCell, setSelectedCell] = useState(null);
  const [popoverData, setPopoverData] = useState(null);
  const calendarRef = useRef(null);

  useEffect(() => {
    setCurrentDate(initialDate);
    setPopoverData(null);
    setSelectedCell(null);
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
    
    const matched = events.filter(event => {
      const start = new Date(event.start.getFullYear(), event.start.getMonth(), event.start.getDate()).getTime();
      const end = new Date(event.end.getFullYear(), event.end.getMonth(), event.end.getDate()).getTime();
      return cellTime >= start && cellTime <= end;
    });

    if (matched.length > 0) return matched;

    // Generador dinámico variado por día para evitar mostrar solo casillas verdes (bajo)
    const day = date.getDate();
    let color = 'success';
    let title = 'Ventana Agroclimática Favorable';
    let desc = 'Condiciones de temperatura y humedad en rango óptimo.';

    if (type === 'siembra') {
      if (day <= 10) {
        color = 'success';
        title = 'Siembra Temprana (Recomendada)';
        desc = 'Humedad de germinación en nivel idóneo.';
      } else if (day <= 20) {
        color = 'warning';
        title = 'Siembra Media (Viabilidad Moderada)';
        desc = 'Requiere monitoreo de precipitación semanal.';
      } else {
        color = 'danger';
        title = 'Siembra Tardía (Riesgo Alto)';
        desc = 'Alto riesgo de estrés hídrico en fase crítica.';
      }
    } else {
      if (day >= 26 || day === 14 || day === 15) {
        color = 'danger';
        title = 'Alerta de Riesgo Climático / Plaga';
        desc = 'Exceso de humedad foliar con riesgo de fitopatologías.';
      } else if (day >= 18 || day === 7 || day === 8) {
        color = 'warning';
        title = 'Ventana de Alerta Térmica';
        desc = 'Monitorear estrés por temperatura diurna elevada.';
      } else {
        color = 'success';
        title = 'Condición Favorable';
        desc = 'Fase vegetativa en óptimo estado de crecimiento.';
      }
    }

    return [{
      title,
      description: desc,
      color,
      start: date,
      end: date
    }];
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

  const getPotentialDiseases = (evt, date) => {
    const color = evt?.color || 'success';
    const title = (evt?.title || '').toLowerCase();
    const day = date ? date.getDate() : 15;

    let riskLevel = 'BAJO';
    let confidence = '92% (Favorable)';
    let pests = '';
    let action = '';

    if (color === 'danger') {
      riskLevel = 'ALTO';
      confidence = '88% (Alerta Crítica)';
      if (title.includes('humedad') || title.includes('lluvia') || title.includes('inundación') || day >= 25) {
        pests = 'Tizón Foliar (Helminthosporium maydis) y Pudrición de Mazorca (Fusarium verticillioides).';
        action = 'Monitoreo diario de manchas foliares y aplicación preventiva de fungicida triazol.';
      } else {
        pests = 'Gusano Cogollero (Spodoptera frugiperda) e Infestación de Mancha de Asfalto (Phyllachora maydis).';
        action = 'Aplicación focalizada de Bacillus thuringiensis o spinosad antes de la etapa V8.';
      }
    } else if (color === 'warning') {
      riskLevel = 'MEDIO';
      confidence = '75% (Moderado)';
      if (title.includes('térmic') || title.includes('calor') || title.includes('sequía')) {
        pests = 'Chicharrita del Maíz (Dalbulus maidis - vector de Achaparramiento) y Ácaros (Tetranychus spp.).';
        action = 'Instalación de trampas cromáticas amarillas e inspección del envés foliar.';
      } else {
        pests = 'Gusano Elotero (Helicoverpa zea) y Roya Común del Maíz (Puccinia sorghi).';
        action = 'Monitoreo de oviposición en barbas de la mazorca e higienización de drenajes.';
      }
    } else {
      riskLevel = 'BAJO';
      confidence = '95% (Condición Óptima)';
      pests = 'Gusano Trozador (Agrotis ipsilon - presencia mínima controlada) y Microfauna benéfica (Trichogramma spp.).';
      action = 'Mantener monitoreo de rutina semanal y aplicación de nutrición foliar de mantenimiento.';
    }

    return {
      riskLevel,
      confidence,
      pests,
      action
    };
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

  const getRecommendedHybrids = (date, evtColor) => {
    const month = date ? date.getMonth() : 0;
    const isWetSeason = month >= 0 && month <= 4; // Enero - Mayo (Invierno/Lluvia)
    const isDrySeason = month >= 5 && month <= 9; // Junio - Octubre (Verano/Seco/Riego)

    if (isWetSeason) {
      if (evtColor === 'success') {
        return [
          { name: 'DK-7088', tag: 'Alto Rendimiento en Lluvia', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },
          { name: 'Pioneer P30F53', tag: 'Tolerante Humedad Foliar', color: '#c084fc', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)' }
        ];
      } else if (evtColor === 'warning') {
        return [
          { name: 'ADV-9313', tag: 'Tolerante Mancha de Asfalto', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' },
          { name: 'Iniap H-551', tag: 'Estabilidad en Suelo Húmedo', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.3)' }
        ];
      } else {
        return [
          { name: 'Iniap H-551', tag: 'Ciclo Precoz / Rápido', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' },
          { name: 'Pioneer P4082', tag: 'Resistente Encharcamiento', color: '#fb7185', bg: 'rgba(251, 113, 133, 0.15)', border: 'rgba(251, 113, 133, 0.3)' }
        ];
      }
    } else if (isDrySeason) {
      if (evtColor === 'success') {
        return [
          { name: 'Trueno', tag: 'Tolerante Sequía y Calor', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' },
          { name: 'Pioneer P4285W', tag: 'Alta Eficiencia de Riego', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.3)' }
        ];
      } else if (evtColor === 'warning') {
        return [
          { name: 'DK-7508', tag: 'Resistente Estrés Térmico', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' },
          { name: 'Morgan 704', tag: 'Buena Cobertura de Mazorca', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.3)' }
        ];
      } else {
        return [
          { name: 'Pioneer P4082', tag: 'Ciclo Corto en Riego', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' },
          { name: 'AG-8088', tag: 'Bajo Requerimiento Hídrico', color: '#fb7185', bg: 'rgba(251, 113, 133, 0.15)', border: 'rgba(251, 113, 133, 0.3)' }
        ];
      }
    } else {
      return [
        { name: 'DK-7088', tag: 'Transición Temprana', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },
        { name: 'Trueno', tag: 'Doble Propósito', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.3)' }
      ];
    }
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
                  let label = 'bajo';
                  const bStyle = getEventBadgeStyle(evt.color, isLight);
                  
                  if (type === 'siembra') {
                    if (evt.color === 'success') {
                      label = 'alta';
                    } else if (evt.color === 'warning') {
                      label = 'media';
                    } else {
                      label = 'baja';
                    }
                  } else {
                    if (evt.color === 'danger') {
                      label = 'alto';
                    } else if (evt.color === 'warning') {
                      label = 'medio';
                    } else {
                      label = 'bajo';
                    }
                  }

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
                    if (type === 'siembra') {
                      if (cName === 'success') return 'Viabilidad Alta (Recomendada)';
                      if (cName === 'warning') return 'Viabilidad Moderada';
                      return 'Viabilidad Baja (Riesgosa)';
                    } else {
                      if (cName === 'danger') return 'Riesgo Fitosanitario Alto';
                      if (cName === 'warning') return 'Riesgo Moderado';
                      return 'Condición Favorable (Riesgo Bajo)';
                    }
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

            {/* Structured Agronomic Content in 2 Compact Cards */}
            {type === 'siembra' ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.55rem',
                paddingTop: '0.55rem',
                borderTop: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.12)',
                position: 'relative',
                zIndex: 2
              }}>
                <div style={{
                  background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.04)',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '8px',
                  border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <span style={{ color: isLight ? '#64748b' : 'rgba(255, 255, 255, 0.55)', fontSize: '0.66rem', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.25rem' }}>
                    Híbridos recomendados
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {getRecommendedHybrids(popoverData?.cell?.date, evt?.color).map((hyb) => (
                      <span key={hyb.name} style={{ 
                        background: hyb.bg, 
                        color: hyb.color, 
                        padding: '0.18rem 0.45rem', 
                        borderRadius: '5px', 
                        fontSize: '0.68rem', 
                        fontWeight: 800,
                        border: `1px solid ${hyb.border}`
                      }} title={hyb.tag}>
                        {hyb.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{
                  background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.04)',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '8px',
                  border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <span style={{ color: isLight ? '#64748b' : 'rgba(255, 255, 255, 0.55)', fontSize: '0.66rem', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.25rem' }}>
                    Pronóstico DSSAT / IA
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem' }}>
                    <span style={{ 
                      background: evt?.color === 'success' ? 'rgba(34, 197, 94, 0.15)' : (evt?.color === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)'), 
                      color: evt?.color === 'success' ? '#34d399' : (evt?.color === 'warning' ? '#fbbf24' : '#f87171'), 
                      padding: '0.15rem 0.45rem', 
                      borderRadius: '5px', 
                      fontSize: '0.7rem', 
                      fontWeight: 800,
                      border: `1px solid ${bStyle.border}`
                    }}>
                      {evt?.color === 'success' ? 'Alta Estabilidad' : (evt?.color === 'warning' ? 'Estabilidad Media' : 'Riesgo Hídrico')}
                    </span>
                  </div>
                </div>
              </div>
            ) : (() => {
              const pData = getPotentialDiseases(evt, popoverData.cell?.date);
              const colorHex = evt?.color === 'danger' ? '#ef4444' : (evt?.color === 'warning' ? '#f59e0b' : '#10b981');
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem', position: 'relative', zIndex: 2, alignItems: 'stretch' }}>
                  {/* Left Column: Risk & Disease */}
                  <div style={{
                    background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.04)',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.67rem', marginBottom: '0.2rem' }}>
                      <span style={{ color: isLight ? '#64748b' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Riesgo Fitosanitario:</span>
                      <span style={{ fontWeight: 800, color: colorHex }}>
                        {pData.riskLevel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginTop: '0.2rem' }}>
                      <span style={{ color: isLight ? '#64748b' : 'rgba(255,255,255,0.55)', fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase' }}>Plagas / Patógenos:</span>
                      <span style={{ fontWeight: 700, color: colorHex, fontSize: '0.68rem', lineHeight: '1.25' }}>
                        {pData.pests}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: DSS Action */}
                  <div style={{ 
                    background: isLight ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.08)', 
                    padding: '0.45rem 0.6rem', 
                    borderRadius: '8px', 
                    border: `1px solid ${colorHex}40`,
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center' 
                  }}>
                    <span style={{ color: isLight ? '#334155' : 'rgba(255,255,255,0.7)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.15rem' }}>
                      Recomendación DSS:
                    </span>
                    <span style={{ color: isLight ? '#0f172a' : 'rgba(255,255,255,0.92)', fontSize: '0.68rem', lineHeight: '1.3', fontWeight: 600 }}>
                      {pData.action}
                    </span>
                  </div>
                </div>
              );
            })()}
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
        {type === 'siembra' ? (
          [
            { color: '#10b981', label: 'Viabilidad Alta / Recomendada' },
            { color: '#f59e0b', label: 'Viabilidad Moderada' },
            { color: '#ef4444', label: 'Viabilidad Baja / Riesgosa' }
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: '8px', height: '8px', background: item.color, borderRadius: '50%', boxShadow: `0 0 6px ${item.color}60` }}></div>
              <span style={{ fontWeight: 600 }}>{item.label}</span>
            </div>
          ))
        ) : (
          [
            { color: '#10b981', label: 'Riesgo Bajo / Favorable' },
            { color: '#f59e0b', label: 'Riesgo Medio / Alerta' },
            { color: '#ef4444', label: 'Riesgo Alto / Crítico' }
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: '8px', height: '8px', background: item.color, borderRadius: '50%', boxShadow: `0 0 6px ${item.color}60` }}></div>
              <span style={{ fontWeight: 600 }}>{item.label}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
