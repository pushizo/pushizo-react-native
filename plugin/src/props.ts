/** Expo config plugin seçenekleri ve doğrulaması. */

export type ApnsMode = 'development' | 'production';
export type PluginLogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';
export type AndroidLocationPermission = 'coarse' | 'fine';

export interface HeroSignalPluginProps {
  /** APNs ortamı → `aps-environment` yetkisi (zorunlu). Mağaza/TestFlight derlemesi için `production`. */
  mode: ApnsMode;
  /**
   * HeroSignal app kimliği. Verilirse SDK uygulama açılışında (JS yüklenmeden) başlatılır ve Notification Service Extension
   * bu kimlikle `received` bildirir. NSE açıkken zorunludur.
   */
  appId?: string;
  /** Kendi barındırma için API adresi (varsayılan `https://api.herosignal.dev`). */
  apiUrl?: string;
  /** Erken başlatmada KVKK/GDPR onayı bekle (JS `initialize` seçeneğiyle aynı olmalı). */
  requiresPrivacyConsent?: boolean;
  /** Erken başlatma günlük seviyesi. */
  logLevel?: PluginLogLevel;
  /** iOS App Group; varsayılan `group.<bundle id>.herosignal` (SDK kuralı). */
  iosAppGroup?: string;
  /** Notification Service Extension hedefi eklensin mi (zengin medya, rozet, confirmed delivery). Varsayılan true. */
  iosNotificationServiceExtension?: boolean;
  /** NSE hedefinin iOS dağıtım hedefi (varsayılan `15.0`, SDK alt sınırı). */
  iosDeploymentTarget?: string;
  /** Apple Developer Team ID (NSE imzalama için; verilmezse Xcode'da seçilir). */
  devTeam?: string;
  /** Monorepo / yerel geliştirme: `sdk/ios` dizini (projeye göre). Verilirse Podfile'a `:path` ile eklenir. */
  iosSdkPath?: string;
  /** Monorepo / yerel geliştirme: `sdk/android/herosignal` modül dizini (android/ klasörüne göre). */
  androidSdkPath?: string;
  /** Bildirim küçük ikonu kaynağı (PNG, beyaz + saydam önerilir); tüm yoğunluklar için üretilir. */
  androidSmallIcon?: string;
  /** Bildirim vurgu rengi (`#RRGGBB`). */
  androidAccentColor?: string;
  /** Erken başlatmada varsayılan Android bildirim kanalı kimliği (JS `defaultChannelId` ile aynı olmalı). */
  androidDefaultChannelId?: string;
  /** Erken başlatmada varsayılan Android bildirim kanalının kullanıcıya görünen adı (JS `defaultChannelName`). */
  androidDefaultChannelName?: string;
  /**
   * Konum paylaşımı (`HeroSignal.Location`) için iOS "kullanırken" izin açıklaması → Info.plist
   * `NSLocationWhenInUseUsageDescription`. Verilmezse Info.plist'e dokunulmaz (uygulama `ios.infoPlist` ile ekleyebilir).
   */
  iosLocationUsageDescription?: string;
  /**
   * Konum paylaşımı için Android manifest izni: `coarse` → `ACCESS_COARSE_LOCATION`, `fine` → ek olarak
   * `ACCESS_FINE_LOCATION`. Verilmezse izin eklenmez; arka plan konum izni hiçbir zaman eklenmez.
   */
  androidLocationPermission?: AndroidLocationPermission;
}

export interface ResolvedProps extends HeroSignalPluginProps {
  iosNotificationServiceExtension: boolean;
  iosDeploymentTarget: string;
}

const KNOWN_KEYS = new Set<keyof HeroSignalPluginProps>([
  'mode',
  'appId',
  'apiUrl',
  'requiresPrivacyConsent',
  'logLevel',
  'iosAppGroup',
  'iosNotificationServiceExtension',
  'iosDeploymentTarget',
  'devTeam',
  'iosSdkPath',
  'androidSdkPath',
  'androidSmallIcon',
  'androidAccentColor',
  'androidDefaultChannelId',
  'androidDefaultChannelName',
  'iosLocationUsageDescription',
  'androidLocationPermission',
]);

const PREFIX = '@herosignal/react-native config plugin';
const LOG_LEVELS: PluginLogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];

function fail(message: string): never {
  throw new Error(`${PREFIX}: ${message}`);
}

function optionalString(props: Record<string, unknown>, key: string): void {
  const value = props[key];
  if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
    fail(`"${key}" boş olmayan bir metin olmalı.`);
  }
}

