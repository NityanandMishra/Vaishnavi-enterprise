import { cn } from "@/lib/utils";

/**
 * Vaishnavi Enterprises brand mark.
 *
 * Every colour, size and type value comes from the `--logo-*` component tokens
 * in src/styles/design-tokens.css, which are generated from design-tokens.json
 * (primitive -> semantic -> component). There are no literal values in here:
 * to restyle the mark, edit the token source and run `npm run tokens:build`.
 *
 * Four explored directions, swappable in one place — see the `decisions` entry
 * in .21st/design.json and src/components/brand/README.md for the spec.
 *
 * - ring     Power Ring: open power-symbol ring + bolt. Category-true for
 *            EV / UPS / lighting, reads at 16px, works one-colour. House mark.
 * - monogram V-Charge: two-tone "V" letterform, encodes the name.
 * - badge    Voltbadge: flat orange tile + bolt (the closest evolution of the
 *            old lucide `Zap` placeholder).
 * - rotor    Rotor: three-blade spark, nods to the fan category.
 *
 * `--logo-mark-bolt` resolves to `currentColor`, so the mark inherits the
 * surface's text colour: ink on light surfaces, white on inverse ones.
 */
export type LogoVariant = "ring" | "monogram" | "badge" | "rotor";

/** Token-backed size steps. `xs` is the documented minimum legible size. */
export type LogoSize = "xs" | "sm" | "md" | "lg";

const SIZE_TOKEN: Record<LogoSize, string> = {
  xs: "var(--logo-mark-size-xs)",
  sm: "var(--logo-mark-size-sm)",
  md: "var(--logo-mark-size-md)",
  lg: "var(--logo-mark-size-lg)",
};

interface LogoMarkProps {
  variant?: LogoVariant;
  /** Token size step. Drawn on a 48×48 grid, so every step is exact. */
  size?: LogoSize;
  className?: string;
}

export function LogoMark({ variant = "ring", size = "md", className }: LogoMarkProps) {
  const box = SIZE_TOKEN[size];

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ width: box, height: box }}
      className={cn("ve-logo__mark", className)}
    >
      {variant === "ring" && (
        <>
          {/* Open power ring — gap at 12 o'clock for the bolt to pass through */}
          <path
            d="M15.97 6.78 A19 19 0 1 0 32.03 6.78"
            style={{
              stroke: "var(--logo-mark-ring)",
              strokeWidth: "var(--logo-mark-ring-width)",
            }}
            strokeLinecap="round"
          />
          {/* Bolt breaks the ring only at the top gap; the tail stays clear of
              the stroke at the bottom (inner radius 16.25 on the 48 grid). */}
          <path
            d="M25.5 3 L15 25 H21.5 L19 37 L32 20 H25.5 Z"
            style={{ fill: "var(--logo-mark-bolt)" }}
          />
        </>
      )}

      {variant === "monogram" && (
        <>
          {/* Left arm */}
          <path d="M3 6 H13 L29 44 H19 Z" style={{ fill: "var(--logo-mark-arm-strong)" }} />
          {/* Right arm — lighter tint, overlaps at the base for a charged split */}
          <path d="M35 6 H45 L29 44 H19 Z" style={{ fill: "var(--logo-mark-arm-soft)" }} />
        </>
      )}

      {variant === "badge" && (
        <>
          {/* rx is artboard geometry, like the path data — not a style token */}
          <rect width="48" height="48" rx="8" style={{ fill: "var(--logo-mark-tile-bg)" }} />
          <path
            d="M27 6 L12 27 H20.5 L18 42 L36 21 H27.5 Z"
            style={{ fill: "var(--logo-mark-tile-fg)" }}
          />
        </>
      )}

      {variant === "rotor" && (
        <g style={{ fill: "var(--logo-mark-rotor)" }}>
          <path d="M24 22 C30 20, 38 14, 41 8 C37 15, 31 20, 24 24 Z" />
          <path
            d="M24 22 C30 20, 38 14, 41 8 C37 15, 31 20, 24 24 Z"
            transform="rotate(120 24 24)"
          />
          <path
            d="M24 22 C30 20, 38 14, 41 8 C37 15, 31 20, 24 24 Z"
            transform="rotate(240 24 24)"
          />
          <circle cx="24" cy="24" r="3.5" />
        </g>
      )}
    </svg>
  );
}

/**
 * The mark is decorative (`aria-hidden`) and the wordmark is real text, so a
 * `Logo` inside a link needs `aria-label` on that link — the wordmark can be
 * hidden at small widths and would otherwise leave the link unnamed.
 */
interface LogoProps extends LogoMarkProps {
  /** Hide the "Vaishnavi / Enterprises" lockup (mark only). */
  wordmarkHidden?: boolean;
  /** Larger wordmark step — pairs with `size="lg"`. */
  emphasis?: boolean;
  /** Hide the lockup below `sm` — the storefront header pattern. */
  wordmarkResponsive?: boolean;
}

export default function Logo({
  variant = "ring",
  size = "md",
  className,
  wordmarkHidden = false,
  emphasis = false,
  wordmarkResponsive = false,
}: LogoProps) {
  return (
    <span className={cn("ve-logo", emphasis && "ve-logo--lg", className)}>
      <LogoMark variant={variant} size={size} />
      {!wordmarkHidden && (
        <span
          className={cn("ve-logo__words", wordmarkResponsive && "hidden sm:flex")}
        >
          <span className="ve-logo__name">Vaishnavi</span>
          <span className="ve-logo__sub">Enterprises</span>
        </span>
      )}
    </span>
  );
}
