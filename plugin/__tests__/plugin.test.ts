/**
 * Expo config plugin testleri: seçenek doğrulaması, saf dönüşümler ve gerçek bir proje kopyası üzerinde tüm mod zinciri
 * (`compileModsAsync`). Fikstürler examples/react-native projesinin ios/android dosyalarının kopyasıdır; Gradle
 * dosyalarından google-services satırları çıkarılmıştır (temiz Expo prebuild şablonu gibi).
 */
import { AndroidConfig, compileModsAsync, type ExportedConfig, WarningAggregator, XML } from '@expo/config-plugins';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as xcode from 'xcode';
import type { XCBuildConfiguration } from 'xcode';
import * as zlib from 'zlib';
import withPushizo from '../src';
import { applyAndroidManifest, applySettingsGradle, copyGoogleServicesFile, ICON_RESOURCE, ICON_SIZES, META } from '../src/android';
import { addNseTarget, applyAppDelegate, applyEntitlements, applyInfoPlist, applyPodfile, buildNseInfoPlist, LOCATION_USAGE_KEY, NSE_TARGET, PLIST } from '../src/ios';
import { validateProps } from '../src/props';


const FIXTURES = path.join(__dirname, 'fixtures');
const BASE = { mode: 'development' as const, appId: 'app_test_123' };

/** Kırmızı kare PNG (fikstür ikon). */
function writePng(file: string, size = 64): void {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 6; // RGBA
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 4, Buffer.from([255, 0, 0, 255]))]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

function tempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-expo-'));
  fs.cpSync(FIXTURES, dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets'));
  writePng(path.join(dir, 'assets', 'notification-icon.png'));
  fs.writeFileSync(path.join(dir, 'google-services.json'), GOOGLE_SERVICES);
  return dir;
}

/** Yapısı Firebase konsolu çıktısına benzeyen test fikstürü (gizli bilgi içermez). */
const GOOGLE_SERVICES = JSON.stringify({ project_info: { project_number: '1', project_id: 'pushizo-example' }, client: [] });

function baseConfig(): ExportedConfig {
  return {
    name: 'PushizoExample',
    slug: 'pushizo-example',
    version: '2.3.0',
    ios: { bundleIdentifier: 'dev.pushizo.example', buildNumber: '17' },
    android: { package: 'dev.pushizo.example', googleServicesFile: './google-services.json' },
  };
}

const EXPO_APP_DELEGATE = `import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

const OBJC_APP_DELEGATE = `#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