function optionalBoolean(props: Record<string, unknown>, key: string): void {
  const value = props[key];
  if (value !== undefined && typeof value !== 'boolean') fail(`"${key}" true/false olmalı.`);
}

/** Seçenekleri doğrular; hatalar hangi alanın nasıl düzeltileceğini söyler. */
export function validateProps(input: unknown): ResolvedProps {
  if (input === undefined || input === null) {
    fail('seçenekler gerekli. Örnek: ["@herosignal/react-native", { "mode": "development", "appId": "app_…" }]');
  }
  if (typeof input !== 'object' || Array.isArray(input)) fail('seçenekler bir nesne olmalı.');
  const props = input as Record<string, unknown>;

  for (const key of Object.keys(props)) {
    if (!KNOWN_KEYS.has(key as keyof HeroSignalPluginProps)) {
      fail(`bilinmeyen seçenek "${key}". Geçerli seçenekler: ${Array.from(KNOWN_KEYS).join(', ')}.`);
    }
  }

  if (props.mode !== 'development' && props.mode !== 'production') {
    fail('"mode" zorunlu ve "development" ya da "production" olmalı (APNs aps-environment).');
  }

  for (const key of ['appId', 'apiUrl', 'iosAppGroup', 'iosDeploymentTarget', 'devTeam', 'iosSdkPath', 'androidSdkPath', 'androidSmallIcon', 'androidAccentColor', 'androidDefaultChannelId', 'androidDefaultChannelName', 'iosLocationUsageDescription']) {
    optionalString(props, key);
  }
  optionalBoolean(props, 'requiresPrivacyConsent');
  optionalBoolean(props, 'iosNotificationServiceExtension');

  if (props.apiUrl !== undefined && !/^https?:\/\/[^\s]+$/.test(props.apiUrl as string)) {
    fail('"apiUrl" http(s) ile başlayan geçerli bir adres olmalı.');
  }
  if (props.logLevel !== undefined && !LOG_LEVELS.includes(props.logLevel as PluginLogLevel)) {
    fail(`"logLevel" şunlardan biri olmalı: ${LOG_LEVELS.join(', ')}.`);
  }
  if (props.iosAppGroup !== undefined && !/^group\.[A-Za-z0-9.-]+$/.test(props.iosAppGroup as string)) {
    fail('"iosAppGroup" "group." ile başlamalı ve yalnızca harf, rakam, nokta, tire içermeli (ör. group.com.example.app).');
  }
  if (props.iosDeploymentTarget !== undefined) {
    const match = /^(\d+)(\.\d+)?$/.exec(props.iosDeploymentTarget as string);
    if (!match || Number(match[1]) < 15) fail('"iosDeploymentTarget" 15.0 veya üzeri bir sürüm olmalı (ör. "15.0").');
  }
  if (props.devTeam !== undefined && !/^[A-Z0-9]{10}$/.test(props.devTeam as string)) {
    fail('"devTeam" 10 karakterlik Apple Team ID olmalı (ör. "ABCDE12345").');
  }
  if (props.androidAccentColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(props.androidAccentColor as string)) {
    fail('"androidAccentColor" #RRGGBB biçiminde olmalı (ör. "#FF5A1F").');
  }
  if (props.androidDefaultChannelId !== undefined && !/^[A-Za-z0-9._-]{1,100}$/.test(props.androidDefaultChannelId as string)) {
    fail('"androidDefaultChannelId" yalnızca harf, rakam, nokta, alt çizgi ve tire içermeli (en çok 100 karakter, ör. "herosignal_default").');
  }
  if (props.androidLocationPermission !== undefined && props.androidLocationPermission !== 'coarse' && props.androidLocationPermission !== 'fine') {
    fail('"androidLocationPermission" "coarse" (yaklaşık konum) ya da "fine" (hassas konum) olmalı.');
  }
  if (props.androidSmallIcon !== undefined &&!/\.png$/i.test(props.androidSmallIcon as string)) {
    fail('"androidSmallIcon" bir PNG dosyası olmalı (beyaz şekil + saydam arka plan).');
  }

  const nse = props.iosNotificationServiceExtension !== false;
  if (nse && props.appId === undefined) {
    fail('"appId" Notification Service Extension için gerekli. Ekleyin ya da "iosNotificationServiceExtension": false verin.');
  }

  return {
    ...(props as unknown as HeroSignalPluginProps),
    iosNotificationServiceExtension: nse,
    iosDeploymentTarget: (props.iosDeploymentTarget as string | undefined) ?? '15.0',
  };
}
