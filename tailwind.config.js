/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ===== Modern Refined Design System (Emerald + Cyan) =====
        brand: {
          primary: '#10B981',
          'primary-hover': '#059669',
          'primary-light': '#34D399',
          'primary-soft': '#6EE7B7',
          cyan: '#06B6D4',
        },
        // Base
        base: {
          white: '#FFFFFF',
          bg: '#FFFFFF',
          'bg-subtle': '#F8FAFC',
          'bg-subtle-2': '#F1F5F9',
        },
        // Border
        border: {
          DEFAULT: '#E2E8F0',
          subtle: '#F1F5F9',
          input: '#CBD5E1',
        },
        // Text
        ink: {
          DEFAULT: '#0F172A',
          secondary: '#64748B',
          muted: '#94A3B8',
          placeholder: '#CBD5E1',
        },
        // Hero
        hero: {
          dark: '#0F172A',
          'dark-mid': '#1E293B',
          text: '#FFFFFF',
          'text-secondary': 'rgba(203,213,225,1)',
        },
        // Emerald
        emerald: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        // Cyan
        cyan: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
        },
        // Slate
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // Semantic colors
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        error: '#EF4444',
        info: '#3B82F6',
        // Avatar gradients
        avatar: {
          emerald: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
          purple: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
          amber: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
          red: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
          pink: 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
          slate: 'linear-gradient(135deg, #64748B 0%, #94A3B8 100%)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
        'gradient-primary-soft': 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,182,212,0.08) 100%)',
        'gradient-hero': 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)',
        'gradient-glow': 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.15) 0%, transparent 60%)',
        'gradient-text': 'linear-gradient(135deg, #34D399 0%, #06B6D4 100%)',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(15,23,42,0.04)',
        'card': '0 1px 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.02)',
        'card-hover': '0 8px 25px rgba(15,23,42,0.05), 0 2px 6px rgba(15,23,42,0.04)',
        'button': '0 2px 8px rgba(16,185,129,0.05)',
        'button-lg': '0 4px 16px rgba(16,185,129,0.05)',
        'glow': '0 0 40px rgba(16,185,129,0.05)',
        'float': '0 12px 40px rgba(15,23,42,0.05)',
        'glow-emerald': '0 0 0 3px rgba(16, 185, 129, 0.12)',
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '16px',
        'xl': '16px',
        'card': '14px',
        'button': '10px',
        'input': '10px',
        'full': '9999px',
      },
      backdropBlur: {
        '20': '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'float': 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
