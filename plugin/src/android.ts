import {
  AndroidConfig,
  CodeGenerator,
  type ConfigPlugin,
  WarningAggregator,
  withAndroidColors,
  withAndroidManifest,
  withDangerousMod,
  withSettingsGradle,
} from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import { generateImageAsync } from '@expo/image-utils';
import * as fs from 'fs';
import * as path from 'path';
import type { ResolvedProps } from './props';

export const PLUGIN_NAME = '@pushizo/react-native';
export const ICON_RESOURCE = 'pushizo_notification_icon';
export const COLOR_RESOURCE = 'pushizo_notification_color';

/** Yerel SDK ve köprünün okuduğu manifest meta-data anahtarları. */
export const META = {
  icon: 'com.pushizo.sdk.default_notification_icon',
  color: 'com.pushizo.sdk.default_notification_color',
  appId: 'com.pushizo.reactnative.app_id',
  apiUrl: 'com.pushizo.reactnative.api_url',
  requiresConsent: 'com.pushizo.reactnative.requires_privacy_consent',
  logLevel: 'com.pushizo.reactnative.log_level',
  channelId: 'com.pushizo.reactnative.default_channel_id',
  channelName: 'com.pushizo.reactnative.default_channel_name',
} as const;

/** Android bildirim küçük ikonu boyutları (dp 24 → px). */
export const ICON_SIZES: Record<string, number> = {
  mdpi: 24,
  hdpi: 36,
  xhdpi: 48,
  xxhdpi: 72,
  xxxhdpi: 96,
};

type AndroidManifest = AndroidConfig.Manifest.AndroidManifest;

/** `androidLocationPermission` → ön plan konum izinleri (Android 12+ hassas izin yaklaşık izinle birlikte istenir). */
export const LOCATION_PERMISSIONS = {
  coarse: ['android.permission.ACCESS_COARSE_LOCATION'],
  fine: ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION'],
} as const;

/** POST_NOTIFICATIONS (ve isteğe bağlı konum) izni ve meta-data (ikon, renk, erken başlatma). Saf fonksiyon: test edilebilir. */
export function applyAndroidManifest(manifest: AndroidManifest, props: ResolvedProps): AndroidManifest {
  AndroidConfig.Permissions.ensurePermissions(manifest, ['android.permission.POST_NOTIFICATIONS']);
  // Konum izni yalnızca açıkça istenirse eklenir; verilmezse uygulamanın kendi izinlerine dokunulmaz.
  if (props.androidLocationPermission) {
    AndroidConfig.Permissions.ensurePermissions(manifest, [...LOCATION_PERMISSIONS[props.androidLocationPermission]]);
  }
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const set = (name: string, value: string, type: 'value' | 'resource' = 'value') =>
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, name, value, type);
  const unset = (name: string): void => {
    AndroidConfig.Manifest.removeMetaDataItemFromMainApplication(app, name);
  };

  if (props.androidSmallIcon) set(META.icon, `@drawable/${ICON_RESOURCE}`, 'resource');
  else unset(META.icon);
  if (props.androidAccentColor) set(META.color, `@color/${COLOR_RESOURCE}`, 'resource');
  else unset(META.color);

  if (props.appId) {
    set(META.appId, props.appId);
    if (props.apiUrl) set(META.apiUrl, props.apiUrl);
    else unset(META.apiUrl);
    set(META.requiresConsent, String(props.requiresPrivacyConsent === true));
    if (props.logLevel) set(META.logLevel, props.logLevel);
    else unset(META.logLevel);
    if (props.androidDefaultChannelId) set(META.channelId, props.androidDefaultChannelId);
    else unset(META.channelId);
    if (props.androidDefaultChannelName) set(META.channelName, props.androidDefaultChannelName);
    else unset(META.channelName);
  } else {
    [META.appId, META.apiUrl, META.requiresConsent, META.logLevel, META.channelId, META.channelName].forEach(unset);
  }
  return manifest;
}

/** Monorepo: `:pushizo` modülünü settings.gradle'a ekler (köprü build.gradle'ı bu modülü kaynaktan kullanır). */
export function applySettingsGradle(contents: string, sdkPath: string): string {
  const newSrc = [
    "include ':pushizo'",
    `project(':pushizo').projectDir = new File(rootProject.projectDir, '${sdkPath.replace(/\\/g, '/')}')`,
  ].join('\n');
  return CodeGenerator.mergeContents({
    src: contents,
    newSrc,
    tag: 'pushizo-android-sdk',
    anchor: /include ':app'/,
    offset: 1,
    comment: '//',
  }).contents;
}

