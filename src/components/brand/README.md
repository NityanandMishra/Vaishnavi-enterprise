# Logo

The Vaishnavi Enterprises identity, built on the three-layer token system.

```
design-tokens.json          source of truth (primitive -> semantic -> component)
        │  npm run tokens:build
        ▼
src/styles/design-tokens.css   generated CSS variables — do not edit
        │
        ├── globals.css .ve-logo* rules   consume --logo-* only
        └── tailwind.config.js            reads the primitive layer for brand.orange
```

`Logo.tsx` contains no literal colours, sizes or type values. To restyle the mark,
edit `design-tokens.json` and re-run `npm run tokens:build`. Verify with
`npm run tokens:check`.

The only literals in the component are **artboard geometry** — the 48×48 viewBox,
SVG path data, the arc radius, the tile `rx`. That is the drawing itself, not styling.

## Usage

```tsx
import Logo, { LogoMark } from "@/components/brand/Logo";

<Link href="/" aria-label="Vaishnavi Enterprises — home" className="ve-logo-link">
  <Logo size="md" />
</Link>
```

The mark is `aria-hidden`; the wordmark is real text. A `Logo` inside a link needs
`aria-label` on the link, because the wordmark can be hidden at small widths.

## Props

| Prop | Values | Default | Notes |
|------|--------|---------|-------|
| `variant` | `ring` \| `monogram` \| `badge` \| `rotor` | `ring` | `ring` is the house mark |
| `size` | `xs` \| `sm` \| `md` \| `lg` | `md` | Token steps, not free px |
| `emphasis` | boolean | `false` | Larger wordmark step |
| `wordmarkHidden` | boolean | `false` | Mark only |
| `wordmarkResponsive` | boolean | `false` | Hide the lockup below `sm` |

## Size steps

| Step | Token | Value | Use |
|------|-------|-------|-----|
| `xs` | `--logo-mark-size-xs` | 16px | Minimum legible size; favicon floor |
| `sm` | `--logo-mark-size-sm` | 24px | Dense chrome, mobile bars |
| `md` | `--logo-mark-size-md` | 36px | Storefront header, footer, admin sidebar |
| `lg` | `--logo-mark-size-lg` | 64px | Auth screens, hero lockups |

Below `xs` use `src/app/icon.svg` (the mark reversed out of an orange tile).

## Component spec — link states

The lockup itself is stateless. State lives on `.ve-logo-link`.

| Property | Default | Hover | Active | Focus-visible |
|----------|---------|-------|--------|---------------|
| Opacity | 1 | `--logo-link-hover-opacity` (0.85) | `--logo-link-active-opacity` (0.7) | 1 |
| Outline | none | none | none | `--logo-link-focus-ring-width` solid `--logo-link-focus-ring` |
| Outline offset | — | — | — | `--logo-link-focus-ring-offset` (2px) |
| Transition | `opacity --logo-link-transition` | same | same | same |

`prefers-reduced-motion: reduce` drops the transition.

## Surfaces

`--logo-mark-bolt` is `currentColor`, so the mark takes the surface's text colour.
Set it from the semantic layer on the wrapper:

| Surface | Wrapper colour | Where |
|---------|----------------|-------|
| Light | `var(--color-ink)` | Storefront header, auth screen |
| Inverse | `var(--color-ink-inverse)` | Footer, admin sidebar |

The `Enterprises` descriptor is always `--logo-sub-color` (brand orange) and does
not follow `currentColor` — it must stay brand on both surfaces.

## Clear space

`--logo-clearspace` = `0.5em` of the mark's height, all four sides.

## Variants

| Variant | Reads as | Use |
|---------|----------|-----|
| `ring` | Power symbol broken by a bolt | House mark, everywhere |
| `monogram` | Two-tone V | Alternate; most ownable, least explanatory |
| `badge` | Bolt in an orange tile | App icon / favicon contexts |
| `rotor` | Three turning blades | Fan category icon only — misleading as the house mark |
