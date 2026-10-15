/**
 * Yerel köprü sözleşmesi: codegen spesifikasyonundaki (`NativeHeroSignal.ts`) her metodun Android yeni/eski mimari
 * modüllerinde ve iOS ObjC++ kabuğunda karşılığı olmalı. Yerel kod bu ortamda derlenemediğinden kaynak metni üzerinden
 * doğrulanır.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
// Windows'ta `core.autocrlf` dosyaları CRLF ile çıkarır; denetim satır sonundan bağımsızdır.
const read = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');

/** TurboModule `Spec` arayüzündeki metot adları. */
function specMethods(): string[] {
  const src = read('src/NativeHeroSignal.ts');
  const body = src.slice(src.indexOf('export interface Spec'));
  return [...new Set([...body.matchAll(/^\s{2}([a-zA-Z]+)\(/gm)].map((m) => m[1]))];
}

describe('yerel sözleşme', () => {
  const methods = specMethods();
  // iOS'ta `addListener`/`removeListeners` RCTEventEmitter tarafından sağlanır.
  const emitterMethods = new Set(['addListener', 'removeListeners']);

  test('Android yeni ve eski mimari modülleri her metodu uygular', () => {
    expect(methods.length).toBeGreaterThan(40);
    const newArch = read('android/src/newarch/java/com/herosignal/reactnative/HeroSignalModule.kt');
    const oldArch = read('android/src/oldarch/java/com/herosignal/reactnative/HeroSignalModule.kt');
    const overrides = new Set([...newArch.matchAll(/override fun ([A-Za-z]+)\(/g)].map((m) => m[1]));
    const reactMethods = new Set([...oldArch.matchAll(/@ReactMethod(?:\([^)]*\))?\s+fun ([A-Za-z]+)\(/g)].map((m) => m[1]));
    for (const m of methods) {
      expect([m, overrides.has(m)]).toEqual([m, true]);
      expect([m, reactMethods.has(m)]).toEqual([m, true]);
    }
  });

  test('iOS ObjC++ kabuğu her metodu dışa açar', () => {
    const mm = read('ios/HeroSignalRN.mm');
    const exported = new Set([...mm.matchAll(/RCT_EXPORT_METHOD\(([A-Za-z]+)/g)].map((m) => m[1]));
    for (const m of methods.filter((x) => !emitterMethods.has(x))) expect([m, exported.has(m)]).toEqual([m, true]);
  });

  test('bildirim kaldırma ve e-posta/SMS listeleri gerçek yerel SDK çağrılarına bağlı', () => {
    expect(methods).toEqual(expect.arrayContaining(['removeNotification', 'removeGroupedNotifications', 'getEmails', 'getSmsNumbers']));
    const impl = read('android/src/main/java/com/herosignal/reactnative/HeroSignalModuleImpl.kt');
    expect(impl).toContain('HeroSignal.Notifications.removeNotification(androidNotificationId)');
    expect(impl).toContain('HeroSignal.Notifications.removeGroupedNotifications(group)');
    expect(impl).toContain('Arguments.makeNativeArray(HeroSignal.User.emails)');
    expect(impl).toContain('Arguments.makeNativeArray(HeroSignal.User.smsNumbers)');
    expect(read('android/src/main/java/com/herosignal/reactnative/HeroSignalMappers.kt')).toContain(
      '"androidNotificationId" to androidNotificationId',
    );

    const mm = read('ios/HeroSignalRN.mm');
    expect(mm).toContain('[[HeroSignalRNBridge shared] removeNotification:identifier resolve:resolve reject:reject]');
    expect(mm).toContain('[[HeroSignalRNBridge shared] removeGroupedNotifications:group resolve:resolve reject:reject]');
    expect(mm).toContain('resolve([[HeroSignalRNBridge shared] emails]);');
    expect(mm).toContain('resolve([[HeroSignalRNBridge shared] smsNumbers]);');
    const swift = read('ios/HeroSignalRNBridge.swift');
    expect(swift).toContain('@objc public func removeNotification(_ identifier: String, resolve:');
    expect(swift).toContain('HeroSignal.Notifications.removeNotification(identifier: trimmed)');
    expect(swift).toContain('@objc public func removeGroupedNotifications(_ group: String, resolve:');
    expect(swift).toContain('HeroSignal.Notifications.removeGroupedNotifications(group)');
    expect(swift).toContain('@objc public func emails() -> [String] { HeroSignal.User.emails }');
    expect(swift).toContain('@objc public func smsNumbers() -> [String] { HeroSignal.User.smsNumbers }');
  });

  test('JWT identity verification yerel SDK çağrılarına iletilir', () => {
    expect(methods).toEqual(expect.arrayContaining(['login', 'updateUserJwt']));
    const impl = read('android/src/main/java/com/herosignal/reactnative/HeroSignalModuleImpl.kt');
    expect(impl).toContain('HeroSignal.login(externalId, identityHash, jwt)');
    expect(impl).toContain('HeroSignal.updateUserJwt(jwt)');

    const mm = read('ios/HeroSignalRN.mm');
    expect(mm).toContain('[[HeroSignalRNBridge shared] login:externalId identityHash:identityHash jwt:jwt resolve:resolve reject:reject]');
    expect(mm).toContain('[[HeroSignalRNBridge shared] updateUserJwt:jwt resolve:resolve reject:reject]');
    const swift = read('ios/HeroSignalRNBridge.swift');
    expect(swift).toContain('HeroSignal.login(externalId, identityHash: identityHash, jwt: jwt)');
    expect(swift).toContain('try HeroSignal.updateUserJwt(jwt)');
  });

  test('Live Activities: iOS yerel SDK çağrılarına bağlı, Android PLATFORM_NOT_SUPPORTED ile reddeder', () => {
    expect(methods).toEqual(expect.arrayContaining(['setupDefaultLiveActivity', 'startDefaultLiveActivity']));

    const mm = read('ios/HeroSignalRN.mm');
    expect(mm).toContain('[[HeroSignalRNBridge shared] setupDefaultLiveActivity:resolve reject:reject]');
    expect(mm).toContain(
      '[[HeroSignalRNBridge shared] startDefaultLiveActivity:activityId attributes:attributes contentState:contentState resolve:resolve reject:reject]',
    );
    const swift = read('ios/HeroSignalRNBridge.swift');
    expect(swift).toContain('try HeroSignal.LiveActivities.setupDefaultLiveActivity()');
    expect(swift).toContain('try HeroSignal.LiveActivities.startDefaultLiveActivity(activityId: activityId, attributes: attributes, contentState: contentState)');
    // SDK hata kodu (PLATFORM_NOT_SUPPORTED / NOT_READY / INVALID_ARGUMENT / LIVE_ACTIVITY_FAILED) aynen iletilir.
    expect(swift).toContain('catch let error as HSLiveActivityError');
    expect(swift).toContain('reject(error.code, error.message, error)');
    expect(swift).toContain('reject("LIVE_ACTIVITY_FAILED", error.localizedDescription, error)');

    const impl = read('android/src/main/java/com/herosignal/reactnative/HeroSignalModuleImpl.kt');
    expect(impl).toContain('fun setupDefaultLiveActivity(promise: Promise) = rejectLiveActivities(promise)');
    expect(impl).toMatch(/fun startDefaultLiveActivity\([^)]*\) =\s+rejectLiveActivities\(promise\)/);
    expect(impl).toContain('promise.reject(PLATFORM_NOT_SUPPORTED, LIVE_ACTIVITIES_IOS_ONLY)');
    expect(impl).toContain('const val PLATFORM_NOT_SUPPORTED = "PLATFORM_NOT_SUPPORTED"');
    expect(impl).toContain('const val LIVE_ACTIVITIES_IOS_ONLY = "Live Activities yalnızca iOS\'ta desteklenir"');
  });
});
