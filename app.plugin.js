// Expo config plugin giriş noktası: app.json → "plugins": [["@herosignal/react-native", { "mode": "development" }]]
// Expo eklentiyi CommonJS olarak yükler; derlenmiş çıktı yalnızca require ile alınabilir.
// eslint-disable-next-line @typescript-eslint/no-require-imports
module.exports = require('./plugin/build').default;
