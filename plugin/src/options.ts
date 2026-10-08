/** Expo config plugin seçenekleri (`app.json` → `plugins: [["@herosignal/react-native", { … }]]`). */
export interface HeroSignalPluginProps {
  /** APNs ortamı (`aps-environment`): geliştirme derlemeleri `development`, TestFlight/App Store `production`. */
  mode?: 'development' | 'production';
  /** Apple Developer Team ID; uygulama ve Notification Service Extension hedeflerine yazılır. */
  devTeam?: string;
  /** Notification Service Extension hedefinin iOS sürümü (varsayılan `15.1`, en az `15.0`). */
  iPhoneDeploymentTarget?: string;
  /** Android küçük bildirim ikonları (beyaz/şeffaf PNG). İlki varsayılan ikon olur; ad dosya adından türetilir. */
  smallIcons?: string[];
  /** Android büyük bildirim ikonları (256×256'ya ölçeklenir); payload `large_icon` ile ada göre seçilir. */
  largeIcons?: string[];
  /** Android küçük ikon vurgu rengi (`#RRGGBB` veya `#AARRGGBB`). */
  smallIconAccentColor?: string;
  /** NSE ile paylaşılan App Group (varsayılan `group.<bundle id>.herosignal`). */
  appGroup?: string;
  /** NSE'nin `received` (confirmed delivery) bildirebilmesi için App ID; verilmezse uygulamanın çalışma zamanı değeri kullanılır. */
  appId?: string;
  /** NSE için API adresi (varsayılan `https://api.herosignal.dev`). */
  apiUrl?: string;
  /** Notification Service Extension hedefi eklenmesin (zengin medya ve confirmed delivery devre dışı kalır). */
  disableNotificationServiceExtension?: boolean;
  /** `google-services.json` yolu; `android.googleServicesFile` tanımlı değilse kullanılır. */
  googleServicesFile?: string;
  /**
   * Yerel geliştirme: `sdk/ios` dizininin proje köküne göre yolu. Verilirse Podfile'a
   * `pod 'HeroSignal', :path => …` eklenir (yayınlanmış pod yerine kaynaktan derlenir).
   */
  iosSdkPath?: string;
}

/** Doğrulanmış ve varsayılanları uygulanmış seçenekler. */
export interface ResolvedHeroSignalPluginProps {
  mode: 'development' | 'production';
  devTeam: string | null;
  iPhoneDeploymentTarget: string;
  smallIcons: string[];
  largeIcons: string[];
  smallIconAccentColor: string | null;
  appGroup: string | null;
  appId: string | null;
  apiUrl: string | null;
  disableNotificationServiceExtension: boolean;
  googleServicesFile: string | null;
  iosSdkPath: string | null;
}

export const NSE_TARGET_NAME = 'HeroSignalNotificationServiceExtension';
export const DEFAULT_DEPLOYMENT_TARGET = '15.1';
const MIN_DEPLOYMENT_TARGET = [15, 0];

export class HeroSignalPluginError extends Error {
  constructor(message: string) {
    super(`[@herosignal/react-native] ${message}`);
    this.name = 'HeroSignalPluginError';
  }
}

function optionalString(value: unknown, name: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim() === '') throw new HeroSignalPluginError(`${name} boş olmayan bir metin olmalı.`);
  return value.trim();
}

function stringList(value: unknown, name: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.trim() === '')) {
    throw new HeroSignalPluginError(`${name} dosya yolu dizisi olmalı.`);
  }
  return value.map((v: string) => v.trim());
}

/** `15.1` gibi sürümü sayılara ayırır; geçersizse null. */
function parseVersion(value: string): number[] | null {
  if (!/^\d+(\.\d+){0,2}$/.test(value)) return null;
  return value.split('.').map(Number);
}

function isAtLeast(version: number[], min: number[]): boolean {
  for (let i = 0; i < Math.max(version.length, min.length); i++) {
    const a = version[i] ?? 0;
    const b = min[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

/** Android renk değeri: `#RRGGBB` / `#AARRGGBB` (büyük harfe çevrilir). */
export function normalizeColor(value: string): string {
  const hex = value.trim();
  if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) {
    throw new HeroSignalPluginError('smallIconAccentColor #RRGGBB veya #AARRGGBB biçiminde olmalı.');
  }
  return hex.toUpperCase();
}

/** App Group adı `group.` ile başlamalı (Apple kuralı). */
function validateAppGroup(value: string | null): string | null {
  if (value === null) return null;
  if (!/^group\.[A-Za-z0-9.-]+$/.test(value)) {
    throw new HeroSignalPluginError('appGroup "group." ile başlamalı ve yalnızca harf, rakam, nokta, tire içermeli.');
  }
  return value;
}

export function resolveProps(props: HeroSignalPluginProps | undefined | null): ResolvedHeroSignalPluginProps {
  const p = (props ?? {}) as Record<string, unknown>;
  const mode = p.mode ?? 'development';
  if (mode !== 'development' && mode !== 'production') {
    throw new HeroSignalPluginError('mode "development" veya "production" olmalı.');
  }
  const target = optionalString(p.iPhoneDeploymentTarget, 'iPhoneDeploymentTarget') ?? DEFAULT_DEPLOYMENT_TARGET;
  const parsed = parseVersion(target);
  if (!parsed || !isAtLeast(parsed, MIN_DEPLOYMENT_TARGET)) {
    throw new HeroSignalPluginError('iPhoneDeploymentTarget en az 15.0 olan bir sürüm olmalı (ör. "15.1").');
  }
  const accent = optionalString(p.smallIconAccentColor, 'smallIconAccentColor');
  const apiUrl = optionalString(p.apiUrl, 'apiUrl');
  if (apiUrl !== null && !/^https?:\/\//.test(apiUrl)) {
    throw new HeroSignalPluginError('apiUrl http:// veya https:// ile başlamalı.');
  }
  return {
    mode,
    devTeam: optionalString(p.devTeam, 'devTeam'),
    iPhoneDeploymentTarget: target,
    smallIcons: stringList(p.smallIcons, 'smallIcons'),
    largeIcons: stringList(p.largeIcons, 'largeIcons'),
    smallIconAccentColor: accent === null ? null : normalizeColor(accent),
    appGroup: validateAppGroup(optionalString(p.appGroup, 'appGroup')),
    appId: optionalString(p.appId, 'appId'),
    apiUrl,
    disableNotificationServiceExtension: p.disableNotificationServiceExtension === true,
    googleServicesFile: optionalString(p.googleServicesFile, 'googleServicesFile'),
    iosSdkPath: optionalString(p.iosSdkPath, 'iosSdkPath'),
  };
}

/** Varsayılan App Group: iOS SDK kuralıyla aynı (`HSAppGroup.resolve`). */
export function resolveAppGroup(props: ResolvedHeroSignalPluginProps, bundleIdentifier: string): string {
  return props.appGroup ?? `group.${bundleIdentifier}.herosignal`;
}
