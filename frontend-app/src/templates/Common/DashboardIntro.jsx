import { ArrowUpRight, Sparkles } from 'lucide-react';

export function DashboardSectionHeading({ label, title, description }) {
  return (
    <div className="dashboard-section-heading">
      <div>
        {label && <span className="dashboard-section-index">{label}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

export default function DashboardIntro({ step, title, description, interpretation, source }) {
  return (
    <header className="dashboard-intro">
      <div className="dashboard-intro-main">
        <span className="dashboard-intro-eyebrow">{step}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="dashboard-intro-aside">
        <span className="dashboard-intro-aside-label">Cómo leer este panel</span>
        <p>{interpretation}</p>
        <span className="dashboard-intro-source">{source}</span>
        <button type="button" className="dashboard-intro-assistant" onClick={() => window.dispatchEvent(new Event('zeasys:open-chat'))}>
          <Sparkles size={16} aria-hidden="true" /> Preguntar al asistente <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
