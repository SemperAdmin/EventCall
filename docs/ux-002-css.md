# UX-002: CSS Refactor (BEM + Variables)

## Overview
This refactor removes all inline `style` attributes from `index.html`, introduces a dedicated stylesheet at `styles/styles.css`, and applies BEM methodology for class naming. Styling parity with the previous UI is maintained, including responsive behavior.

## Naming Convention (BEM)
- Blocks: `auth`, `branding-footer`, `page-header`, `panel`, `profile-dropdown`, `user-btn`
- Elements: `__card`, `__header`, `__title`, `__subtitle`, `__tabs`, `__tab`, `__form`, `__info`, `__info-line`, `__info-icon`, `__status`, `__status-line`, `__status-text`, `__status-note`, `__actions`, `__action`, `__footer`
- Modifiers: `--active`, `--primary`, `--danger`, `--info`

Utility classes:
- `hidden`, `visually-hidden`, `form-group`, `form-label`, `form-control`, `form-help`, `form-help--inline`, `text-danger`

## CSS Variables
Defined in `:root` within `styles/styles.css`:
- `--ux2-gold`, `--ux2-gold-dark`, `--ux2-navy-900`, `--ux2-navy-800`, `--ux2-navy-700`
- `--ux2-text-light`, `--ux2-text-muted`, `--ux2-success`, `--ux2-info`, `--ux2-info-bg`, `--ux2-danger`
- `--ux2-shadow-strong`, `--ux2-shadow-medium`

## Responsive Behavior
- Mobile adjustments via media queries at `max-width: 640px` (e.g., reduced padding for `auth__card`, adjusted header sizes).
- Flex and grid layouts maintain flow at narrow widths.

## Testing Guide
1. Visual regression
   - Open `http://127.0.0.1:5500/` and compare against the previous UI.
   - Check login/register tabs, inputs, buttons, info panel, header, profile dropdown.
2. Cross-browser
   - Test on Chrome, Edge, Firefox, Safari (if applicable).
3. Responsive verification
   - Resize viewport to mobile (375px), tablet (768px), and desktop.
4. CSP compliance
   - Ensure no inline `style` attributes remain in `index.html` (verified by a regex scan).
5. Performance
   - Measure load and repaint via DevTools Performance before/after.

## Notes
- Focus styles are handled in CSS (`.form-control:focus`), replacing prior inline focus/blur handlers.
- Dropdown icon sizes use `.profile-dropdown__icon` instead of inline `style`.
