const tokens = require("./design-tokens.json");

/** Flatten a primitive token group ({ "600": { $value } }) into a Tailwind scale. */
const scale = (group) =>
  Object.fromEntries(Object.entries(group).map(([step, token]) => [step, token.$value]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Single source of truth: design-tokens.json primitive layer.
        // Emitted as literal hex so opacity modifiers (bg-brand-orange-600/40)
        // keep working. Edit the JSON, not this file.
        brand: {
          orange: scale(tokens.primitive.color.brand.orange),
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          active: "var(--color-primary-active)",
          subtle: "var(--color-primary-subtle)",
          fg: "var(--color-on-primary)",
        },
        admin: {
          bg: "var(--color-bg)",
          surface: "var(--color-surface)",
          "surface-raised": "var(--color-surface-raised)",
          "surface-sunken": "var(--color-surface-sunken)",
          fg: "var(--color-fg)",
          "fg-muted": "var(--color-fg-muted)",
          "fg-subtle": "var(--color-fg-subtle)",
          border: "var(--color-border)",
          "border-strong": "var(--color-border-strong)",
          ring: "var(--color-ring)",
          success: "var(--color-success)",
          "success-subtle": "var(--color-success-subtle)",
          warning: "var(--color-warning)",
          "warning-subtle": "var(--color-warning-subtle)",
          danger: "var(--color-danger)",
          "danger-hover": "var(--color-danger-hover)",
          "danger-subtle": "var(--color-danger-subtle)",
          info: "var(--color-info)",
          "info-subtle": "var(--color-info-subtle)",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#F8FAFC",
          sunken: "#EFF4FF",
          inverse: "#131B2E",
        },
        border: {
          base: "#E2E8F0",
        },
        muted: "#94A3B8",
        success: "#16A34A",
        danger: "#DC2626",
        warning: "#D97706",
        whatsapp: "#25D366",
      },
      fontFamily: {
        sans: ["var(--font-fira-sans)", "var(--font-sans)", "var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-fira-mono)", "var(--font-mono)", "Menlo", "Consolas", "monospace"],
        heading: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      fontSize: {
        "admin-xs": ["var(--text-xs)", { lineHeight: "var(--leading-normal)" }],
        "admin-sm": ["var(--text-sm)", { lineHeight: "var(--leading-normal)" }],
        "admin-base": ["var(--text-base)", { lineHeight: "var(--leading-normal)" }],
        "admin-lg": ["var(--text-lg)", { lineHeight: "var(--leading-normal)" }],
        "admin-xl": ["var(--text-xl)", { lineHeight: "var(--leading-tight)" }],
        "admin-2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-tight)" }],
        "admin-3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-tight)" }],
      },
      borderRadius: {
        "admin-sm": "var(--radius-sm)",
        "admin-md": "var(--radius-md)",
        "admin-lg": "var(--radius-lg)",
        "admin-full": "var(--radius-full)",
        md: "0.375rem",
        lg: "0.5rem",
      },
      spacing: {
        "admin-1": "var(--space-1)",
        "admin-2": "var(--space-2)",
        "admin-3": "var(--space-3)",
        "admin-4": "var(--space-4)",
        "admin-5": "var(--space-5)",
        "admin-6": "var(--space-6)",
        "admin-8": "var(--space-8)",
        "admin-10": "var(--space-10)",
        "admin-12": "var(--space-12)",
      },
      boxShadow: {
        "admin-sm": "var(--shadow-sm)",
        "admin-md": "var(--shadow-md)",
        "admin-lg": "var(--shadow-lg)",
      },
      maxWidth: {
        content: "1280px",
      },
      // Explicit layering. Dialogs previously shared z-50 with the mobile
      // bottom nav and the admin sidebar, so site chrome painted over them.
      zIndex: {
        chrome: "40",
        "chrome-top": "50",
        modal: "100",
      },
    },
  },
  plugins: [],
};
