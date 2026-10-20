# Sudarshan Command Deck design system

The existing stylesheet is plain CSS, so the palette and shared surface rules are implemented as CSS custom properties rather than introducing a Tailwind configuration or dependency.

## Tokens

- **Canvas:** `#070D0B`; deep panel green: `#101A15`.
- **Signal amber:** `#F5B942`; restrained danger red: `#E5484D`; truth-layer cyan: `#5EEAD4`.
- **Text:** `#E8EFE6`; secondary `#BAC7BB`; muted `#91A094`.
- **Type:** Georgia/Times for display headlines; Bahnschrift/Arial Narrow for tracked labels; Consolas/Courier New for timers and coordinates. System fonts only; no external font loads.
- **Surface:** 1 px translucent white-green hairline, 14–20 px radius, soft inset highlight and 12 px blur on panels. Map surfaces do not use backdrop blur.
- **Focus and form controls:** amber focus outline and range track; native input semantics retained.

`Atmosphere` adds a non-interactive, CSS-only vignette and grid treatment. Reduced mode suppresses animation; Off removes decorative effects. No scenario values or random source are used by the atmosphere layer.
