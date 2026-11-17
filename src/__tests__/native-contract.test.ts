/**
 * Yerel köprü sözleşmesi: codegen spesifikasyonundaki (`NativePushizo.ts`) her metodun Android yeni/eski mimari
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
  const src = read('src/NativePushizo.ts');
  const body = src.slice(src.indexOf('export interface Spec'));
  return [...new Set([...body.matchAll(/^\s{2}([a-zA-Z]+)\(/gm)].map((m) => m[1]))];
}

describe('yerel sözleşme', () => {
  const methods = specMethods();
  // iOS'ta `addListener`/`removeListeners` RCTEventEmitter tarafından sağlanır.
  const emitterMethods = new Set(['addListener', 'removeListeners']);

  test('Android yeni ve eski mimari modülleri her metodu uygular', () => {
    expect(methods.length).toBeGreaterThan(40);
    const newArch = read('android/src/newarch/java/com/pushizo/reactnative/PushizoModule.kt');
    const oldArch = read('android/src/oldarch/java/com/pushizo/reactnative/PushizoModule.kt');
    const overrides = new Set([...newArch.matchAll(/override fun ([A-Za-z]+)\(/g)].map((m) => m[1]));
    const reactMethods = new Set([...oldArch.matchAll(/@ReactMethod(?:\([^)]*\))?\s+fun ([A-Za-z]+)\(/g)].map((m) => m[1]));
    for (const m of methods) {
      expect([m, overrides.has(m)]).toEqual([m, true]);
      expect([m, reactMethods.has(m)]).toEqual([m, true]);
    }
  });

  test('iOS ObjC++ kabuğu her metodu dışa açar', () => {
    const mm = read('ios/PushizoRN.mm');
    const exported = new Set([...mm.matchAll(/RCT_EXPORT_METHOD\(([A-Za-z]+)/g)].map((m) => m[1]));
    for (const m of methods.filter((x) => !emitterMethods.has(x))) expect([m, exported.has(m)]).toEqual([m, true]);
  });

  test('bildirim kaldırma ve e-posta/SMS listeleri gerçek yerel SDK çağrılarına bağlı', () => {
    expect(methods).toEqual(expect.arrayContaining(['removeNotification', 'removeGroupedNotifications', 'getEmails', 'getSmsNumbers']));
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('Pushizo.Notifications.removeNotification(androidNotificationId)');
    expect(impl).toContain('Pushizo.Notifications.removeGroupedNotifications(group)');
    expect(impl).toContain('Arguments.makeNativeArray(Pushizo.User.emails)');
    expect(impl).toContain('Arguments.makeNativeArray(Pushizo.User.smsNumbers)');
    expect(read('android/src/main/java/com/pushizo/reactnative/PushizoMappers.kt')).toContain(
      '"androidNotificationId" to androidNotificationId',
    );

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] removeNotification:identifier resolve:resolve reject:reject]');
    expect(mm).toContain('[[PushizoRNBridge shared] removeGroupedNotifications:group resolve:resolve reject:reject]');
    expect(mm).toContain('resolve([[PushizoRNBridge shared] emails]);');
    expect(mm).toContain('resolve([[PushizoRNBridge shared] smsNumbers]);');
    const swift = read('ios/PushizoRNBridge.swift');
    expect(swift).toContain('@objc public func removeNotification(_ identifier: String, resolve:');
    expect(swift).toContain('Pushizo.Notifications.removeNotification(identifier: trimmed)');
    expect(swift).toContain('@objc public func removeGroupedNotifications(_ group: String, resolve:');
    expect(swift).toContain('Pushizo.Notifications.removeGroupedNotifications(group)');
    expect(swift).toContain('@objc public func emails() -> [String] { Pushizo.User.emails }');
    expect(swift).toContain('@objc public func smsNumbers() -> [String] { Pushizo.User.smsNumbers }');
  });

  test('JWT identity verification yerel SDK çağrılarına iletilir', () => {
    expect(methods).toEqual(expect.arrayContaining(['login', 'updateUserJwt']));
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('Pushizo.login(externalId, identityHash, jwt)');
    expect(impl).toContain('Pushizo.updateUserJwt(jwt)');

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] login:externalId identityHash:identityHash jwt:jwt resolve:resolve reject:reject]');
    expect(mm).toContain('[[PushizoRNBridge shared] updateUserJwt:jwt resolve:resolve reject:reject]');
    const swift = read('ios/PushizoRNBridge.swift');
    expect(swift).toContain('Pushizo.login(externalId, identityHash: identityHash, jwt: jwt)');
    expect(swift).toContain('try Pushizo.updateUserJwt(jwt)');
  });

  test('Live Activities: iOS yerel SDK çağrılarına bağlı, Android PLATFORM_NOT_SUPPORTED ile reddeder', () => {
    expect(methods).toEqual(expect.arrayContaining(['setupDefaultLiveActivity', 'startDefaultLiveActivity']));

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] setupDefaultLiveActivity:resolve reject:reject]');
    expect(mm).toContain(
      '[[PushizoRNBridge shared] startDefaultLiveActivity:activityId attributes:attributes contentState:contentState resolve:resolve reject:reject]',
    );
    const swift = read('ios/PushizoRNBridge.swift');
    expect(swift).toContain('try Pushizo.LiveActivities.setupDefaultLiveActivity()');
    expect(swift).toContain('try Pushizo.LiveActivities.startDefaultLiveActivity(activityId: activityId, attributes: attributes, contentState: contentState)');
    // SDK hata kodu (PLATFORM_NOT_SUPPORTED / NOT_READY / INVALID_ARGUMENT / LIVE_ACTIVITY_FAILED) aynen iletilir.
    expect(swift).toContain('catch let error as HSLiveActivityError');
    expect(swift).toContain('reject(error.code, error.message, error)');
    expect(swift).toContain('reject("LIVE_ACTIVITY_FAILED", error.localizedDescription, error)');

    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('fun setupDefaultLiveActivity(promise: Promise) = rejectLiveActivities(promise)');
    expect(impl).toMatch(/fun startDefaultLiveActivity\([^)]*\) =\s+rejectLiveActivities\(promise\)/);
    expect(impl).toContain('promise.reject(PLATFORM_NOT_SUPPORTED, LIVE_ACTIVITIES_IOS_ONLY)');
    expect(impl).toContain('const val PLATFORM_NOT_SUPPORTED = "PLATFORM_NOT_SUPPORTED"');
    expect(impl).toContain('const val LIVE_ACTIVITIES_IOS_ONLY = "Live Activities yalnızca iOS\'ta desteklenir"');
  });

  test('Konum: yerel SDK Location API\'sine bağlı; Android izin akışı PermissionAwareActivity ile yürür', () => {
    expect(methods).toEqual(expect.arrayContaining(['setLocationShared', 'isLocationShared', 'requestLocationPermission']));

    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('fun setLocationShared(shared: Boolean) = Pushizo.Location.setShared(shared)');
    expect(impl).toContain('fun isLocationShared(promise: Promise) = promise.resolve(Pushizo.Location.isShared)');
    // 1) İzin zaten varsa SDK'ya bildirilir ve true döner.
    expect(impl).toMatch(/if \(Pushizo\.Location\.permissionGranted\) \{\s+Pushizo\.Location\.onPermissionResult\(\)\s+promise\.resolve\(true\)/);
    // 2) Yalnızca manifest'te tanımlı ön plan izinleri istenir (arka plan izni ayrı çağrıdır).
    expect(impl).toContain('context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)');
    expect(impl).toContain('Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION');
    expect(impl).toMatch(/if \(permissions\.isEmpty\(\)\) \{\s+HsLog\.w\([^)]*\)\s+promise\.resolve\(false\)/);
    // 3) Activity yoksa köprünün NO_ACTIVITY deseni.
    expect(impl).toMatch(/if \(activity !is PermissionAwareActivity\) \{\s+promise\.reject\("NO_ACTIVITY"/);
    // 4) Açıklama diyaloğu SDK string kaynaklarıyla; "Devam" dışındaki kapanış false.
    expect(impl).toContain('import com.pushizo.sdk.R');
    for (const name of ['hs_location_rationale_title', 'hs_location_rationale_message', 'hs_location_rationale_continue', 'hs_location_rationale_not_now']) {
      expect(impl).toContain(`R.string.${name}`);
    }
    expect(impl).toContain('rationale?.takeIf { it.isNotBlank() } ?: activity.getString(messageRes)');
    expect(impl).toContain('.setOnDismissListener { if (!proceeding) promise.resolve(false) }');
    // 5) Sistem izni SDK istek koduyla; sonuçta onPermissionResult ve güncel izin.
    expect(impl).toContain('activity.requestPermissions(permissions, Pushizo.Location.PERMISSION_REQUEST_CODE, listener)');
    expect(impl).toContain('if (requestCode != Pushizo.Location.PERMISSION_REQUEST_CODE) return@PermissionListener false');
    expect(impl).toMatch(/Pushizo\.Location\.onPermissionResult\(\)\s+promise\.resolve\(granted\(\)\)/);
    expect(impl).toContain(') { Pushizo.Location.permissionGranted }');

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] setLocationShared:shared];');
    expect(mm).toContain('[[PushizoRNBridge shared] isLocationShared:resolve];');
    expect(mm).toContain('RCT_EXPORT_METHOD(requestLocationPermission:(NSString *_Nullable)rationale');
    expect(mm).toContain('[[PushizoRNBridge shared] requestLocationPermission:rationale resolve:resolve];');
    const swift = read('ios/PushizoRNBridge.swift');
    expect(swift).toContain('@objc public func setLocationShared(_ shared: Bool) { Pushizo.Location.setShared(shared) }');
    expect(swift).toContain('@objc public func isLocationShared(_ resolve: @escaping (Any?) -> Void) { resolve(Pushizo.Location.isShared) }');
    expect(swift).toContain('@objc public func requestLocationPermission(_ rationale: String?, resolve: @escaping (Any?) -> Void)');
    expect(swift).toContain('Pushizo.Location.requestPermission(rationale: text) { granted in resolve(granted) }');
  });

  test('Bölge izleme: yerel Location.setGeofencingEnabled/isGeofencingEnabled; izin manifest/Info.plist\'e eklenmez', () => {
    expect(methods).toEqual(expect.arrayContaining(['setGeofencingEnabled', 'isGeofencingEnabled']));
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('fun setGeofencingEnabled(enabled: Boolean) = Pushizo.Location.setGeofencingEnabled(enabled)');
    expect(impl).toContain('fun isGeofencingEnabled(promise: Promise) = promise.resolve(Pushizo.Location.isGeofencingEnabled)');
    expect(read('android/src/main/AndroidManifest.xml')).not.toContain('LOCATION');

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] setGeofencingEnabled:enabled];');
    expect(mm).toContain('[[PushizoRNBridge shared] isGeofencingEnabled:resolve];');
    const swift = read('ios/PushizoRNBridge.swift');
    expect(swift).toContain('Pushizo.Location.setGeofencingEnabled(enabled)');
    expect(swift).toContain('resolve(Pushizo.Location.isGeofencingEnabled)');
  });

  test('Konum izin durumu ve arka plan izni: Android ve iOS yerel özellikleri, Android köprü akışı, iOS requestAlwaysPermission', () => {
    expect(methods).toEqual(
      expect.arrayContaining(['locationPermissionGranted', 'locationBackgroundPermissionGranted', 'requestBackgroundLocationPermission']),
    );
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('fun locationPermissionGranted(promise: Promise) = promise.resolve(Pushizo.Location.permissionGranted)');
    expect(impl).toContain(
      'fun locationBackgroundPermissionGranted(promise: Promise) = promise.resolve(Pushizo.Location.backgroundPermissionGranted)',
    );
    // Zaten verilmişse true; Android 10 öncesinde normal konum akışı; manifest'te yoksa false.
    expect(impl).toMatch(/if \(Pushizo\.Location\.backgroundPermissionGranted\) \{\s+Pushizo\.Location\.onPermissionResult\(\)\s+promise\.resolve\(true\)/);
    expect(impl).toMatch(/if \(Build\.VERSION\.SDK_INT < Build\.VERSION_CODES\.Q\) \{\s+requestLocationPermission\(rationale, promise\)/);
    expect(impl).toMatch(/if \(!backgroundLocationDeclared\(\)\) \{\s+HsLog\.w\([^)]*\)\s+promise\.resolve\(false\)/);
    expect(impl).toContain('arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION)');
    expect(impl).toContain('R.string.hs_geofence_rationale_title');
    expect(impl).toContain('R.string.hs_geofence_rationale_message');
    expect(impl).toContain(') { Pushizo.Location.backgroundPermissionGranted }');

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('resolve(@([[PushizoRNBridge shared] locationPermissionGranted]));');
    expect(mm).toContain('resolve(@([[PushizoRNBridge shared] locationBackgroundPermissionGranted]));');
    expect(mm).toContain('[[PushizoRNBridge shared] requestBackgroundLocationPermission:resolve];');
    const swift = read('ios/PushizoRNBridge.swift');
    // iOS: izin durumu yerel SDK'dan okunur; köprünün kendi CLLocationManager uygulaması kaldırıldı.
    expect(swift).toContain('@objc public func locationPermissionGranted() -> Bool { Pushizo.Location.permissionGranted }');
    expect(swift).toContain(
      '@objc public func locationBackgroundPermissionGranted() -> Bool { Pushizo.Location.backgroundPermissionGranted }',
    );
    expect(swift).not.toContain('CLLocationManager');
    expect(swift).not.toContain('import CoreLocation');
    expect(swift).toContain('Pushizo.Location.requestAlwaysPermission { granted in resolve(granted) }');
  });

  test('Profille giriş, rıza, reklam kimliği, rozet, ADM ve sohbet akış durumu yerel SDK çağrılarına bağlı', () => {
    expect(methods).toEqual(
      expect.arrayContaining([
        'isInitialized', 'loginWithProfile', 'setAdsPersonalizationConsent', 'getConsents', 'registerAdm', 'setAdvertisingId',
        'setBadgeCount', 'getBadgeCount', 'chatIsListening',
      ]),
    );
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('fun isInitialized(promise: Promise) = promise.resolve(Pushizo.isInitialized)');
    expect(impl).toContain('Pushizo.login(externalId, profile.toUserProfile(), identityHash, jwt)');
    expect(impl).toContain('Pushizo.User.setAdsPersonalizationConsent(granted, reply(promise) { Arguments.makeNativeMap(it.toMap()) })');
    expect(impl).toContain('Pushizo.User.getConsents(reply(promise) { consents -> Arguments.makeNativeArray(consents.map { it.toMap() }) })');
    expect(impl).toContain('Pushizo.User.registerAdm(token)');
    expect(impl).toContain('fun setAdvertisingId(id: String?) = Pushizo.Ads.setAdvertisingId(id)');
    // Android rozeti yerel SDK'ya bağlı: sayı saklanır, sonuç "rozet gösterilebiliyor mu".
    expect(impl).toContain('promise.resolve(Pushizo.Notifications.setBadgeCount(count.toInt()))');
    expect(impl).toContain('fun getBadgeCount(promise: Promise) = promise.resolve(Pushizo.Notifications.badgeCount)');
    expect(impl).not.toContain('fun setBadgeCount(count: Double) = Unit');
    expect(impl).toContain('fun chatIsListening(promise: Promise) = promise.resolve(Pushizo.Chat.isListening)');
    const mappers = read('android/src/main/java/com/pushizo/reactnative/PushizoMappers.kt');
    expect(mappers).toContain('internal fun ReadableMap.toUserProfile(): HsUserProfile = HsUserProfile(');
    expect(mappers).toContain('"consents" to consents.map { it.toMap() }');
    expect(mappers).toContain('mapOf("purpose" to purpose, "granted" to granted, "source" to source, "updatedAt" to updatedAt)');

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('resolve(@([[PushizoRNBridge shared] isInitialized]));');
    expect(mm).toContain(
      '[[PushizoRNBridge shared] loginWithProfile:externalId profile:profile identityHash:identityHash jwt:jwt resolve:resolve reject:reject]',
    );
    expect(mm).toContain('[[PushizoRNBridge shared] setAdsPersonalizationConsent:granted resolve:resolve reject:reject]');
    expect(mm).toContain('[[PushizoRNBridge shared] getConsents:resolve reject:reject]');
    expect(mm).toContain('[[PushizoRNBridge shared] setAdvertisingId:advertisingId]');
    // iOS rozeti her zaman ayarlanır: sonuç YES.
    expect(mm).toMatch(/\[\[PushizoRNBridge shared\] setBadgeCount:\(NSInteger\)count\];\s+resolve\(@YES\);/);
    expect(mm).toContain('[[PushizoRNBridge shared] getBadgeCount:resolve];');
    expect(mm).toContain('resolve(@([[PushizoRNBridge shared] chatIsListening]));');
    // ADM yalnızca Android: iOS etkisiz biçimde çözülür.
    expect(mm).toMatch(/RCT_EXPORT_METHOD\(registerAdm:[^{]*\{\s+resolve\(nil\);/);
    const swift = read('ios/PushizoRNBridge.swift');
    // iOS'ta profil girişi yerel `login(_:profile:identityHash:jwt:)` çağrısıdır; köprünün kendi profil uygulaması kaldırıldı.
    const login = swift.slice(swift.indexOf('func loginWithProfile'), swift.indexOf('func updateUserJwt'));
    expect(login).toContain('let userProfile = HSUserProfile(');
    expect(login).toContain('try Pushizo.login(externalId, profile: userProfile, identityHash: identityHash, jwt: jwt)');
    for (const call of ['Pushizo.User.addEmail', 'Pushizo.User.addSms', 'Pushizo.User.addTags', 'Pushizo.User.addAliases']) {
      expect([call, login.includes(call)]).toEqual([call, false]);
    }
    // Hata kodları değişmedi: başlatılmamış SDK ve kanıt hatası NOT_READY, geçersiz profil INVALID_ARGUMENT (girişten önce).
    expect(login).toContain('guard Pushizo.isInitialized else { reject("NOT_READY", "Pushizo.initialize önce çağrılmalı", nil); return }');
    expect(login).toContain('if let message = userProfile.validationError { reject("INVALID_ARGUMENT", message, nil); return }');
    expect(login).toContain(
      'if let message = Pushizo.loginProofError(identityHash: identityHash, jwt: jwt) { reject("NOT_READY", message, nil); return }',
    );
    expect(login.indexOf('userProfile.validationError')).toBeLessThan(login.indexOf('Pushizo.loginProofError'));
    expect(login.indexOf('Pushizo.loginProofError')).toBeLessThan(login.indexOf('try Pushizo.login(externalId, profile:'));
    expect(login).toMatch(/catch HSError\.invalidArgument\(let message\) \{\s+reject\("INVALID_ARGUMENT", message, nil\)/);
    // Yerel profil hata metinleri köprünün önceki metinleriyle aynıdır.
    const profileSource = readFileSync(join(root, '..', 'ios', 'Sources', 'PushizoCore', 'HSUserProfile.swift'), 'utf8');
    expect(profileSource).toContain('return "Geçersiz e-posta adresi"');
    expect(profileSource).toContain('return "Geçersiz telefon numarası"');
    expect(swift).toContain('try await Self.map(Pushizo.User.setAdsPersonalizationConsent(granted))');
    expect(swift).toContain('try await Pushizo.User.getConsents().map { Self.map($0) }');
    expect(swift).toContain('@objc public func setAdvertisingId(_ id: String?) { Pushizo.Ads.setAdvertisingId(id) }');
    expect(swift).toContain('Pushizo.Notifications.setBadgeCount(count)');
    expect(swift).toContain('Pushizo.Notifications.clearBadge()');
    expect(swift).toContain('onMain { resolve(UIApplication.shared.applicationIconBadgeNumber) }');
    expect(swift).toContain('@objc public func chatIsListening() -> Bool { Pushizo.Chat.isListening }');
    expect(swift).toContain('"consents": r.consents.map { map($0) }');
  });

  test('Android teslimat güçlendirme: yerel Pushizo.Delivery çağrılarına bağlı; iOS zararsız yanıt verir', () => {
    expect(methods).toEqual(
      expect.arrayContaining(['deliveryStatus', 'deliveryShouldShowGuidance', 'deliveryOpenSettings', 'deliveryShowGuidance']),
    );
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('Pushizo.Delivery.status()?.toMap() ?: mapOf("supported" to false)');
    expect(impl).toContain('promise.resolve(Pushizo.Delivery.shouldShowGuidance(minIntervalDays.toInt()))');
    expect(impl).toContain('promise.resolve(Pushizo.Delivery.openSettings(context.currentActivity ?: context, setting.toDeliverySetting()))');
    expect(impl).toContain('Pushizo.Delivery.showGuidance(activity, setting.toDeliverySetting(), message) { opened -> promise.resolve(opened) }');
    // Activity yoksa diyalog gösterilmez; reddetmek yerine false döner.
    expect(impl).toMatch(/fun deliveryShowGuidance\([^)]*\) \{\s+val activity = context\.currentActivity\s+if \(activity == null\) \{\s+promise\.resolve\(false\)/);
    // Köprü pil optimizasyonu iznini istemez ve manifest'e eklemez (ADR-0092 §3).
    expect(impl).not.toContain('REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
    expect(read('android/src/main/AndroidManifest.xml')).not.toContain('REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
    const mappers = read('android/src/main/java/com/pushizo/reactnative/PushizoMappers.kt');
    expect(mappers).toContain('internal fun HsDeliveryStatus.toMap(): Map<String, Any?> = mapOf(');
    // TS `DeliveryStatus` alanlarının tümü yerel haritada bulunur.
    const types = read('src/types.ts');
    const fields = [...types.slice(types.indexOf('export interface DeliveryStatus {')).split('\n}')[0].matchAll(/^\s{2}([a-zA-Z]+): /gm)].map((m) => m[1]);
    expect(fields.length).toBe(17);
    const map = mappers.slice(mappers.indexOf('internal fun HsDeliveryStatus.toMap()'));
    for (const field of fields) expect([field, map.includes(`"${field}" to `)]).toEqual([field, true]);

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('RCT_EXPORT_METHOD(deliveryStatus:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)\n{\n  resolve(@{@"supported": @NO});');
    for (const method of ['deliveryShouldShowGuidance', 'deliveryOpenSettings', 'deliveryShowGuidance']) {
      const body = mm.slice(mm.indexOf(`RCT_EXPORT_METHOD(${method}:`));
      expect([method, body.slice(0, body.indexOf('\n}\n')).trimEnd().endsWith('resolve(@NO);')]).toEqual([method, true]);
    }
  });

  test('Özellik bayrakları: yerel FeatureFlags yüzeyine bağlı; değer `{ value }` zarfıyla döner', () => {
    expect(methods).toEqual(expect.arrayContaining(['featureFlagsRefresh', 'featureFlagsIsEnabled', 'featureFlagsGetValue']));
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('Pushizo.FeatureFlags.refresh { promise.resolve(it) }');
    expect(impl).toContain('promise.resolve(Pushizo.FeatureFlags.isEnabled(key, defaultValue))');
    expect(impl).toContain('mapOf("value" to Pushizo.FeatureFlags.getValue(key).toBridgeValue())');

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] featureFlagsRefresh:resolve];');
    expect(mm).toContain('resolve(@([[PushizoRNBridge shared] featureFlagsIsEnabled:key defaultValue:defaultValue]));');
    expect(mm).toContain('resolve([[PushizoRNBridge shared] featureFlagsGetValue:key]);');
    const swift = read('ios/PushizoRNBridge.swift');
    expect(swift).toContain('let ok = await Pushizo.FeatureFlags.refresh()');
    expect(swift).toContain('Pushizo.FeatureFlags.isEnabled(key, default: defaultValue)');
    expect(swift).toContain('["value": Pushizo.FeatureFlags.value(key) ?? NSNull()]');
  });

  test('Gömülü yerleşimler: liste yerel modeli eşler, raporlar kimlikle sınırlı önbellekten çözülür', () => {
    expect(methods).toEqual(
      expect.arrayContaining(['placementsList', 'placementsReportImpression', 'placementsReportClick', 'placementsReportDismiss']),
    );
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('Pushizo.Placements.list(key, limit.toInt()) { messages ->');
    expect(impl).toContain('promise.resolve(Arguments.makeNativeArray(messages.map { it.toMap() }))');
    expect(impl).toContain('placementMessage(messageId)?.let { Pushizo.Placements.reportImpression(it) }');
    expect(impl).toContain('placementMessage(messageId)?.let { Pushizo.Placements.reportClick(it, buttonId) }');
    expect(impl).toContain('placementMessage(messageId)?.let { Pushizo.Placements.reportDismiss(it) }');
    expect(impl).toContain('private const val MAX_PLACEMENT_MESSAGES = 50');
    expect(impl).toContain('HsLog.d("yerleşim raporu atlandı: mesaj önbellekte yok ($messageId)")');
    const mappers = read('android/src/main/java/com/pushizo/reactnative/PushizoMappers.kt');
    expect(mappers).toContain('internal fun HsInAppMessage.toMap(): Map<String, Any?> = mapOf(');
    expect(mappers).toContain('"raw" to JSONObject(toJson()).toBridgeValue()');

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] placementsList:key limit:limit resolve:resolve reject:reject];');
    expect(mm).toContain('[[PushizoRNBridge shared] placementsReportImpression:messageId];');
    expect(mm).toContain('[[PushizoRNBridge shared] placementsReportClick:messageId buttonId:buttonId];');
    expect(mm).toContain('[[PushizoRNBridge shared] placementsReportDismiss:messageId];');
    const swift = read('ios/PushizoRNBridge.swift');
    expect(swift).toContain('let messages = try await Pushizo.Placements.list(key, limit: Int(limit))');
    expect(swift).toContain('Pushizo.Placements.reportImpression(message)');
    expect(swift).toContain('Pushizo.Placements.reportClick(message, buttonId: buttonId)');
    expect(swift).toContain('Pushizo.Placements.reportDismiss(message)');
    expect(swift).toContain('private static let maxPlacementMessages = 50');
    expect(swift).toContain('private static func map(_ m: HSInAppMessage) -> [String: Any]');
  });

  test('Canlı sohbet: yerel Pushizo.Chat yüzeyine bağlı, olaylar ve sohbet açma tıklaması köprüden gelir', () => {
    const chat = methods.filter((m) => m.startsWith('chat'));
    expect(chat.length).toBeGreaterThanOrEqual(16);

    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('Pushizo.Chat.start(name, email, language, reply(promise)');
    expect(impl).toContain('Pushizo.Chat.sendMessage(text, optionId, reply(promise)');
    expect(impl).toContain('Pushizo.Chat.getMessages(afterSeq?.toLong(), beforeSeq?.toLong(), limit.toInt(), reply(promise)');
    expect(impl).toContain('Pushizo.Chat.markRead(seq.toLong(), reply(promise) { it })');
    expect(impl).toContain('fun chatStartListening() = Pushizo.Chat.startListening()');
    const bridge = read('android/src/main/java/com/pushizo/reactnative/PushizoBridge.kt');
    expect(bridge).toContain('const val EVENT_CHAT = "Pushizo-chatEvent"');
    expect(bridge).toContain('const val EVENT_CHAT_OPEN = "Pushizo-chatOpen"');
    expect(bridge).toContain('Pushizo.Chat.addListener(chatListener)');
    expect(bridge).toContain('Pushizo.Chat.addOpenListener(chatOpenListener)');

    const swift = read('ios/PushizoRNBridge.swift');
    expect(swift).toContain('@objc public static let eventChat = "Pushizo-chatEvent"');
    expect(swift).toContain('@objc public static let eventChatOpen = "Pushizo-chatOpen"');
    expect(swift).toContain('try await Pushizo.Chat.sendMessage(text, optionId: optionId).dictionary');
    expect(swift).toContain('try await Pushizo.Chat.markRead(Int(seq))');
    expect(swift).toContain('@objc public func chatStartListening() { Pushizo.Chat.startListening() }');
    expect(swift).toContain('registerChatListeners()');
    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] chatSendMessage:text optionId:optionId resolve:resolve reject:reject];');
  });

  test('Kullanıcı özelliği: `{ value }` zarfı yerel User.setProperty çağrısına bağlı; geçersiz girdi INVALID_ARGUMENT', () => {
    expect(methods).toContain('setUserProperty');
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    // Boş anahtar yerel SDK'dan IllegalArgumentException → guard → INVALID_ARGUMENT.
    expect(impl).toMatch(
      /fun setUserProperty\(key: String, property: ReadableMap, promise: Promise\) = guard\(promise\) \{\s+Pushizo\.User\.setProperty\(key, property\.toHashMap\(\)\["value"\]\)\s+promise\.resolve\(null\)/,
    );
    expect(impl).toContain('is IllegalArgumentException -> "INVALID_ARGUMENT"');

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] setUserProperty:key property:property resolve:resolve reject:reject];');
    const swift = read('ios/PushizoRNBridge.swift');
    const body = swift.slice(swift.indexOf('func setUserProperty'), swift.indexOf('// MARK: - Tercihler'));
    expect(body).toContain('let value: Any? = raw is NSNull ? nil : raw');
    // Yerel iOS SDK geçersiz girdiyi yalnızca günlüğe yazar; köprü aynı kuralla (HSUserProperties) reddeder.
    expect(body).toMatch(/guard HSUserProperties\.operation\(key: key, value: value\) != nil else \{\s+reject\("INVALID_ARGUMENT"/);
    expect(body).toContain('Pushizo.User.setProperty(key, value)');
  });

  test('Gözlemciler: FeatureFlags ve Inbox yerel gözlemcileri bir kez kaydedilir, olaylar JS olay adlarıyla yayılır', () => {
    const types = read('src/types.ts');
    expect(types).toContain("FeatureFlagsChange: 'Pushizo-featureFlagsChange'");
    expect(types).toContain("InboxChange: 'Pushizo-inboxChange'");

    const bridge = read('android/src/main/java/com/pushizo/reactnative/PushizoBridge.kt');
    expect(bridge).toContain('const val EVENT_FEATURE_FLAGS = "Pushizo-featureFlagsChange"');
    expect(bridge).toContain('const val EVENT_INBOX = "Pushizo-inboxChange"');
    expect(bridge).toContain('Pushizo.FeatureFlags.addObserver(featureFlagObserver)');
    expect(bridge).toContain('Pushizo.Inbox.addObserver(inboxObserver)');
    expect(bridge).toContain('private val featureFlagObserver = HsFeatureFlagObserver { emit(EVENT_FEATURE_FLAGS, emptyMap()) }');
    expect(bridge).toContain('private val inboxObserver = HsInboxObserver { event -> emit(EVENT_INBOX, event.toMap()) }');
    // Kayıt, diğer yerel dinleyicilerle aynı tek seferlik blokta yapılır.
    const register = bridge.slice(bridge.indexOf('private fun registerListeners'), bridge.indexOf('// --- Sink yönetimi ---'));
    expect(register).toContain('if (listenersRegistered) return');
    expect(register).toContain('Pushizo.FeatureFlags.addObserver(featureFlagObserver)');
    expect(register).toContain('Pushizo.Inbox.addObserver(inboxObserver)');

    const swift = read('ios/PushizoRNBridge.swift');
    expect(swift).toContain('@objc public static let eventFeatureFlags = "Pushizo-featureFlagsChange"');
    expect(swift).toContain('@objc public static let eventInbox = "Pushizo-inboxChange"');
    // RCTEventEmitter yalnızca `supportedEvents` içindeki adları gönderir.
    const supported = swift.slice(swift.indexOf('static var supportedEvents'), swift.indexOf('/// Info.plist anahtarları'));
    expect(supported).toContain('eventFeatureFlags, eventInbox');
    expect(swift).toMatch(/Pushizo\.FeatureFlags\.addObserver \{ \[weak self\] in\s+self\?\.emit\(Self\.eventFeatureFlags, \[:\]\)/);
    expect(swift).toMatch(/Pushizo\.Inbox\.addObserver \{ \[weak self\] event in\s+self\?\.emit\(Self\.eventInbox, event\.dictionary\)/);
  });

  test('Olay kimliği: sendEventWithId yerel Session.sendEvent eventId aşırı yüklemesine bağlı; eski sendEvent değişmedi', () => {
    expect(methods).toEqual(expect.arrayContaining(['sendEvent', 'sendEventWithId']));
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toMatch(/fun sendEvent\(name: String, properties: ReadableMap, value: Double\?\) =\s+Pushizo\.Session\.sendEvent\(name, properties\.toHashMap\(\), value\)/);
    expect(impl).toMatch(
      /fun sendEventWithId\(name: String, properties: ReadableMap, value: Double\?, eventId: String\) =\s+Pushizo\.Session\.sendEvent\(name, properties\.toHashMap\(\), value, eventId\)/,
    );
    // Eski mimaride boş geçilebilir sayı `Dynamic` olarak gelir.
    const oldArch = read('android/src/oldarch/java/com/pushizo/reactnative/PushizoModule.kt');
    expect(oldArch).toContain('impl.sendEventWithId(name, properties, value.numberOrNull(), eventId)');

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] sendEventWithId:name properties:properties value:value eventId:eventId];');
    const swift = read('ios/PushizoRNBridge.swift');
    expect(swift).toContain('Pushizo.Session.sendEvent(name, properties: properties, value: value?.doubleValue)');
    expect(swift).toContain('Pushizo.Session.sendEvent(name, properties: properties, value: value?.doubleValue, eventId: eventId)');
  });

  test('Hazır sohbet ekranı: show/hide yerel Chat çağrılarına bağlı; Android açık ekranı köprü izler', () => {
    expect(methods).toEqual(expect.arrayContaining(['chatShow', 'chatHide', 'chatIsPresented']));
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('Pushizo.Chat.show(context.currentActivity ?: context)');
    expect(impl).toContain('fun chatHide(promise: Promise) = promise.resolve(Pushizo.Chat.hide())');
    expect(impl).toContain('fun chatIsPresented(promise: Promise) = promise.resolve(PushizoBridge.chatPresented)');
    // Yerel Android SDK `isPresented` sunmaz: köprü HsChatActivity örneklerini yaşam döngüsünden izler.
    const bridge = read('android/src/main/java/com/pushizo/reactnative/PushizoBridge.kt');
    expect(bridge).toContain('(appContext as? Application)?.registerActivityLifecycleCallbacks(chatScreenTracker)');
    expect(bridge).toContain('if (activity is HsChatActivity) chatScreens.add(activity)');
    expect(bridge).toContain('chatScreens.any { !it.isFinishing && !it.isDestroyed }');

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] chatShow];');
    expect(mm).toContain('[[PushizoRNBridge shared] chatHide:resolve];');
    expect(mm).toContain('[[PushizoRNBridge shared] chatIsPresented:resolve];');
    const swift = read('ios/PushizoRNBridge.swift');
    const show = swift.slice(swift.indexOf('@objc public func chatShow()'), swift.indexOf('@objc public func chatHide'));
    // SDK başlatılmadıysa ekran açılmaz (Android ile aynı).
    expect(show.indexOf('guard Pushizo.isInitialized else { return }')).toBeLessThan(show.indexOf('Pushizo.Chat.show()'));
    expect(show).toContain('Pushizo.Chat.show()');
    expect(swift).toMatch(/let presented = Pushizo\.Chat\.isPresented\s+Pushizo\.Chat\.hide\(\)\s+resolve\(presented\)/);
    expect(swift).toContain('onMain { resolve(Pushizo.Chat.isPresented) }');
  });
});
