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
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        heading: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      borderRadius: {
        md: "0.375rem",
        lg: "0.5rem",
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
