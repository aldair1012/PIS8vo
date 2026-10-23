# ZeaSys project instructions

## Current UI scope

- The active design-system scope is the public landing page implemented in `frontend-app/src/views/Login.jsx`.
- Keep landing-specific tokens and overrides in `frontend-app/src/assets/landing-system.css`.
- Do not restyle internal dashboards, maps, simulations, configuration views, or `ChatbotWidget` unless the user explicitly expands the scope.

## Frontend defaults

- Preserve the current React + Vite + plain CSS stack. Do not add Tailwind, shadcn/ui, or another component framework without explicit approval.
- Follow a three-layer token model: primitives, semantic theme tokens, then component aliases.
- Keep the hero photograph and its dark diffusion visually consistent in light and dark mode; light mode changes surrounding surfaces, not the hero art direction.
- Apply the 60/30/10 color balance: page background, raised surfaces, and agricultural accent colors.
- Prefer mobile-first behavior, 44px minimum touch targets, visible `:focus-visible` states, semantic HTML, and `prefers-reduced-motion` support.
- Reuse the imported landing images in `frontend-app/src/assets/landing` before adding new remote imagery. Keep runtime 3D model resources in `frontend-app/public/models`.

## Change boundaries

- Preserve unrelated user changes in the dirty worktree.
- Avoid adding new `!important` declarations except at the boundary with the legacy `styles.css`; new landing rules should live in the scoped compatibility layer.
- When later migrating internal screens, create a separate token/component layer instead of reusing landing-only selectors.

## Verification

- Run `npm run lint` from `frontend-app`.
- Run `npm run build` from `frontend-app`.
- Check the public page in light and dark mode at mobile, tablet, and desktop widths when browser automation is available.
