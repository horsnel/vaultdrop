import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#0a0a0f',
          card: '#111118',
          border: '#1e1e2e',
          'border-light': '#2a2a3e',
        },
        neon: {
          purple: '#8b5cf6',
          blue: '#3b82f6',
          green: '#10b981',
          red: '#ef4444',
          gold: '#f59e0b',
          orange: '#f97316',
          cyan: '#06b6d4',
          pink: '#ec4899',
          yellow: '#eab308',
        },
      },
      boxShadow: {
        'neon-purple': '0 0 20px rgba(139, 92, 246, 0.3)',
        'neon-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
        'neon-green': '0 0 20px rgba(16, 185, 129, 0.3)',
        'neon-red': '0 0 20px rgba(239, 68, 68, 0.3)',
        'neon-gold': '0 0 20px rgba(245, 158, 11, 0.3)',
        'card': '0 0 0 1px rgba(30, 30, 46, 1), 0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 0 0 1px rgba(139, 92, 246, 0.3), 0 8px 32px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'gradient': 'gradient 8s ease infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(139, 92, 246, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 50%, #10b981 100%)',
      },
    },
  },
  plugins: [],
}
export default config
