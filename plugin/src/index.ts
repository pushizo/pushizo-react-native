import { type ConfigPlugin, createRunOncePlugin } from '@expo/config-plugins';
import { withPushizoAndroid } from './android';
import { withPushizoIos } from './ios';
import { type PushizoPluginProps, validateProps } from './props';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../../package.json') as { name: string; version: string };

/**
 * Pushizo Expo config plugin.
 *
 * iOS: push yetkisi (aps-environment), arka plan modu (remote-notification), App Group, APNs token iletimi
 * (AppDelegate), Notification Service Extension hedefi ve Podfile. Android: POST_NOTIFICATIONS, varsayılan bildirim
 * ikonu/rengi, erken başlatma meta-data'sı (onay, günlük seviyesi, varsayılan kanal) ve google-services.json kopyalama +
 * `com.google.gms.google-services` Gradle eklentisi (dosya yoksa uyarı).
 *
 * ```json
 * ["@pushizo/react-native", { "mode": "development", "appId": "app_…", "androidSmallIcon": "./assets/notification-icon.png" }]
 * ```
 */
const withPushizo: ConfigPlugin<PushizoPluginProps> = (config, input) => {
  const props = validateProps(input);
  config = withPushizoIos(config, props);
  config = withPushizoAndroid(config, props);
  return config;
};

export type { PushizoPluginProps } from './props';
export default createRunOncePlugin(withPushizo, pkg.name, pkg.version);
