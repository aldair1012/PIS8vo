import '../../assets/rendimiento-dashboard.css';
import '../../assets/dashboard-primitives.css';

function explainSurface(event, onExplain) {
  if (!onExplain || event.target.closest('button, a, input, select, textarea, label, form, summary, [role="button"], [contenteditable="true"]')) return;
  if (window.getSelection()?.toString().trim()) return;
  event.currentTarget.querySelector('.dashboard-explain-title')?.focus({ preventScroll: true });
  onExplain();
}

/** Presentación compartida de datos; cada pantalla conserva sus fuentes y cálculos. */
export function DashboardMetric({ label, value, unit, detail, icon: Icon, feature = false, onExplain, qualifier, severity }) {
  const QualifierIcon = qualifier?.icon;
  const showSeverity = severity !== undefined;
  const severityAbsent = severity === null;
  return <article onClick={event => explainSurface(event, onExplain)} className={`ydp-metric${feature ? ' ydp-metric--feature' : ''}${onExplain ? ' dashboard-metric--interactive' : ''}${qualifier ? ' ydp-metric--qualified' : ''}${showSeverity ? ' ydp-metric--with-severity' : ''}`}>
    <div className="ydp-metric-qualifier-zone">
      {qualifier ? <span className={`ydp-metric-qualifier ydp-metric-qualifier--${qualifier.tone ?? 'neutral'}`}>
        {QualifierIcon && <QualifierIcon size={13} aria-hidden="true" />}
        <span>{qualifier.label}</span>
      </span> : <span className="ydp-metric-label-spacer" aria-hidden="true" />}
    </div>
    <div className="ydp-metric-label">{Icon && <Icon size={18} aria-hidden="true" />}{onExplain ? <button type="button" className="dashboard-explain-title" aria-label={`Ver explicación de ${label}`} onClick={onExplain}>{label}</button> : <span>{label}</span>}</div>
    <div className="ydp-metric-window"><div className="ydp-metric-frame">
      <p className={`ydp-metric-value ${String(value ?? '').length > 9 ? 'ydp-metric-value--long' : ''}`}>{value ?? '—'}<small>{unit}</small></p>
      <p className="ydp-metric-detail">{detail}</p>
    </div></div>
    {showSeverity && <div className="ydp-metric-severity">
      <div className={`ydp-metric-severity-track${severityAbsent ? ' ydp-metric-severity-track--absent' : ''}`} role="presentation">
        {!severityAbsent && <span className="ydp-metric-severity-fill" style={{ width: `${Math.max(2, Math.min(100, severity.level))}%` }} />}
      </div>
      <span className="ydp-metric-severity-caption">{severityAbsent ? 'Sin evaluación' : (severity.label ?? 'Referencia útil')}</span>
    </div>}
    {onExplain && <span className="dashboard-explain-hint">Toca la tarjeta para entender este dato</span>}
  </article>;
}

export function DashboardPanel({ title, subtitle, icon: Icon, action, className = '', children, id, label, tabIndex, onExplain }) {
  return <section id={id} aria-label={label} tabIndex={tabIndex} onClick={event => explainSurface(event, onExplain)} className={`ydp-panel ${className}${onExplain ? ' dashboard-panel--interactive' : ''}`}>
    <header className="ydp-panel-header">
      <div className="ydp-panel-heading">
        {Icon && <Icon size={17} aria-hidden="true" />}
        <div><h2 aria-label={onExplain ? title : undefined}>{onExplain ? <button type="button" className="dashboard-explain-title" aria-label={`Ver explicación de ${title}`} onClick={onExplain}>{title}</button> : title}</h2>{subtitle && <p>{subtitle}</p>}{onExplain && <span className="dashboard-explain-hint">Toca el gráfico o la tarjeta para entenderlo</span>}</div>
      </div>
      {action}
    </header>
    {children}
  </section>;
}
