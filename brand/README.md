# otto — brand

## The mark

Two equal discs, mirrored about the vertical axis, with their overlap cut away. The shape reads the same left-to-right and right-to-left, like the name "otto". It also suggests the product's idea: the page on one side, the user's memory on the other, and otto working in the space where they meet.

The mark contains no letters, icons or emoji.

| File | Use |
|---|---|
| `otto-mark.svg` | Default. Uses `currentColor`, so it inherits text colour (works in light and dark UI). |
| `otto-mark-black.svg` | Fixed near-black (`#0a0a0a`) for light backgrounds and documents. |
| `otto-mark-white.svg` | Fixed off-white (`#fafafa`) for dark backgrounds. |
| `otto-app-icon.svg` | White mark on a black rounded square. Favicon, extension toolbar icon, app icon. |
| `preview.html` | Open in a browser to see the mark on light/dark and at 32 px and 16 px. |

## Rules

- Keep the two discs equal and the cut-out transparent (`fill-rule="evenodd"`). Don't fill the overlap.
- Minimum size: 16 px. Below 24 px prefer `otto-app-icon.svg`.
- Clear space around the mark: at least one quarter of its height.
- Colours: only the neutral palette below. No gradients, no shadows.
- The name is always written in lowercase: **otto**. When the name appears next to the mark, it is set in the UI font (Geist), weight 600, letter-spacing −0.02em, and the mark height equals the cap height × 1.4.

## Palette (neutral only)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0a0a0a` | Primary text, mark, primary buttons (light theme) |
| `--ink-2` | `#262626` | Secondary surfaces (dark theme) |
| `--muted` | `#737373` | Secondary text |
| `--line` | `#e5e5e5` | Borders, dividers (light) |
| `--line-dark` | `#262626` | Borders, dividers (dark) |
| `--paper-2` | `#f5f5f5` | Subtle fills, hover (light) |
| `--paper` | `#fafafa` | Page background (light), mark on dark |
| `--white` | `#ffffff` | Cards (light) |

Status colours are allowed only as small dots or text in the dashboard, never in brand use.

## Exporting PNGs (for the extension manifest)

The extension needs 16, 32, 48 and 128 px PNGs. WXT generates them from `otto-app-icon.svg` with `@wxt-dev/auto-icons` (see `docs/02-tech-stack.md`). To export by hand with Chrome:

```bash
chrome --headless=new --screenshot=icon-128.png --window-size=128,128 brand/otto-app-icon.svg
```
