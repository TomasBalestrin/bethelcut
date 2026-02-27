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
          primary: '#08090f',
          secondary: '#0d1017',
          tertiary: '#13161f',
          timeline: '#060810',
          surface: '#111420',
          hover: '#191d2a',
        },
        text: {
          primary: '#dfe3ea',
          secondary: '#7c8696',
          muted: '#4a5264',
          accent: '#6889bf',
        },
        accent: {
          primary: '#3f6fad',
          secondary: '#5283bf',
          success: '#3e7d6a',
          warning: '#a6833f',
          danger: '#944646',
        },
        border: {
          default: '#181d2a',
          active: '#3f6fad',
        },
        timeline: {
          playhead: '#6889bf',
          clip: '#3f6fad',
          audio: '#3e7d6a',
          caption: '#a6833f',
          silence: 'rgba(104,137,191,0.15)',
          selection: 'rgba(63,111,173,0.12)',
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
