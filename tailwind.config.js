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
        // ===== Pure White + Emerald Design System =====
        // Base
        base: {
          white: '#FFFFFF',
          bg: '#FAFAFA',
          'bg-subtle': '#F5F5F5',
        },
        // Border
        border: {
          DEFAULT: '#F0F0F0',
          strong: '#E4E4E7',
          input: '#D4D4D8',
        },
        // Text
        ink: {
          DEFAULT: '#18181B',
          secondary: '#71717A',
          muted: '#A1A1AA',
          placeholder: '#D4D4D8',
        },
        // Emerald accent
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
        // Semantic colors
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        // Retain stone for compatibility
        stone: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E8E6E3',
          300: '#D6D3D1',
          400: '#A8A39E',
          500: '#78706C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'system-ui', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.06)',
        'button': '0 2px 8px rgba(16, 185, 129, 0.2)',
        'button-lg': '0 4px 16px rgba(16, 185, 129, 0.25)',
        'glow-emerald': '0 0 0 3px rgba(16, 185, 129, 0.12)',
      },
      borderRadius: {
        'card': '12px',
        'card-lg': '14px',
        'button': '10px',
        'input': '10px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
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
