/* eslint-disable @typescript-eslint/no-require-imports -- Expo plugin çözümleyicisi app.plugin.js'i CommonJS olarak require ile yükler. */
// Expo config plugin giriş noktası: app.json → "plugins": [["@herosignal/react-native", { ... }]]
const plugin = require('./plugin/build');

module.exports = plugin.default ?? plugin;
