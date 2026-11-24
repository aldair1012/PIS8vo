import { useEffect, useState } from 'react';
import PlatformLogo from './PlatformLogo';
import {
  Sprout, CloudRainWind, TrendingUp, DollarSign,
  PlusCircle, ClipboardList, MessagesSquare, LogOut, MapPin, Map, History, Settings,
} from 'lucide-react';

const NAV_GROUPS = [
  { label: 'Parcelas', items: [
    { id: 'cultivos', name: 'Mis parcelas', icon: MapPin },
    { id: 'map', name: 'Mapas', icon: Map },
  ] },
  { label: 'Planificar', items: [
    { id: 'scenarios', name: 'Siembra', icon: Sprout },
    { id: 'climate', name: 'Clima y cultivo', icon: CloudRainWind },
  ] },
  { label: 'Simular', items: [
    { id: 'simular', name: 'Simular cosecha', icon: PlusCircle },
    { id: 'yield', name: 'Rendimiento', icon: TrendingUp },
    { id: 'finance', name: 'Finanzas', icon: DollarSign },
    { id: 'history', name: 'Historial', icon: History },
  ] },
  { label: 'Campo', items: [{ id: 'campo', name: 'Abrir cuaderno de campo', icon: ClipboardList }] },
  { label: 'Cuenta', items: [{ id: 'asistente', name: 'Consultar al asistente', icon: MessagesSquare }, { id: 'configuracion', name: 'Configuración', icon: Settings }] },
];

function SidebarFurrows() {
  return (
    <svg className="sidebar-furrows" viewBox="0 0 240 70" preserveAspectRatio="none" aria-hidden="true">
      <path d="M-20 65 C40 35, 120 40, 260 68" stroke="var(--zs-secondary, #7C9084)" strokeWidth="1.2" fill="none" opacity="0.18" />
      <path d="M-10 52 C50 25, 150 30, 250 56" stroke="var(--zs-secondary, #7C9084)" strokeWidth="1.2" fill="none" opacity="0.14" />
      <path d="M0 38 C70 15, 160 20, 240 44" stroke="var(--zs-secondary, #7C9084)" strokeWidth="1" fill="none" opacity="0.1" />
      <path d="M10 26 C80 8, 170 12, 230 32" stroke="var(--zs-accent, #E9B949)" strokeWidth="0.8" fill="none" opacity="0.16" />
    </svg>
  );
}

export default function Sidebar({ vistaActual, setVistaActual, cerrarSesion, menuColapsado, setMenuColapsado }) {
  const [menuMovil, setMenuMovil] = useState(() => window.matchMedia('(max-width: 1080px)').matches);

  useEffect(() => {
    const consulta = window.matchMedia('(max-width: 1080px)');
    const actualizar = (event) => setMenuMovil(event.matches);
    consulta.addEventListener('change', actualizar);
    return () => consulta.removeEventListener('change', actualizar);
  }, []);

  useEffect(() => {
    if (!menuMovil || menuColapsado) return undefined;
    const sidebar = document.getElementById('workspace-sidebar');
    const botones = () => [...sidebar.querySelectorAll('button:not(:disabled)')];
    botones()[0]?.focus();
    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuColapsado(true);
        document.querySelector('.navbar-sidebar-toggle-btn')?.focus();
      }
      if (event.key === 'Tab') {
        const controles = botones();
        const primero = controles[0];
        const ultimo = controles.at(-1);
        if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo?.focus(); }
        else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero?.focus(); }
      }
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => document.removeEventListener('keydown', cerrarConEscape);
  }, [menuMovil, menuColapsado, setMenuColapsado]);

  const elegirVista = (id, event) => {
    setVistaActual(id);
    if (menuMovil) {
      setMenuColapsado(true);
      if (event.detail === 0) requestAnimationFrame(() => document.querySelector('.navbar-sidebar-toggle-btn')?.focus());
    }
  };

  return (
    <aside id="workspace-sidebar" className={`sidebar ${menuColapsado ? 'collapsed' : ''}`} aria-label="Navegación de ZeaSys" inert={menuMovil && menuColapsado ? true : undefined}>
      <div className="sidebar-logo">
        <PlatformLogo variant={menuColapsado ? 'mark' : 'wordmark'} size={34} />
        <span className="sidebar-brand-caption">Gestión del cultivo de maíz</span>
      </div>

      <nav className="sidebar-navigation" aria-label="Secciones del sistema">
        {NAV_GROUPS.map((group) => (
          <div className="sidebar-section" key={group.label}>
            <h2 className="sidebar-section-title">{group.label}</h2>
            <ul className="sidebar-menu">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = vistaActual === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`sidebar-item-btn ${active ? 'active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      aria-label={item.name}
                      title={menuColapsado ? item.name : undefined}
                      onClick={(event) => elegirVista(item.id, event)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{item.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <SidebarFurrows />
        <button type="button" className="sidebar-logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={cerrarSesion}>
          <LogOut size={18} aria-hidden="true" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
