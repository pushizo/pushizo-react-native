import { generateImageAsync } from '@expo/image-utils';
import { AndroidConfig, withAndroidColors, withAndroidManifest, withDangerousMod } from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';
import type { ResolvedHeroSignalPluginProps } from './options';
import { HeroSignalPluginError } from './options';

/** Native SDK'nın okuduğu varsayılan ikon meta-data anahtarı (sdk/android AndroidManifest.xml). */
export const META_DEFAULT_ICON = 'com.herosignal.sdk.default_notification_icon';
/** Varsayılan vurgu rengi meta-data anahtarı. */
export const META_DEFAULT_COLOR = 'com.herosignal.sdk.default_notification_color';
export const ACCENT_COLOR_NAME = 'herosignal_notification_accent_color';

/** Küçük ikon yoğunlukları (Android status bar ikonu: 24dp). */
export const SMALL_ICON_SIZES: Record<string, number> = {
  mdpi: 24,
  hdpi: 36,
  xhdpi: 48,
  xxhdpi: 72,
  xxxhdpi: 96,
};
export const LARGE_ICON_SIZE = 256;

/** Dosya adından Android kaynak adı üretir (`My Icon-2.png` → `my_icon_2`). */
export function resourceNameFromPath(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  let name = base.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (name === '' || !/^[a-z]/.test(name)) name = `hs_${name}`;
  return name;
}

/** Aynı kaynak adına düşen iki dosya olmamalı (biri diğerini ezer). */
function assertUniqueNames(files: string[], kind: string): string[] {
  const names = files.map(resourceNameFromPath);
  const duplicate = names.find((n, i) => names.indexOf(n) !== i);
  if (duplicate) throw new HeroSignalPluginError(`${kind} içinde aynı kaynak adına (${duplicate}) dönüşen birden çok dosya var.`);
  return names;
}

export interface IconOutput {
  /** `res/` altına göre yol, ör. `drawable-xhdpi/ic_stat_bell.png`. */
  relativePath: string;
  src: string;
  size: number;
  name: string;
}

/** Üretilecek ikon dosyalarının listesi (saf hesap; testlerde doğrulanır). */
export function planIconOutputs(props: Pick<ResolvedHeroSignalPluginProps, 'smallIcons' | 'largeIcons'>): IconOutput[] {
  const outputs: IconOutput[] = [];
  const smallNames = assertUniqueNames(props.smallIcons, 'smallIcons');
  props.smallIcons.forEach((src, i) => {
    for (const [density, size] of Object.entries(SMALL_ICON_SIZES)) {
      outputs.push({ relativePath: `drawable-${density}/${smallNames[i]}.png`, src, size, name: smallNames[i] });
    }
  });
  const largeNames = assertUniqueNames(props.largeIcons, 'largeIcons');
  props.largeIcons.forEach((src, i) => {
    outputs.push({ relativePath: `drawable-xxxhdpi/${largeNames[i]}.png`, src, size: LARGE_ICON_SIZE, name: largeNames[i] });
  });
  return outputs;
}

/** İkonları `android/app/src/main/res` altına PNG olarak yazar. */
const withNotificationIcons: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const resDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      for (const output of planIconOutputs(props)) {
        const src = path.resolve(projectRoot, output.src);
        if (!fs.existsSync(src)) throw new HeroSignalPluginError(`İkon dosyası bulunamadı: ${output.src}`);
        const { source } = await generateImageAsync(
          { projectRoot, cacheType: 'herosignal-notification-icons' },
          { src, width: output.size, height: output.size, resizeMode: 'contain', backgroundColor: 'transparent' },
        );
        const dest = path.join(resDir, output.relativePath);
        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
        await fs.promises.writeFile(dest, source);
      }
      return cfg;
    },
  ]);

type ManifestMetaItem = { $: Record<string, string | undefined> };

/** Kütüphane manifestindeki aynı anahtarlı meta-data'yı uygulama değeriyle değiştirir (`tools:replace`). */
export function setReplacingMetaData(
  manifest: AndroidConfig.Manifest.AndroidManifest,
  name: string,
  resource: string,
): AndroidConfig.Manifest.AndroidManifest {
  AndroidConfig.Manifest.ensureToolsAvailable(manifest);
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, name, resource, 'resource');
  const item = (app['meta-data'] as ManifestMetaItem[] | undefined)?.find((m) => m.$['android:name'] === name);
  if (item) item.$['tools:replace'] = 'android:resource';
  return manifest;
}

const withNotificationManifest: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) =>
  withAndroidManifest(config, (cfg) => {
    if (props.smallIcons.length > 0) {
      setReplacingMetaData(cfg.modResults, META_DEFAULT_ICON, `@drawable/${resourceNameFromPath(props.smallIcons[0])}`);
    }
    if (props.smallIconAccentColor) {
      setReplacingMetaData(cfg.modResults, META_DEFAULT_COLOR, `@color/${ACCENT_COLOR_NAME}`);
    }
    // Android 13+ bildirim izni (kütüphane manifestinden de birleşir; açıkça eklemek izin isteğini görünür kılar).
    AndroidConfig.Permissions.ensurePermissions(cfg.modResults, ['android.permission.POST_NOTIFICATIONS']);
    return cfg;
  });

const withAccentColor: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) => {
  const color = props.smallIconAccentColor;
  if (!color) return config;
  return withAndroidColors(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, { name: ACCENT_COLOR_NAME, value: color });
    return cfg;
  });
};

/** FCM için google-services: `android.googleServicesFile` yoksa eklenti seçeneği kullanılır. */
const withGoogleServices: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) => {
  if (!config.android?.googleServicesFile && props.googleServicesFile) {
    config.android = { ...config.android, googleServicesFile: props.googleServicesFile };
  }
  if (!config.android?.googleServicesFile) return config;
  config = AndroidConfig.GoogleServices.withClassPath(config);
  config = AndroidConfig.GoogleServices.withApplyPlugin(config);
  config = AndroidConfig.GoogleServices.withGoogleServicesFile(config);
  return config;
};

export const withHeroSignalAndroid: ConfigPlugin<ResolvedHeroSignalPluginProps> = (config, props) => {
  config = withGoogleServices(config, props);
  config = withNotificationManifest(config, props);
  config = withAccentColor(config, props);
  if (props.smallIcons.length > 0 || props.largeIcons.length > 0) {
    config = withNotificationIcons(config, props);
  }
  return config;
};
