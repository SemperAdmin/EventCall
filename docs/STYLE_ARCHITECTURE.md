# EventCall CSS Architecture

Objectives
- Reduce duplication, improve maintainability, and ensure consistent theming.
- Support component-based styling with minimal global leakage.

Foundations
- Variables: Defined in `:root` for colors, spacing, typography, breakpoints.
  - Colors: `--primary-color`, `--semper-red`, `--semper-gold`, `--semper-navy`, etc.
  - Spacing: `--space-{scale}` used for paddings/margins.
  - Typography: `--font-sans`, `--font-size-*` scale.
  - Breakpoints: `--bp-sm`, `--bp-md`, `--bp-lg`, `--bp-xl`.

Structure & Scoping
- Components should be wrapped in a namespacing container class (e.g., `.component-xyz`).
- Nest internal selectors under component wrapper to avoid global conflicts.
- Prefer BEM-like naming: `.component-xyz__element--modifier`.

Utilities
- Common one-off styles (spacing, display, text alignment) should use utility classes.
- Avoid redefining base utility blocks across the file.

Build & Quality
- PostCSS: Autoprefixer, CSSNano for minification, PurgeCSS for production to drop unused CSS.
- Stylelint: Standard config with duplicate selector/property checks.
- Production output: `styles/main.min.css` referenced by `index.html`.

Guidelines
- When adding a new component:
  1) Create a wrapper class and scope styles under it.
  2) Use variables for spacing/colors/typography.
  3) Prefer utilities for simple spacing and display tweaks.
  4) Keep animations/keyframes centralized to avoid duplication.

Migration Plan
- Phase 1: Deduplicate repeated global blocks (complete for initial pass).
- Phase 2: Incrementally move page-level groups to component wrappers.
- Phase 3: Introduce more utilities and refactor selectors to utilities where safe.
- Phase 4: Audit and benchmark; tighten PurgeCSS config with safelist only if necessary.

