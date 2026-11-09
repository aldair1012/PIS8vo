import { useEffect, useState } from 'react';
import PlatformLogo from './PlatformLogo';
import {
  Sprout, CloudRainWind, TrendingUp, DollarSign, Map,
  PlusCircle, History, LogOut, MapPin,
} from 'lucide-react';

const NAV_GROUPS = [
  { label: 'Mi cultivo', items: [
    { id: 'cultivos', name: 'Mis parcelas', icon: MapPin },
    { id: 'simular', name: 'Simular cosecha', icon: PlusCircle },
  ] },
  { label: 'Análisis y decisiones', items: [
    { id: 'yield', name: 'Rendimiento', icon: TrendingUp },
    { id: 'scenarios', name: 'Siembra', icon: Sprout },
    { id: 'climate', name: 'Clima y cultivo', icon: CloudRainWind },
    { id: 'finance', name: 'Finanzas', icon: DollarSign },
  ] },
  { label: 'Seguimiento', items: [
    { id: 'map', name: 'Mapa de parcelas', icon: Map },
    { id: 'history', name: 'Simulaciones guardadas', icon: History },
  ] },
];

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
        <span className="sidebar-brand-caption">Centro de decisiones agrícolas</span>
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
        <button type="button" className="sidebar-logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={cerrarSesion}>
          <LogOut size={18} aria-hidden="true" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
