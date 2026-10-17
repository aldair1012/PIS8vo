import React from 'react';
import { X, AlertTriangle, Lightbulb, Activity, Cpu, HelpCircle, AlertCircle, FileText, TrendingUp, CheckCircle } from 'lucide-react';

export default function AIExplainModal({ isOpen, onClose, loading, data }) {
  if (!isOpen) return null;

  // Determinar color y texto del nivel
  const getNivelStyle = (nivel = '') => {
    const n = nivel.toLowerCase();
    if (n === 'riesgoso' || n === 'riesgo' || n === 'alto') {
      return {
        bg: 'rgba(239, 68, 68, 0.15)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        color: '#f87171',
        text: 'Riesgoso'
      };
    }
    if (n === 'regular' || n === 'medio' || n === 'moderado') {
      return {
        bg: 'rgba(234, 179, 8, 0.15)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        color: '#fbbf24',
        text: 'Regular'
      };
    }
    return {
      bg: 'rgba(34, 197, 94, 0.15)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      color: '#4ade80',
      text: 'Favorable'
    };
  };

  const nivelStyle = getNivelStyle(data?.nivel);

  // Obtener títulos de secciones dinámicos y variados según contexto (Sin Emojis)
  const getTitulosAdaptativos = (data) => {
    if (data?.titulos_secciones) {
      return data.titulos_secciones;
    }

    const t = (data?.nombre || data?.titulo || '').toLowerCase();
    const ctx = (data?.tipo_contexto || '').toLowerCase();

    if (ctx === 'financiero' || t.includes('ingreso') || t.includes('margen') || t.includes('roi') || t.includes('costo') || t.includes('precio') || t.includes('equilibrio') || t.includes('perfil') || t.includes('ventas') || t.includes('facturación')) {
      return {
        sec1: 'Diagnóstico Financiero y Liquidez',
        sec2: 'Origen del Margen Económico',
        sec3: 'Puntos de Fuga y Costos Críticos',
        sec4: 'Estrategia de Rentabilidad Agro-Comercial',
        sec5: 'Proyección Financiera y Riesgo de Capital'
      };
    }

    if (ctx === 'brecha' || t.includes('gap') || t.includes('limitante') || t.includes('estrés') || t.includes('pérdida') || t.includes('rendimiento') || t.includes('cascada')) {
      return {
        sec1: 'Evaluación de la Brecha de Producción',
        sec2: 'Análisis del Cuello de Botella Agronómico',
        sec3: 'Factor Limitante Principal en Parcela',
        sec4: 'Acción Correctiva Prioritaria en Campo',
        sec5: 'Impacto Estimado en Toneladas Cosechadas'
      };
    }

    if (ctx === 'clima' || t.includes('lluvia') || t.includes('agua') || t.includes('temperatura') || t.includes('suelo') || t.includes('enso') || t.includes('clima')) {
      return {
        sec1: 'Diagnóstico Agroclimático y de Suelo',
        sec2: 'Dinámica Hídrica y Térmica del Lote',
        sec3: 'Anomalía o Estrés Ambiental Detectado',
        sec4: 'Manejo Adaptativo Recomendado',
        sec5: 'Riesgo Fisiológico si el Clima Cambia'
      };
    }

    return {
      sec1: 'Interpretación Técnica del Indicador',
      sec2: 'Fundamento Biológico y Fisiológico',
      sec3: 'Factores de Influencia en la Simulación',
      sec4: 'Recomendación Práctica de Manejo',
      sec5: 'Perspectiva Agronómica a Considerar'
    };
  };

  const titulos = getTitulosAdaptativos(data);

  // Formatear negrita y destacar valores importantes
  const renderInlineMarkdown = (text) => {
    if (!text || typeof text !== 'string') return text;

    // Limpiar unidades repetidas
    let clean = text
      .replace(/t\/ha\s+t\/ha/gi, 't/ha')
      .replace(/kg\/ha\s+kg\/ha/gi, 'kg/ha')
      .replace(/USD\/ha\s+USD\/ha/gi, 'USD/ha')
      .replace(/mm\/año\s+mm\/año/gi, 'mm/año');

    const parts = clean.split(/(\*\*[^*]+\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const innerText = part.slice(2, -2);
        return (
          <span 
            key={index} 
            style={{
              fontWeight: 800,
              color: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.14)',
              padding: '0.1rem 0.45rem',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'inline-block',
              margin: '0 0.15rem',
              letterSpacing: '0.01em',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)'
            }}
          >
            {innerText}
          </span>
        );
      }
      return part;
    });
  };

  // Dar formato al texto de la explicación
  const renderFormattedText = (rawText) => {
    if (!rawText) return null;
    if (typeof rawText !== 'string') return rawText;

    // 1. Limpieza inicial de frases duplicadas o conectores aglomerados
    let text = rawText
      .replace(/responde a que\s+se debe a/gi, 'se debe a')
      .replace(/responde a que\s+ocurre debido a/gi, 'ocurre debido a')
      .replace(/atribuye a que\s+se debe a/gi, 'se debe a')
      .replace(/indica que\s+esta/gi, 'esta')
      .replace(/indica que\s+este/gi, 'este')
      .replace(/evaluando en esta tarjeta cómo se comporta/gi, 'evaluando')
      .replace(/detalla el comportamiento y los niveles de\s+/gi, 'evalúa ')
      .trim();

    // 2. CASO A: Lista numerada (1), 2), 3) o 1., 2., 3.) o viñetas (•) al inicio de línea
    const numberPattern = /(?:^|\n)\s*(?:[1-9]\d*[\)\.]|•)\s+/;
    if (numberPattern.test(text)) {
      const tokenRegex = /((?:^|\n)\s*(?:[1-9]\d*[\)\.]|•)\s+)/;
      const parts = text.split(tokenRegex);
      const intro = parts[0] ? parts[0].trim() : '';
      const items = [];

      for (let i = 1; i < parts.length; i += 2) {
        const marker = parts[i] ? parts[i].trim() : '';
        const content = parts[i + 1] ? parts[i + 1].trim() : '';
        if (marker && content) {
          items.push({ marker, content });
        }
      }

      if (items.length > 0) {
        return buildFormattedCards(intro, items);
      }
    }

    // 3. CASO B: Texto con separadores de tubería (|) como plagas/patógenos o listas de factores
    if (text.includes('|')) {
      const firstPipeIdx = text.indexOf('|');
      let intro = text.substring(0, firstPipeIdx).trim();
      let pipeContent = text.substring(firstPipeIdx).trim();

      // Si la intro contiene "Plagas clave:" o similar, extraer el primer elemento antes del pipe
      const plagaKeyMatch = intro.match(/(Plagas clave|Patógenos|Enfermedades|Factores|Parámetros):\s*(.*)$/i);
      if (plagaKeyMatch) {
        const fullKey = plagaKeyMatch[1];
        const firstValue = plagaKeyMatch[2];
        intro = intro.substring(0, plagaKeyMatch.index).trim();
        pipeContent = `${fullKey}: ${firstValue} | ${pipeContent.replace(/^\|/, '').trim()}`;
      }

      const pipeSegments = pipeContent.split('|').map(s => s.trim()).filter(Boolean);
      const items = pipeSegments.map((seg) => ({
        marker: '•',
        content: seg
      }));

      // Revisar si la intro también tiene parámetros estructurados (Suelo:, Riego:)
      const subItemsFromIntro = extractKeyValueItems(intro);
      if (subItemsFromIntro.items.length > 0) {
        return buildFormattedCards(subItemsFromIntro.intro, [...subItemsFromIntro.items, ...items]);
      }

      return buildFormattedCards(intro, items);
    }

    // 4. CASO C: Texto corrido con múltiples etiquetas clave con dos puntos (Suelo:, Densidad:, Riego:, etc.)
    const keyValResult = extractKeyValueItems(text);
    if (keyValResult.items.length > 1) {
      return buildFormattedCards(keyValResult.intro, keyValResult.items);
    }

    return renderInlineMarkdown(text);
  };

  // Helper para extraer pares clave-valor estructurados (Suelo:, Densidad:, Riego:, etc.)
  const extractKeyValueItems = (text) => {
    const keyRegex = /(?:\.|\s|^)(Suelo|Densidad objetivo|Densidad|Riego|Plagas clave|Patógenos|Enfermedades|Bajo Riesgo|Riesgo Alto|Riesgo Medio|Umbral|Control|Manejo|Recomendación|Perfil \d+|Fase):\s*/gi;
    
    const matches = [];
    let match;
    while ((match = keyRegex.exec(text)) !== null) {
      matches.push({
        label: match[1],
        index: match.index,
        endIndex: match.index + match[0].length
      });
    }

    if (matches.length < 2) {
      return { intro: text, items: [] };
    }

    const intro = text.substring(0, matches[0].index).trim();
    const items = [];

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const contentEnd = next ? next.index : text.length;
      const valStr = text.substring(current.endIndex, contentEnd).trim().replace(/\.$/, '');

      items.push({
        marker: '•',
        content: `${current.label}: ${valStr}`
      });
    }

    return { intro, items };
  };

  // Helper para construir las tarjetas HTML estilizadas
  const buildFormattedCards = (intro, items) => {
    return (
      <div style={{ width: '100%' }}>
        {intro && (
          <p style={{ margin: '0 0 0.75rem 0', lineHeight: 1.55, color: 'var(--modal-text-p)', fontSize: '0.93rem' }}>
            {renderInlineMarkdown(intro)}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: intro ? '0.5rem' : 0 }}>
          {items.map((item, idx) => {
            const colonPos = item.content.indexOf(':');
            let title = '';
            let body = item.content;

            if (colonPos > 0 && colonPos < 45) {
              title = item.content.substring(0, colonPos + 1);
              body = item.content.substring(colonPos + 1).trim();
            }

            return (
              <div key={idx} style={{ 
                display: 'flex', 
                gap: '0.65rem', 
                alignItems: 'flex-start',
                padding: '0.6rem 0.85rem',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
              }}>
                <span style={{ 
                  fontWeight: 800, 
                  color: '#38bdf8', 
                  fontSize: '0.85rem',
                  flexShrink: 0,
                  background: 'rgba(56, 189, 248, 0.12)',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  lineHeight: '1.3'
                }}>
                  {item.marker}
                </span>
                <div style={{ fontSize: '0.92rem', lineHeight: 1.5, color: 'var(--modal-text-p)', flex: 1 }}>
                  {title ? (
                    <>
                      <strong style={{ color: '#38bdf8', fontWeight: 700 }}>{title}</strong>{' '}
                      {renderInlineMarkdown(body)}
                    </>
                  ) : (
                    renderInlineMarkdown(body)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="modal-overlay ia-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--overlay-backdrop)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1.5rem 1rem',
        zIndex: 100000,
        animation: 'fadeIn 0.25s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--modal-bg)',
          border: '1px solid var(--modal-border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3), inset 0 1px 0 var(--border-subtle)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          color: 'var(--modal-text)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'var(--modal-close-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            color: 'var(--modal-close-text)',
            transition: 'all 0.2s',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.color = '#f87171';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--modal-close-bg)';
            e.currentTarget.style.color = 'var(--modal-close-text)';
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        >
          <X size={18} />
        </button>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '1.5rem', flex: 1 }}>
            <div style={{ position: 'relative', width: '70px', height: '70px' }}>
              <div className="pulse-ring" style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.2)',
                animation: 'pulse 1.8s infinite ease-in-out'
              }} />
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)'
              }}>
                <Cpu size={24} color="#fff" style={{ animation: 'spin-slow 6s linear infinite' }} />
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: 'var(--modal-text)' }}>Intérprete Agrícola ZeaSys</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--modal-text-muted)', margin: 0 }}>Procesando diagnóstico agrícola detallado...</p>
            </div>
          </div>
        ) : (
          /* CONTENT STATE */
          <React.Fragment>
            {/* Header Area (Limpio sin el logo de IA) */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.88rem', 
              padding: '1.75rem 2.25rem 1rem 2.25rem', 
              paddingRight: '3.5rem',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0 
            }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--modal-text)', lineHeight: 1.3 }}>
                  {data?.titulo || data?.nombre || 'Interpretación Agrícola'}
                </h3>
                {data?.subtitulo_contexto && (
                  <p style={{ fontSize: '0.78rem', color: '#60a5fa', margin: '0.25rem 0 0 0', fontWeight: 600 }}>
                    {data.subtitulo_contexto}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '6px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    ...nivelStyle
                  }}>
                    {nivelStyle.text}
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Body Content */}
            <div style={{ 
              padding: '1.5rem 2.25rem', 
              overflowY: 'auto', 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem' 
            }}>
              {/* Bloque de Información Separada (Para Tarjetas Compuestas / Efecto Cascada) */}
              {(data?.doble_info || (data?.sub_label && data?.sub_valor)) && (
                <div style={{
                  background: 'var(--surface-elevated)',
                  border: '1.5px solid var(--border-strong)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem'
                }}>
                  <div style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: '0.75rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {data?.doble_info?.dato1_label || data?.nombre || 'Métrica Principal'}
                    </span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {data?.doble_info?.dato1_val || (data?.valor ? `${data.valor} ${data.unidad || ''}` : '---')}
                    </div>
                  </div>
                  <div style={{ paddingLeft: '0.25rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {data?.doble_info?.dato2_label || data?.sub_label || 'Indicador Secundario'}
                    </span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                      {data?.doble_info?.dato2_val || data?.sub_valor}
                    </div>
                  </div>
                </div>
              )}

              {/* Renderizado Dinámico de Secciones por Categoría */}
              {data?.secciones && Array.isArray(data.secciones) && data.secciones.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                  {data.secciones.map((sec, idx) => {
                    const tipo = sec.tipo || 'info';
                    const isDanger = tipo === 'danger' || tipo === 'alert';
                    const isSuccess = tipo === 'success';
                    const isWarning = tipo === 'warning';

                    const borderColor = isDanger ? 'rgba(239, 68, 68, 0.28)' : isSuccess ? 'rgba(34, 197, 94, 0.28)' : isWarning ? 'rgba(234, 179, 8, 0.28)' : 'var(--modal-card-border)';
                    const bgColor = isDanger ? 'rgba(239, 68, 68, 0.06)' : isSuccess ? 'rgba(34, 197, 94, 0.06)' : isWarning ? 'rgba(234, 179, 8, 0.06)' : 'var(--modal-card-bg)';
                    const titleColor = isDanger ? '#f87171' : isSuccess ? '#4ade80' : isWarning ? '#fbbf24' : '#38bdf8';

                    const IconComp = isDanger ? AlertCircle : isSuccess ? CheckCircle : isWarning ? AlertTriangle : Lightbulb;

                    return (
                      <div key={idx} style={{
                        background: bgColor,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '14px',
                        padding: '1.15rem 1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <IconComp size={18} color={titleColor} style={{ flexShrink: 0 }} />
                          <strong style={{ color: titleColor, fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {sec.titulo}
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.96rem', lineHeight: '1.6', color: 'var(--modal-text-p)', paddingLeft: '0.2rem' }}>
                          {renderFormattedText(sec.contenido || sec.texto)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Fallback para estructura legada */
                <React.Fragment>
                  {/* ¿Qué significa? */}
                  <div style={{
                    background: 'var(--modal-card-bg)',
                    border: '1px solid var(--modal-card-border)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    fontSize: '1.05rem',
                    lineHeight: '1.6',
                    color: 'var(--modal-text-p)'
                  }}>
                    <strong style={{ display: 'block', color: '#34d399', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>
                      {titulos.sec1}
                    </strong>
                    {renderFormattedText(data?.que_significa || data?.explicacion_breve)}
                  </div>

                  {/* Secciones de Interpretación */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                    
                    {/* Sección 2 */}
                    {(data?.por_que_pudo_pasar) && (
                      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                        <div style={{ color: '#60a5fa', padding: '0.2rem', flexShrink: 0 }}>
                          <HelpCircle size={20} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--modal-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {titulos.sec2}
                          </h5>
                          <div style={{ margin: 0, fontSize: '0.95rem', color: 'var(--modal-text-p)', lineHeight: 1.5 }}>
                            {renderFormattedText(data.por_que_pudo_pasar)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sección 3 */}
                    {(data?.que_pudo_haberse_hecho_mal) && (
                      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                        <div style={{ color: '#fb7185', padding: '0.2rem', flexShrink: 0 }}>
                          <AlertCircle size={20} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--modal-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {titulos.sec3}
                          </h5>
                          <div style={{ margin: 0, fontSize: '0.95rem', color: 'var(--modal-text-p)', lineHeight: 1.5 }}>
                            {renderFormattedText(data.que_pudo_haberse_hecho_mal)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sección 4 */}
                    {(data?.como_mejorarlo || data?.recomendacion) && (
                      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                        <div style={{ color: '#34d399', padding: '0.2rem', flexShrink: 0 }}>
                          <Lightbulb size={20} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--modal-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {titulos.sec4}
                          </h5>
                          <div style={{ margin: 0, fontSize: '0.95rem', color: 'var(--modal-text-p)', lineHeight: 1.5 }}>
                            {renderFormattedText(data.como_mejorarlo || data.recomendacion)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sección 5 */}
                    {(data?.que_puede_pasar_si_no_cambia || data?.impacto_en_el_cultivo) && (
                      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                        <div style={{ color: '#a78bfa', padding: '0.2rem', flexShrink: 0 }}>
                          <Activity size={20} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--modal-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {titulos.sec5}
                          </h5>
                          <div style={{ margin: 0, fontSize: '0.95rem', color: 'var(--modal-text-p)', lineHeight: 1.5 }}>
                            {renderFormattedText(data.que_puede_pasar_si_no_cambia || data.impacto_en_el_cultivo)}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </React.Fragment>
              )}

              {/* Alerta de Riesgo / Alerta Clave */}
              {(data?.alerta_clave || data?.alerta) && 
               (data?.alerta_clave || data?.alerta).toLowerCase() !== 'sin alerta' && 
               (data?.alerta_clave || data?.alerta).toLowerCase() !== 'sin alertas' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.18)',
                  padding: '0.88rem 1rem',
                  borderRadius: '10px',
                  color: '#f87171',
                  fontSize: '0.95rem',
                  lineHeight: 1.4
                }}>
                  <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                  <span><strong>Alerta Clave:</strong> {data.alerta_clave || data.alerta}</span>
                </div>
              )}
            </div>

            {/* Footer Area (Fixed) */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderTop: '1px solid var(--modal-card-border)', 
              padding: '1rem 2.25rem 1.5rem 2.25rem',
              flexShrink: 0 
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--modal-text-muted)' }}>
                {data?.source || 'Intérprete Agrícola ZeaSys'}
              </span>
              <button 
                onClick={onClose}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  padding: '0.6rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                  transition: 'transform 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Entendido
              </button>
            </div>
          </React.Fragment>
        )}
      </div>

      {/* Estilos locales para animaciones */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.94); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.3; }
          100% { transform: scale(0.9); opacity: 1; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .pulse-ring {
          animation: pulse 1.8s infinite ease-in-out;
        }
        .glow-icon {
          filter: drop-shadow(0 0 4px rgba(34, 197, 94, 0.5));
        }
      `}</style>
    </div>
  );
}
