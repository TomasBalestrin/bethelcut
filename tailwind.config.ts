import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#1a1a2e',
          secondary: '#16213e',
          tertiary: '#0f3460',
          timeline: '#111827',
          surface: '#1e293b',
          hover: '#334155',
        },
        text: {
          primary: '#f1f5f9',
          secondary: '#94a3b8',
          muted: '#64748b',
          accent: '#38bdf8',
        },
        accent: {
          primary: '#3b82f6',
          secondary: '#8b5cf6',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
        border: {
          default: '#334155',
          active: '#3b82f6',
        },
        timeline: {
          playhead: '#ef4444',
          clip: '#3b82f6',
          audio: '#22c55e',
          caption: '#f59e0b',
          silence: 'rgba(239,68,68,0.3)',
          selection: 'rgba(59,130,246,0.2)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