/** Küçük ikonu tüm yoğunluklar için `res/drawable-<yoğunluk>/pushizo_notification_icon.png` olarak üretir. */
export async function writeNotificationIcons(projectRoot: string, platformProjectRoot: string, src: string): Promise<void> {
  const source = path.resolve(projectRoot, src);
  if (!fs.existsSync(source)) {
    throw new Error(`${PLUGIN_NAME} config plugin: "androidSmallIcon" dosyası bulunamadı: ${source}`);
  }
  const resDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'res');
  for (const [density, size] of Object.entries(ICON_SIZES)) {
    const { source: png } = await generateImageAsync(
      { projectRoot, cacheType: 'pushizo-notification-icon' },
      { src: source, width: size, height: size, resizeMode: 'cover', backgroundColor: 'transparent' },
    );
    const dir = path.join(resDir, `drawable-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${ICON_RESOURCE}.png`), png);
  }
}

/**
 * `android.googleServicesFile` dosyasını `android/app/google-services.json` olarak kopyalar. Kaynak yoksa hangi alanın
 * düzeltileceğini söyleyen açık hata verilir (Expo'nun genel kopyalama hatası yerine).
 */
export async function copyGoogleServicesFile(config: Pick<ExpoConfig, 'android'>, projectRoot: string): Promise<string> {
  const file = config.android?.googleServicesFile;
  if (!file) throw new Error(`${PLUGIN_NAME} config plugin: "android.googleServicesFile" tanımlı değil.`);
  const source = path.resolve(projectRoot, file);
  if (!fs.existsSync(source)) {
    throw new Error(`${PLUGIN_NAME} config plugin: app.json → "android.googleServicesFile" dosyası bulunamadı: ${source}`);
  }
  await AndroidConfig.GoogleServices.setGoogleServicesFile(config, projectRoot);
  return path.join(projectRoot, 'android', 'app', 'google-services.json');
}

export const withPushizoAndroid: ConfigPlugin<ResolvedProps> = (config, props) => {
  if (!config.android?.googleServicesFile) {
    WarningAggregator.addWarningAndroid(
      PLUGIN_NAME,
      'FCM için google-services.json gerekli: Firebase konsolundan indirip app.json → "android.googleServicesFile" alanına yolunu yazın (ör. "./google-services.json"). Ardından FCM v1 servis hesabı JSON dosyasını Pushizo panelinde Android kimlik bilgisi olarak yükleyin.',
    );
  } else {
    // Expo prebuild aynı adımları varsayılan eklentilerinde de uygular; buradaki çağrılar idempotenttir (sınıf yolu ve
    // `apply plugin` zaten varsa eklenmez). Böylece varsayılan eklentiler olmadan çalışan prebuild akışlarında da
    // (ör. yalnız config plugin zinciri) FCM yapılandırması eksik kalmaz.
    config = AndroidConfig.GoogleServices.withClassPath(config);
    config = AndroidConfig.GoogleServices.withApplyPlugin(config);
    config = withDangerousMod(config, [
      'android',
      async (c) => {
        await copyGoogleServicesFile(c, c.modRequest.projectRoot);
        return c;
      },
    ]);
  }

  config = withAndroidManifest(config, (c) => {
    c.modResults = applyAndroidManifest(c.modResults, props);
    return c;
  });

  if (props.androidAccentColor) {
    const color = props.androidAccentColor;
    config = withAndroidColors(config, (c) => {
      c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: COLOR_RESOURCE, value: color });
      return c;
    });
  }

  if (props.androidSmallIcon) {
    const icon = props.androidSmallIcon;
    config = withDangerousMod(config, [
      'android',
      async (c) => {
        await writeNotificationIcons(c.modRequest.projectRoot, c.modRequest.platformProjectRoot, icon);
        return c;
      },
    ]);
  }

  if (props.androidSdkPath) {
    const sdkPath = props.androidSdkPath;
    config = withSettingsGradle(config, (c) => {
      if (c.modResults.language !== 'groovy') {
        throw new Error(`${PLUGIN_NAME} config plugin: "androidSdkPath" yalnızca Groovy settings.gradle ile desteklenir.`);
      }
      c.modResults.contents = applySettingsGradle(c.modResults.contents, sdkPath);
      return c;
    });
  }

  return config;
};
