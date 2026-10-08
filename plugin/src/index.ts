import { createRunOncePlugin, WarningAggregator } from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';
import { resolveProps } from './options';
import type { HeroSignalPluginProps } from './options';
import { withHeroSignalAndroid } from './withHeroSignalAndroid';
import { withHeroSignalIos } from './withHeroSignalIos';
import * as fs from 'fs';
import * as path from 'path';

// Hem plugin/src (test) hem plugin/build (yayın) konumundan paket köküne iki seviye yukarı.
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')) as { name: string; version: string };

/**
 * HeroSignal Expo config plugin: iOS push yetenekleri (aps-environment, arka plan bildirimi, App Group),
 * Notification Service Extension hedefi ve Android bildirim ikonları / manifest / google-services ayarları.
 */
const withHeroSignal: ConfigPlugin<HeroSignalPluginProps | void> = (config, props) => {
  const resolved = resolveProps(props ?? undefined);
  if (!resolved.disableNotificationServiceExtension && !resolved.appId) {
    WarningAggregator.addWarningIOS(
      'herosignal',
      'appId verilmedi: Notification Service Extension, App ID ve API adresini uygulama ilk açıldığında App Group üzerinden alır. ' +
        'İlk açılıştan önce gelen bildirimlerde confirmed delivery (received) bildirilemez.',
    );
  }
  config = withHeroSignalIos(config, resolved);
  config = withHeroSignalAndroid(config, resolved);
  return config;
};

export type { HeroSignalPluginProps } from './options';
export default createRunOncePlugin(withHeroSignal, pkg.name, pkg.version);
