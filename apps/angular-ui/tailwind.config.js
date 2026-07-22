module.exports = {
  // If you are using your shared preset, it should still be here:
  presets: [require('../../shared/styles/tailwind.preset.js')],
  content: ['./index.html', './src/**/*.{js,ts,html}', '../../shared/ui/src/**/*.{js,ts,html}'],
  theme: {
    extend: {}
  },
  plugins: []
};
