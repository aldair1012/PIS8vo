import PlatformLogo from './PlatformLogo';
import { 
  Sprout, 
  CloudRainWind, 
  TrendingUp, 
  DollarSign, 
  Map, 
  PlusCircle, 
  History, 
  LogOut,
  MapPin,
  Menu,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ vistaActual, setVistaActual, cerrarSesion, menuColapsado, setMenuColapsado }) {
  const menuItems = [
    { id: 'yield', name: 'Brecha Productiva', icon: TrendingUp },
    { id: 'scenarios', name: 'Viabilidad de Siembra', icon: Sprout },
    { id: 'climate', name: 'Calendario Fenológico', icon: CloudRainWind },
    { id: 'finance', name: 'Viabilidad Financiera', icon: DollarSign },
    { id: 'history', name: 'Historial', icon: History },
    { id: 'map', name: 'Mapa de Parcelas', icon: Map },
    { id: 'simular', name: 'Nueva Simulación', icon: PlusCircle },
    { id: 'cultivos', name: 'Gestionar Lotes', icon: MapPin }
  ];

  return (
    <div className={`sidebar ${menuColapsado ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <PlatformLogo size={68} isIconOnly={false} />
      </div>
      <ul className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
                className={`sidebar-item-btn ${vistaActual === item.id ? 'active' : ''}`}
                onClick={() => {
                  setVistaActual(item.id);
                  if (window.innerWidth <= 1080) {
                    setMenuColapsado(true);
                  }
                }}
              >
                <Icon size={20} style={{ flexShrink: 0 }} />
                <span>{item.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
