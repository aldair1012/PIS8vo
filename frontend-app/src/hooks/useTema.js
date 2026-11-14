import { useEffect, useState } from 'react';

/**
 * Tema activo del espacio de cultivo (`true` = claro).
 * Repite el patrón que ya usan el mapa y el gráfico de rendimiento:
 * suscribe la UI a la clase `light-theme` del <body> mediante un
 * MutationObserver. Los gráficos en Canvas (Chart.js) se actualizan
 * al cambiar el tema igual que los tokens CSS.
 */
export default function useTema() {
  const [claro, setClaro] = useState(() =>
    typeof document !== 'undefined' && document.body.classList.contains('light-theme'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setClaro(document.body.classList.contains('light-theme'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return claro;
}
