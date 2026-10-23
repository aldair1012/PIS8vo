import { useEffect } from 'react';

const SECTION_IDS = ['inicio', 'capacidades', 'datos', 'contacto'];
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End']);
// Wait until a meaningful part of the next section is visible, so the
// automatic movement never has to cover almost a full screen.
const PEEK_RATIO = 0.4;
const SETTLE_DELAY_MS = 150;
const easeInOutSmoother = (progress) => progress ** 3 * (progress * (progress * 6 - 15) + 10);

export default function useSectionSnap(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;

    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
    if (sections.length < 2) return undefined;

    const sectionTop = (section) => section.getBoundingClientRect().top + window.scrollY;
    const sectionAt = (viewportFraction) => {
      const readingLine = window.scrollY + window.innerHeight * viewportFraction;
      return sections.reduce((index, section, nextIndex) => (
        sectionTop(section) <= readingLine ? nextIndex : index
      ), 0);
    };

    let settledIndex = sectionAt(0.5);
    let lastScrollY = window.scrollY;
    let direction = 0;
    let lastUserInputAt = Number.NEGATIVE_INFINITY;
    let snapping = false;
    let settleTimer = 0;
    let animationFrame = 0;

    const cancelSnap = () => {
      if (!snapping) return;
      window.cancelAnimationFrame(animationFrame);
      snapping = false;
      lastScrollY = window.scrollY;
      settledIndex = sectionAt(0.5);
    };

    const registerInput = (event) => {
      if (event.type === 'keydown') {
        if (!SCROLL_KEYS.has(event.key)) return;
        if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      }
      lastUserInputAt = performance.now();
      cancelSnap();
    };

    const settle = () => {
      if (snapping || direction === 0) return;
      if (performance.now() - lastUserInputAt > 1400) {
        // Anchor links and scripted scrolls establish a new starting section.
        settledIndex = sectionAt(0.5);
        return;
      }

      const candidateIndex = sectionAt(direction > 0 ? 1 - PEEK_RATIO : PEEK_RATIO);
      if (direction > 0 ? candidateIndex <= settledIndex : candidateIndex >= settledIndex) return;

      const candidate = sections[candidateIndex];
      const bounds = candidate.getBoundingClientRect();
      const visibleHeight = Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0);
      if (visibleHeight < window.innerHeight * PEEK_RATIO - 2) return;

      const startY = window.scrollY;
      const targetY = Math.round(sectionTop(candidate));
      const distance = targetY - startY;
      settledIndex = candidateIndex;

      // Reduced motion should mean less travel time, never an abrupt jump.
      // Keep the section framing the user requested, but make it more restrained.
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = prefersReducedMotion
        ? Math.min(900, Math.max(560, 460 + Math.abs(distance) * 0.55))
        : Math.min(1400, Math.max(850, 760 + Math.abs(distance) * 0.6));
      let startedAt = null;
      snapping = true;

      const animate = (now) => {
        if (!snapping) return;
        if (startedAt === null) startedAt = now;
        const progress = Math.min(1, (now - startedAt) / duration);
        window.scrollTo(0, Math.round(startY + distance * easeInOutSmoother(progress)));
        lastScrollY = window.scrollY;

        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(animate);
        } else {
          snapping = false;
        }
      };

      animationFrame = window.requestAnimationFrame(animate);
    };

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;
      if (snapping || Math.abs(delta) < 1) return;
      direction = delta > 0 ? 1 : -1;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, SETTLE_DELAY_MS);
    };

    const handleHashChange = () => {
      window.clearTimeout(settleTimer);
      cancelSnap();
      lastUserInputAt = Number.NEGATIVE_INFINITY;
      const hashIndex = sections.findIndex((section) => `#${section.id}` === window.location.hash);
      if (hashIndex >= 0) settledIndex = hashIndex;
    };

    window.addEventListener('wheel', registerInput, { passive: true });
    window.addEventListener('touchmove', registerInput, { passive: true });
    window.addEventListener('keydown', registerInput);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('wheel', registerInput);
      window.removeEventListener('touchmove', registerInput);
      window.removeEventListener('keydown', registerInput);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [enabled]);
}
