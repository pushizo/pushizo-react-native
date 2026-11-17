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
    // 2) Yalnızca manifest'te tanımlı ön plan izinleri istenir; arka plan konumu yok.
    expect(impl).toContain('context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)');
    expect(impl).toContain('Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION');
    expect(impl).not.toContain('ACCESS_BACKGROUND_LOCATION');
    expect(impl).toMatch(/if \(permissions\.isEmpty\(\)\) \{\s+HsLog\.w\([^)]*\)\s+promise\.resolve\(false\)/);
    // 3) Activity yoksa köprünün NO_ACTIVITY deseni.
    expect(impl).toMatch(/if \(activity !is PermissionAwareActivity\) \{\s+promise\.reject\("NO_ACTIVITY"/);
    // 4) Açıklama diyaloğu SDK string kaynaklarıyla; "Devam" dışındaki kapanış false.
    expect(impl).toContain('import com.pushizo.sdk.R');
    for (const name of ['hs_location_rationale_title', 'hs_location_rationale_message', 'hs_location_rationale_continue', 'hs_location_rationale_not_now']) {
      expect(impl).toContain(`R.string.${name}`);
    }
    expect(impl).toContain("rationale?.takeIf { it.isNotBlank() } ?: activity.getString(R.string.hs_location_rationale_message)");
    expect(impl).toContain('.setOnDismissListener { if (!proceeding) promise.resolve(false) }');
    // 5) Sistem izni SDK istek koduyla; sonuçta onPermissionResult ve güncel izin.
    expect(impl).toContain('activity.requestPermissions(permissions, Pushizo.Location.PERMISSION_REQUEST_CODE, listener)');
    expect(impl).toContain('if (requestCode != Pushizo.Location.PERMISSION_REQUEST_CODE) return@PermissionListener false');
    expect(impl).toMatch(/Pushizo\.Location\.onPermissionResult\(\)\s+promise\.resolve\(Pushizo\.Location\.permissionGranted\)/);

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

  test('Bölge izleme: yerel Location.setGeofencingEnabled/isGeofencingEnabled; köprü arka plan izni istemez', () => {
    expect(methods).toEqual(expect.arrayContaining(['setGeofencingEnabled', 'isGeofencingEnabled']));
    const impl = read('android/src/main/java/com/pushizo/reactnative/PushizoModuleImpl.kt');
    expect(impl).toContain('fun setGeofencingEnabled(enabled: Boolean) = Pushizo.Location.setGeofencingEnabled(enabled)');
    expect(impl).toContain('fun isGeofencingEnabled(promise: Promise) = promise.resolve(Pushizo.Location.isGeofencingEnabled)');
    expect(impl).not.toContain('ACCESS_BACKGROUND_LOCATION');
    expect(read('android/src/main/AndroidManifest.xml')).not.toContain('LOCATION');

    const mm = read('ios/PushizoRN.mm');
    expect(mm).toContain('[[PushizoRNBridge shared] setGeofencingEnabled:enabled];');
    expect(mm).toContain('[[PushizoRNBridge shared] isGeofencingEnabled:resolve];');
    const swift = read('ios/PushizoRNBridge.swift');
    expect(swift).toContain('Pushizo.Location.setGeofencingEnabled(enabled)');
    expect(swift).toContain('resolve(Pushizo.Location.isGeofencingEnabled)');
    expect(swift).not.toContain('requestAlwaysPermission');
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
});
