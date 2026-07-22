module.exports = {
  // If you are using your shared preset, it should still be here:
  presets: [require('../../shared/styles/tailwind.preset.js')],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // ADD THIS LINE: Tell Tailwind to scan the shared UI package
    '../../shared/ui/src/**/*.{js,ts,html}'
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
