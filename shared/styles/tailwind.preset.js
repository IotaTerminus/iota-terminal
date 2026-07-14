/**
 * iota-terminal shared Tailwind preset.
 *
 * Single source of truth for the terminal visual theme, consumed by both
 * apps/react-ui/tailwind.config.js and apps/angular-ui/tailwind.config.js
 * via the `presets` option. Do not duplicate these tokens in either app;
 * extend this preset instead so the two frontends stay visually identical.
 */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0a0e0a',
          fg: '#33ff33',
          dim: '#1a4d1a',
          amber: '#ffb000',
          red: '#ff3333',
          cyan: '#33ffe0'
        }
      },
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace'
        ]
      },
      keyframes: {
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' }
        }
      },
      animation: {
        blink: 'blink 1s step-end infinite'
      }
    }
  },
  plugins: []
};
