/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
        "colors": {
            "background": "#fef9ef",
            "secondary-fixed-dim": "#c8c6c5",
            "surface": "#FFFFFF",
            "secondary": "#5f5e5e",
            "on-primary-fixed-variant": "#6d3900",
            "surface-bright": "#fef9ef",
            "on-primary": "#ffffff",
            "tertiary-fixed-dim": "#93ccff",
            "secondary-fixed": "#e5e2e1",
            "on-tertiary-container": "#003756",
            "tertiary-fixed": "#cce5ff",
            "on-secondary-container": "#636262",
            "danger": "#E63946",
            "surface-tint": "#904d00",
            "on-surface-variant": "#554335",
            "on-secondary": "#ffffff",
            "primary": "#904d00",
            "on-primary-fixed": "#2e1500",
            "on-error": "#ffffff",
            "surface-dim": "#dedad0",
            "on-background": "#1d1c16",
            "error-container": "#ffdad6",
            "surface-container-low": "#f8f3e9",
            "surface-container-lowest": "#ffffff",
            "on-secondary-fixed": "#1c1b1b",
            "primary-fixed": "#ffdcc2",
            "on-primary-container": "#512900",
            "tertiary-container": "#00a4f6",
            "on-tertiary-fixed-variant": "#004b73",
            "surface-variant": "#e7e2d8",
            "warning": "#F2B705",
            "surface-container": "#f2ede3",
            "inverse-on-surface": "#f5f0e6",
            "info": "#2E86AB",
            "inverse-surface": "#32302a",
            "inverse-primary": "#ffb77b",
            "on-tertiary": "#ffffff",
            "tertiary": "#006397",
            "on-tertiary-fixed": "#001d31",
            "error": "#ba1a1a",
            "on-error-container": "#93000a",
            "surface-container-highest": "#e7e2d8",
            "primary-fixed-dim": "#ffb77b",
            "surface-container-high": "#ece8de",
            "secondary-container": "#e2dfde",
            "deep-orange": "#C1440E",
            "success": "#3FA34D",
            "outline": "#887363",
            "primary-container": "#e8820d",
            "on-surface": "#1d1c16",
            "outline-variant": "#dcc2af",
            "on-secondary-fixed-variant": "#474746"
        },
        "borderRadius": {
            "DEFAULT": "0.25rem",
            "lg": "0.5rem",
            "xl": "0.75rem",
            "full": "9999px"
        },
        "spacing": {
            "margin": "32px",
            "gutter": "24px",
            "base": "8px",
            "bento-gap": "16px"
        },
        "fontFamily": {
            "data-md": ["JetBrains Mono"],
            "body-lg": ["Inter"],
            "label-sm": ["Inter"],
            "display-lg": ["Space Grotesk"],
            "body-md": ["Inter"],
            "headline-lg": ["Space Grotesk"],
            "headline-md": ["Space Grotesk"],
            "data-lg": ["JetBrains Mono"]
        },
        "fontSize": {
            "data-md": ["14px", { "lineHeight": "1.4", "fontWeight": "500" }],
            "body-lg": ["18px", { "lineHeight": "1.6", "fontWeight": "400" }],
            "label-sm": ["12px", { "lineHeight": "1", "letterSpacing": "0.05em", "fontWeight": "700" }],
            "display-lg": ["48px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700" }],
            "body-md": ["16px", { "lineHeight": "1.5", "fontWeight": "400" }],
            "headline-lg": ["32px", { "lineHeight": "1.2", "fontWeight": "700" }],
            "headline-md": ["24px", { "lineHeight": "1.2", "fontWeight": "700" }],
            "data-lg": ["20px", { "lineHeight": "1.4", "fontWeight": "600" }]
        }
    }
  },
  plugins: [
    require('@tailwindcss/container-queries')
  ],
}
