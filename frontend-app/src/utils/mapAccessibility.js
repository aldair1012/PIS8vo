// Geoman genera enlaces de iconos sin nombre. Mantiene sus controles y su idioma.
export function nombrarControlesMapa(map) {
  const container = map.getContainer();
  const update = () => container.querySelectorAll('.leaflet-pm-toolbar a[role="button"]').forEach(link => {
    const title = link.parentElement?.title || link.title;
    if (title && link.getAttribute('aria-label') !== title) link.setAttribute('aria-label', title);
  });
  update();
  const observer = new MutationObserver(update);
  observer.observe(container, { childList: true, subtree: true });
  const keydown = event => {
    if (event.key === ' ' && event.target.matches('.leaflet-pm-toolbar a[role="button"]')) {
      event.preventDefault(); event.target.click();
    }
  };
  container.addEventListener('keydown', keydown);
  map.once('unload', () => { observer.disconnect(); container.removeEventListener('keydown', keydown); });
}

// Leaflet no observa por sí solo cambios de ancho causados por la barra lateral.
export function observarTamanoMapa(map) {
  let frame;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
  });
  observer.observe(map.getContainer());
  map.once('unload', () => { observer.disconnect(); cancelAnimationFrame(frame); });
}
