import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        void: '#03040a',
        plasma: '#a855f7',
        ion: '#22d3ee',
        pulse: '#60a5fa',
        acid: '#9eff6e',
        warning: '#fbbf24',
      },
      boxShadow: {
        neon: '0 0 28px rgba(34, 211, 238, 0.24), 0 0 58px rgba(168, 85, 247, 0.16)',
        panel: '0 20px 80px rgba(0, 0, 0, 0.45), inset 0 0 28px rgba(96, 165, 250, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
