import { type ConfigPlugin, createRunOncePlugin } from '@expo/config-plugins';
import { withHeroSignalAndroid } from './android';
import { withHeroSignalIos } from './ios';
import { type HeroSignalPluginProps, validateProps } from './props';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('../../package.json') as { name: string; version: string };

/**
 * HeroSignal Expo config plugin.
 *
 * iOS: push yetkisi (aps-environment), arka plan modu (remote-notification), App Group, APNs token iletimi
 * (AppDelegate), Notification Service Extension hedefi ve Podfile. Android: POST_NOTIFICATIONS, varsayılan bildirim
 * ikonu/rengi, erken başlatma meta-data'sı (onay, günlük seviyesi, varsayılan kanal) ve google-services.json kopyalama +
 * `com.google.gms.google-services` Gradle eklentisi (dosya yoksa uyarı).
 *
 * ```json
 * ["@herosignal/react-native", { "mode": "development", "appId": "app_…", "androidSmallIcon": "./assets/notification-icon.png" }]
 * ```
 */
const withHeroSignal: ConfigPlugin<HeroSignalPluginProps> = (config, input) => {
  const props = validateProps(input);
  config = withHeroSignalIos(config, props);
  config = withHeroSignalAndroid(config, props);
  return config;
};

export type { HeroSignalPluginProps } from './props';
export default createRunOncePlugin(withHeroSignal, pkg.name, pkg.version);