// Linking API
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  return [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  return [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
}

@end
`;

describe('validateProps', () => {
  test('geçerli seçenekler varsayılanlarla tamamlanır', () => {
    expect(validateProps(BASE)).toMatchObject({ mode: 'development', appId: 'app_test_123', iosNotificationServiceExtension: true, iosDeploymentTarget: '15.0' });
    expect(validateProps({ mode: 'production', iosNotificationServiceExtension: false })).toMatchObject({ iosNotificationServiceExtension: false });
  });

  test.each([
    [undefined, 'seçenekler gerekli'],
    [{}, '"mode" zorunlu'],
    [{ mode: 'staging', appId: 'a' }, '"mode" zorunlu'],
    [{ mode: 'development' }, '"appId" Notification Service Extension için gerekli'],
    [{ ...BASE, foo: 1 }, 'bilinmeyen seçenek "foo"'],
    [{ ...BASE, apiUrl: 'ftp://x' }, '"apiUrl"'],
    [{ ...BASE, iosAppGroup: 'com.example' }, '"iosAppGroup"'],
    [{ ...BASE, devTeam: 'abc' }, '"devTeam"'],
    [{ ...BASE, androidAccentColor: 'red' }, '"androidAccentColor"'],
    [{ ...BASE, androidSmallIcon: './icon.svg' }, '"androidSmallIcon"'],
    [{ ...BASE, iosDeploymentTarget: '13.0' }, '"iosDeploymentTarget"'],
    [{ ...BASE, logLevel: 'trace' }, '"logLevel"'],
    [{ ...BASE, requiresPrivacyConsent: 'yes' }, '"requiresPrivacyConsent"'],
    [{ ...BASE, androidDefaultChannelId: 'kanal adı' }, '"androidDefaultChannelId"'],
    [{ ...BASE, androidDefaultChannelName: '' }, '"androidDefaultChannelName"'],
    [{ ...BASE, androidLocationPermission: 'background' }, '"androidLocationPermission"'],
    [{ ...BASE, iosLocationUsageDescription: ' ' }, '"iosLocationUsageDescription"'],
  ])('geçersiz seçenek açık hata verir: %j', (input, message) => {
    expect(() => validateProps(input)).toThrow(message);
  });

  test('google-services.json yoksa Android uyarısı verilir, varsa verilmez', () => {
    const spy = jest.spyOn(WarningAggregator, 'addWarningAndroid').mockImplementation(() => undefined);
    withPushizo({ ...baseConfig(), android: { package: 'dev.pushizo.example' } }, BASE);
    expect(spy).toHaveBeenCalledWith('@pushizo/react-native', expect.stringContaining('google-services.json'));
    spy.mockClear();
    withPushizo(baseConfig(), BASE);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('plugin seçenekleri doğrulanmadan mod eklemez', () => {
    expect(() => withPushizo(baseConfig(), { mode: 'debug' } as never)).toThrow('@pushizo/react-native config plugin');
  });
});

describe('iOS dönüşümleri', () => {
  const props = validateProps({ ...BASE, apiUrl: 'https://api.example.com' });

  test('entitlements: aps-environment ve App Group (tekrar uygulamada çoğalmaz)', () => {
    const e = applyEntitlements(applyEntitlements({ 'com.apple.security.application-groups': ['group.other'] }, props, 'group.x'), props, 'group.x');
    expect(e).toEqual({ 'aps-environment': 'development', 'com.apple.security.application-groups': ['group.other', 'group.x'] });
    expect(applyEntitlements<Record<string, unknown>>({}, validateProps({ ...BASE, mode: 'production' }), 'group.x')['aps-environment']).toBe('production');
  });

  test('Info.plist: remote-notification ve Pushizo anahtarları', () => {
    const p = applyInfoPlist(applyInfoPlist({ UIBackgroundModes: ['audio'] }, props, 'group.x'), props, 'group.x');
    expect(p).toEqual({
      UIBackgroundModes: ['audio', 'remote-notification'],
      PushizoAppGroup: 'group.x',
      PushizoAppId: 'app_test_123',
      PushizoApiUrl: 'https://api.example.com',
      PushizoRequiresPrivacyConsent: false,
    });
  });

  test('Info.plist: onay bayrağı ve günlük seviyesi erken başlatma için yazılır, appId yoksa kaldırılır', () => {
    const consent = validateProps({ ...BASE, requiresPrivacyConsent: true, logLevel: 'warn' });
    const p = applyInfoPlist<Record<string, unknown>>({}, consent, 'group.x');
    expect(p[PLIST.requiresConsent]).toBe(true);
    expect(p[PLIST.logLevel]).toBe('warn');
    const cleared = applyInfoPlist(p, validateProps({ mode: 'development', iosNotificationServiceExtension: false }), 'group.x');
    expect(cleared).not.toHaveProperty(PLIST.requiresConsent);
    expect(cleared).not.toHaveProperty(PLIST.logLevel);
    expect(cleared).not.toHaveProperty(PLIST.appId);
  });

  test('Info.plist: konum açıklaması yalnızca verilirse yazılır, verilmezse uygulamanın değeri korunur', () => {
    const withLocation = validateProps({ ...BASE, iosLocationUsageDescription: 'Yakındaki mağazalar için konumunuzu kullanırız.' });
    const p = applyInfoPlist<Record<string, unknown>>({}, withLocation, 'group.x');
    expect(p[LOCATION_USAGE_KEY]).toBe('Yakındaki mağazalar için konumunuzu kullanırız.');
    const kept = applyInfoPlist<Record<string, unknown>>({ [LOCATION_USAGE_KEY]: 'Uygulamanın metni' }, props, 'group.x');
    expect(kept[LOCATION_USAGE_KEY]).toBe('Uygulamanın metni');
    expect(applyInfoPlist<Record<string, unknown>>({}, props, 'group.x')).not.toHaveProperty(LOCATION_USAGE_KEY);
  });

  test('yerel köprüler plugin anahtarlarını okur (Info.plist ve manifest sözleşmesi)', () => {
    const root = path.join(__dirname, '..', '..');
    const swift = fs.readFileSync(path.join(root, 'ios', 'PushizoRNBridge.swift'), 'utf8');
    for (const key of [PLIST.appId, PLIST.apiUrl, PLIST.requiresConsent, PLIST.logLevel]) expect(swift).toContain(`"${key}"`);
    expect(swift).toMatch(/autoInitialize[\s\S]*plistRequiresConsent[\s\S]*plistLogLevel[\s\S]*self\.start\(/);
    const kotlin = fs.readFileSync(
      path.join(root, 'android', 'src', 'main', 'java', 'com', 'pushizo', 'reactnative', 'PushizoInitProvider.kt'),
      'utf8',
    );
    for (const key of [META.appId, META.apiUrl, META.requiresConsent, META.logLevel, META.channelId, META.channelName]) {
      expect(kotlin).toContain(`"${key}"`);
    }
  });

  test('AppDelegate (Expo Swift): import ve super çağıran override eklenir, idempotent', () => {
    const once = applyAppDelegate(EXPO_APP_DELEGATE, 'swift');
    expect(once).toContain('import Pushizo');
    expect(once).toContain('public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken');
    expect(once).toContain('super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)');
    expect(applyAppDelegate(once, 'swift')).toBe(once);
  });

  test('AppDelegate (RN şablonu Swift, UIApplicationDelegate): override olmadan eklenir', () => {
    const src = fs.readFileSync(path.join(FIXTURES, 'ios', 'PushizoExample', 'AppDelegate.swift'), 'utf8');
    const out = applyAppDelegate(src, 'swift');
    expect(out).toContain('  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\n    Pushizo.setDeviceToken(deviceToken)');
    expect(out).not.toContain('override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken');
  });

  test('AppDelegate (Swift): mevcut token metodu varsa elle ekleme talimatı verilir', () => {
    const src = `${EXPO_APP_DELEGATE.replace('}\n}\n', '}\n  public override func application(_ a: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken d: Data) {}\n}\n')}`;
    expect(() => applyAppDelegate(src, 'swift')).toThrow('Pushizo.setDeviceToken(deviceToken)');
  });

  test('AppDelegate (Objective-C++): mevcut metotlara çağrı eklenir', () => {
    const out = applyAppDelegate(OBJC_APP_DELEGATE, 'objcpp');
    expect(out).toContain('#import <PushizoReactNative/PushizoRNPush.h>');
    expect(out).toContain(
      'didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken\n{\n// @generated begin pushizo-apns-token - expo prebuild (DO NOT MODIFY)\n  [PushizoRNPush didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];\n// @generated end pushizo-apns-token\n  return [super',
    );
    expect(out).toContain('[PushizoRNPush didFailToRegisterForRemoteNotificationsWithError:error];');
    expect(applyAppDelegate(out, 'objcpp')).toBe(out);
  });

  test('AppDelegate (Objective-C): metot yoksa @end öncesine eklenir', () => {
    const src = OBJC_APP_DELEGATE.replace(/\/\/ Linking API[\s\S]*?(?=@end)/, '');
    const out = applyAppDelegate(src, 'objc');
    expect(out).toContain('  [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];\n}');
    expect(out).toContain('  [super application:application didFailToRegisterForRemoteNotificationsWithError:error];\n}');
    expect(out.trim().endsWith('@end')).toBe(true);
    expect(applyAppDelegate(out, 'objc')).toBe(out);
  });

  test('Podfile: NSE hedefi ve monorepo yolu; tekrar uygulamada tek blok', () => {
    // Windows'ta `core.autocrlf` fikstürü CRLF ile çıkarır; beklenen desenler LF'dir.
    const podfile = fs.readFileSync(path.join(FIXTURES, 'ios', 'Podfile'), 'utf8').replace(/\r\n/g, '\n');
    const p = validateProps({ ...BASE, iosSdkPath: '../../../sdk/ios' });
    const out = applyPodfile(applyPodfile(podfile, p), p);
    expect(out.match(/target 'PushizoNotificationServiceExtension' do/g)).toHaveLength(1);
    expect(out).toContain("pod 'Pushizo/Extension', :path => '../../../sdk/ios'");
    expect(out).toMatch(/config = use_native_modules!\n# @generated begin pushizo-sdk[^\n]*\n {2}pod 'Pushizo', :path => '..\/..\/..\/sdk\/ios'/);
    const published = applyPodfile(podfile, props);
    expect(published).toContain("pod 'Pushizo/Extension', '~> 0.1'");
    expect(applyPodfile(out, validateProps({ mode: 'development', iosNotificationServiceExtension: false }))).not.toContain(NSE_TARGET);
  });

  test('NSE Info.plist: şablona app kimliği, API ve App Group eklenir (XML kaçışlı)', () => {
    const template = fs.readFileSync(path.join(__dirname, '..', 'templates', NSE_TARGET, 'Info.plist'), 'utf8');
    const out = buildNseInfoPlist(template, validateProps({ ...BASE, apiUrl: 'https://a.example.com/?x=1&y=2' }), 'group.x');
    expect(out).toContain('<key>PushizoAppId</key>\n\t<string>app_test_123</string>');
    expect(out).toContain('<string>https://a.example.com/?x=1&amp;y=2</string>');
    expect(out).toContain('<key>NSExtensionPointIdentifier</key>');
    expect(out.trim().endsWith('</plist>')).toBe(true);
  });

  test('Xcode: NSE hedefi, derleme ayarları ve gömme aşaması eklenir (idempotent)', () => {
    const project = xcode.project(path.join(FIXTURES, 'ios', 'PushizoExample.xcodeproj', 'project.pbxproj'));
    project.parseSync();
    const options = { bundleId: 'dev.pushizo.example', deploymentTarget: '15.0', devTeam: 'ABCDE12345', version: '2.3.0', buildNumber: '17' };
    addNseTarget(project, options);
    addNseTarget(project, options);
    const targets = Object.values(project.pbxNativeTargetSection()).filter((t) => typeof t === 'object' && t.name === `"${NSE_TARGET}"`);
    expect(targets).toHaveLength(1);
    const configs = Object.values(project.pbxXCBuildConfigurationSection()).filter(
      (c): c is XCBuildConfiguration => typeof c === 'object' && c.buildSettings.PRODUCT_NAME === `"${NSE_TARGET}"`,
    );
    expect(configs).toHaveLength(2);
    for (const c of configs) {
      expect(c.buildSettings).toMatchObject({
        INFOPLIST_FILE: `${NSE_TARGET}/Info.plist`,
        CODE_SIGN_ENTITLEMENTS: `${NSE_TARGET}/${NSE_TARGET}.entitlements`,
        IPHONEOS_DEPLOYMENT_TARGET: '15.0',
        DEVELOPMENT_TEAM: 'ABCDE12345',
        MARKETING_VERSION: '2.3.0',
        CURRENT_PROJECT_VERSION: '17',
        PRODUCT_BUNDLE_IDENTIFIER: `"dev.pushizo.example.${NSE_TARGET}"`,
      });
    }
    const output = project.writeSync();
    expect(output).toContain('NotificationService.swift in Sources');
    expect(output).toContain(`${NSE_TARGET}.appex in Copy Files`);
  });
});

describe('Android dönüşümleri', () => {
  async function manifest() {
    return (await XML.readXMLAsync({ path: path.join(FIXTURES, 'android', 'app', 'src', 'main', 'AndroidManifest.xml') })) as unknown as AndroidConfig.Manifest.AndroidManifest;
  }

  test('POST_NOTIFICATIONS, ikon/renk ve erken başlatma meta-data', async () => {
    const m = applyAndroidManifest(
      await manifest(),
      validateProps({
        ...BASE,
        apiUrl: 'https://api.example.com',
        logLevel: 'debug',
        requiresPrivacyConsent: true,
        androidSmallIcon: './icon.png',
        androidAccentColor: '#FF5A1F',
        androidDefaultChannelId: 'campaigns',
        androidDefaultChannelName: 'Kampanyalar',
      }),
    );
    expect(AndroidConfig.Permissions.getPermissions(m)).toContain('android.permission.POST_NOTIFICATIONS');
    const meta = Object.fromEntries(
      (AndroidConfig.Manifest.getMainApplicationOrThrow(m)['meta-data'] ?? []).map((i) => [i.$['android:name'], i.$['android:value'] ?? i.$['android:resource']]),
    );
    expect(meta).toEqual({
      [META.icon]: `@drawable/${ICON_RESOURCE}`,
      [META.color]: '@color/pushizo_notification_color',
      [META.appId]: 'app_test_123',
      [META.apiUrl]: 'https://api.example.com',
      [META.requiresConsent]: 'true',
      [META.logLevel]: 'debug',
      [META.channelId]: 'campaigns',
      [META.channelName]: 'Kampanyalar',
    });
  });

  test('konum izni yalnızca androidLocationPermission ile eklenir; arka plan konumu hiçbir zaman eklenmez', async () => {
    const location = (perms: string[]) => perms.filter((p) => p.includes('LOCATION')).sort();
    const none = applyAndroidManifest(await manifest(), validateProps(BASE));
    expect(location(AndroidConfig.Permissions.getPermissions(none))).toEqual([]);
    const coarse = applyAndroidManifest(await manifest(), validateProps({ ...BASE, androidLocationPermission: 'coarse' }));
    expect(location(AndroidConfig.Permissions.getPermissions(coarse))).toEqual(['android.permission.ACCESS_COARSE_LOCATION']);
    const fine = applyAndroidManifest(
      applyAndroidManifest(await manifest(), validateProps({ ...BASE, androidLocationPermission: 'fine' })),
      validateProps({ ...BASE, androidLocationPermission: 'fine' }),
    );
    expect(location(AndroidConfig.Permissions.getPermissions(fine))).toEqual([
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ]);
  });

  test('google-services.json android/app altına kopyalanır; dosya yoksa alanı söyleyen hata', async () => {
    const projectRoot = tempProject();
    try {
      const target = await copyGoogleServicesFile({ android: { googleServicesFile: './google-services.json' } }, projectRoot);
      expect(fs.readFileSync(target, 'utf8')).toBe(GOOGLE_SERVICES);
      await expect(copyGoogleServicesFile({ android: { googleServicesFile: './yok.json' } }, projectRoot)).rejects.toThrow(
        '"android.googleServicesFile" dosyası bulunamadı',
      );
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('appId/ikon verilmezse eski meta-data kaldırılır', async () => {
    const first = applyAndroidManifest(await manifest(), validateProps({ ...BASE, androidSmallIcon: './i.png' }));
    const second = applyAndroidManifest(first, validateProps({ mode: 'development', iosNotificationServiceExtension: false }));
    expect(AndroidConfig.Manifest.getMainApplicationOrThrow(second)['meta-data'] ?? []).toHaveLength(0);
  });

  test('settings.gradle: monorepo :pushizo modülü (idempotent)', () => {
    const src = fs.readFileSync(path.join(FIXTURES, 'android', 'settings.gradle'), 'utf8');
    const once = applySettingsGradle(src, '../../../sdk/android/pushizo');
    expect(once).toContain("include ':pushizo'");
    expect(once).toContain("project(':pushizo').projectDir = new File(rootProject.projectDir, '../../../sdk/android/pushizo')");
    expect(applySettingsGradle(once, '../../../sdk/android/pushizo')).toBe(once);
  });
});

describe('tüm mod zinciri (compileModsAsync)', () => {
  test('örnek projeye iOS ve Android değişiklikleri uygulanır', async () => {
    const projectRoot = tempProject();
    try {
      const config = withPushizo(baseConfig(), {
        ...BASE,
        mode: 'production',
        apiUrl: 'https://api.example.com',
        androidSmallIcon: './assets/notification-icon.png',
        androidAccentColor: '#FF5A1F',
      });
      await compileModsAsync(config, { projectRoot, platforms: ['ios', 'android'], introspect: false, assertMissingModProviders: false });

      const ios = path.join(projectRoot, 'ios');
      const entitlements = fs.readFileSync(path.join(ios, 'PushizoExample', 'PushizoExample.entitlements'), 'utf8');
      expect(entitlements).toContain('<key>aps-environment</key>\n    <string>production</string>');
      expect(entitlements).toContain('<string>group.dev.pushizo.example.pushizo</string>');
      const info = fs.readFileSync(path.join(ios, 'PushizoExample', 'Info.plist'), 'utf8');
      expect(info).toContain('<string>remote-notification</string>');
      expect(info).toContain('<key>PushizoAppId</key>');
      expect(fs.readFileSync(path.join(ios, 'PushizoExample', 'AppDelegate.swift'), 'utf8')).toContain('Pushizo.setDeviceToken(deviceToken)');
      expect(fs.readFileSync(path.join(ios, 'Podfile'), 'utf8')).toContain(`target '${NSE_TARGET}' do`);
      for (const file of ['NotificationService.swift', 'Info.plist', `${NSE_TARGET}.entitlements`]) {
        expect(fs.existsSync(path.join(ios, NSE_TARGET, file))).toBe(true);
      }
      expect(fs.readFileSync(path.join(ios, 'PushizoExample.xcodeproj', 'project.pbxproj'), 'utf8')).toContain(`${NSE_TARGET}.appex`);

      const res = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
      for (const [density, size] of Object.entries(ICON_SIZES)) {
        const png = fs.readFileSync(path.join(res, `drawable-${density}`, `${ICON_RESOURCE}.png`));
        expect(png.readUInt32BE(16)).toBe(size);
      }
      expect(fs.readFileSync(path.join(res, 'values', 'colors.xml'), 'utf8')).toContain('<color name="pushizo_notification_color">#FF5A1F</color>');
      const manifest = fs.readFileSync(path.join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
      expect(manifest).toContain('android.permission.POST_NOTIFICATIONS');
      expect(manifest).toContain(`android:name="${META.appId}" android:value="app_test_123"`);

      // FCM: google-services.json kopyalanır, sınıf yolu ve Gradle eklentisi eklenir.
      const android = path.join(projectRoot, 'android');
      expect(fs.readFileSync(path.join(android, 'app', 'google-services.json'), 'utf8')).toBe(GOOGLE_SERVICES);
      expect(fs.readFileSync(path.join(android, 'build.gradle'), 'utf8')).toMatch(/classpath 'com\.google\.gms:google-services:[\d.]+'/);
      const applyPattern = /apply plugin: ['"]com\.google\.gms\.google-services['"]/g;
      expect(fs.readFileSync(path.join(android, 'app', 'build.gradle'), 'utf8').match(applyPattern)).toHaveLength(1);

      // İkinci prebuild (ve Expo'nun varsayılan eklentileri) aynı satırları çoğaltmaz.
      const again = withPushizo(baseConfig(), { ...BASE, mode: 'production' });
      await compileModsAsync(again, { projectRoot, platforms: ['android'], introspect: false, assertMissingModProviders: false });
      expect(fs.readFileSync(path.join(android, 'app', 'build.gradle'), 'utf8').match(applyPattern)).toHaveLength(1);
      expect(fs.readFileSync(path.join(android, 'build.gradle'), 'utf8').match(/com\.google\.gms:google-services/g)).toHaveLength(1);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  }, 60000);
});
