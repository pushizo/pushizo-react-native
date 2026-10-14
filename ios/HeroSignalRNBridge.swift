import Foundation
import HeroSignal
// SPM: ayrı modül; CocoaPods alt spec'leri tek "HeroSignal" modülünde derlenir.
#if canImport(HeroSignalCore)
import HeroSignalCore
#endif
import UIKit
import UserNotifications

/**
 React Native → iOS SDK köprüsünün Swift gövdesi. ObjC++ modülü (`HeroSignalRN.mm`) tüm çağrıları buraya iletir.

 Yerel dinleyiciler süreç başına bir kez kaydedilir; olaylar o an bağlı olan modülün yayıcısına gönderilir. Bildirim
 tıklamaları JS'te `click` dinleyicisi eklenene kadar bekletilir (soğuk açılış). Info.plist'te `HeroSignalAppId` varsa SDK
 uygulama açılışında (JS yüklenmeden) başlatılır; böylece bildirim merkezi temsilcisi zamanında kurulur.
 */
@objc(HeroSignalRNBridge)
public final class HeroSignalRNBridge: NSObject, HSInAppLifecycleListener {
    @objc public static let shared = HeroSignalRNBridge()

    @objc public static let eventClick = "HeroSignal-notificationClick"
    @objc public static let eventForeground = "HeroSignal-notificationWillDisplay"
    @objc public static let eventPermission = "HeroSignal-permissionChange"
    @objc public static let eventSubscription = "HeroSignal-pushSubscriptionChange"
    @objc public static let eventInAppClick = "HeroSignal-inAppClick"
    @objc public static let eventInAppLifecycle = "HeroSignal-inAppLifecycle"

    @objc public static var supportedEvents: [String] {
        [eventClick, eventForeground, eventPermission, eventSubscription, eventInAppClick, eventInAppLifecycle]
    }

    /// Info.plist anahtarları (Expo config plugin yazar; bare RN'de elle eklenebilir).
    static let plistAppId = "HeroSignalAppId"
    static let plistApiUrl = "HeroSignalApiUrl"

    private static let maxPendingClicks = 10

    // Tüm durum ana iş parçacığında değiştirilir.
    private var emitter: ((String, [String: Any]) -> Void)?
    private var jsEvents = Set<String>()
    private var pendingClicks: [[String: Any]] = []
    private var listenersRegistered = false
    private var initializedAppId: String?
    private var foregroundHandlerEnabled = false
    private var foregroundEvents: [String: HSForegroundEvent] = [:]
    private var lastState: [String: Any]?

    // MARK: - Erken başlatma (ObjC +load → UIApplicationDidFinishLaunchingNotification)

    @objc public func autoInitialize(launchOptions: [AnyHashable: Any]?) {
        guard let appId = Bundle.main.object(forInfoDictionaryKey: Self.plistAppId) as? String, !appId.isEmpty else { return }
        let apiUrl = Bundle.main.object(forInfoDictionaryKey: Self.plistApiUrl) as? String
        var options: [String: Any] = [:]
        if let apiUrl, !apiUrl.isEmpty { options["apiUrl"] = apiUrl }
        let launch = launchOptions as? [UIApplication.LaunchOptionsKey: Any]
        onMain { self.start(appId: appId, options: options, launchOptions: launch) }
    }

    // MARK: - Yayıcı bağlantısı

    @objc public func attach(emitter: @escaping (String, [String: Any]) -> Void) {
        onMain {
            self.emitter = emitter
            self.jsEvents.removeAll()
        }
    }

    @objc public func detach() {
        onMain {
            self.emitter = nil
            self.jsEvents.removeAll()
            self.foregroundHandlerEnabled = false
            // Bekleyen ön plan kararları JS olmadan verilemez: varsayılan davranış (göster) uygulanır.
            self.foregroundEvents.values.forEach { $0.display() }
            self.foregroundEvents.removeAll()
        }
    }

    @objc public func jsListenerAdded(_ event: String) {
        onMain {
            self.jsEvents.insert(event)
            guard event == Self.eventClick else { return }
            let pending = self.pendingClicks
            self.pendingClicks.removeAll()
            pending.forEach { self.emit(Self.eventClick, $0) }
        }
    }

    private func emit(_ event: String, _ body: [String: Any]) {
        onMain { self.emitter?(event, body) }
    }

    // MARK: - Başlatma ve gizlilik

    @objc public func setup(_ appId: String, options: [String: Any], resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        guard !appId.trimmingCharacters(in: .whitespaces).isEmpty else { reject("INVALID_ARGUMENT", "appId gerekli", nil); return }
        onMain {
            self.start(appId: appId, options: options, launchOptions: nil)
            resolve(nil)
        }
    }

    /// Yerel SDK'yı bir kez başlatır (aynı appId ile tekrar çağrı yok sayılır) ve köprü dinleyicilerini kurar.
    private func start(appId: String, options: [String: Any], launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {
        if initializedAppId != appId || !HeroSignal.isInitialized {
            initializedAppId = appId
            HeroSignal.initialize(appId, launchOptions: launchOptions) { o in
                if let apiUrl = options["apiUrl"] as? String, !apiUrl.isEmpty { o.apiUrl = apiUrl }
                if let consent = options["requiresPrivacyConsent"] as? Bool { o.requiresPrivacyConsent = consent }
                if let level = options["logLevel"] as? String { o.logLevel = Self.logLevel(level) }
                if let env = options["apnsEnvironment"] as? String, !env.isEmpty { o.apnsEnvironment = env }
                if let provisional = options["provisionalAuthorization"] as? Bool { o.provisionalAuthorization = provisional }
                let group = (options["appGroup"] as? String) ?? (Bundle.main.object(forInfoDictionaryKey: HSAppGroup.infoPlistKey) as? String)
                if let group, !group.isEmpty { o.appGroup = group }
            }
        }
        registerListeners()
    }

    private func registerListeners() {
        guard !listenersRegistered else { return }
        listenersRegistered = true
        HeroSignal.Notifications.addClickListener { [weak self] e in
            guard let self else { return }
            let payload: [String: Any] = ["notification": Self.map(e.notification), "actionId": e.actionId ?? NSNull(), "url": e.url ?? NSNull()]
            self.onMain {
                if self.emitter != nil && self.jsEvents.contains(Self.eventClick) {
                    self.emit(Self.eventClick, payload)
                } else {
                    if self.pendingClicks.count >= Self.maxPendingClicks { self.pendingClicks.removeFirst() }
                    self.pendingClicks.append(payload)
                }
            }
        }
        // Ön plan: JS dinleyicisi varsa gösterim ertelenir; JS displayNotification/preventDefault ile karar verir.
        // Yanıt gelmezse SDK 25 sn sonra bildirimi göstermeden kapatır (HSForegroundEvent.displayTimeout).
        HeroSignal.Notifications.addForegroundLifecycleListener { [weak self] e in
            guard let self, self.foregroundHandlerEnabled, self.emitter != nil else { return }
            e.preventDefault()
            let id = UUID().uuidString
            self.onMain {
                self.foregroundEvents[id] = e
                self.emit(Self.eventForeground, ["notificationId": id, "notification": Self.map(e.notification)])
                DispatchQueue.main.asyncAfter(deadline: .now() + HSForegroundEvent.displayTimeout) { self.foregroundEvents.removeValue(forKey: id) }
            }
        }
        HeroSignal.User.pushSubscription.addObserver { [weak self] s in
            self?.onMain { self?.onSubscriptionState(s) }
        }
        HeroSignal.InAppMessages.addClickListener { [weak self] e in
            self?.emit(Self.eventInAppClick, ["messageId": e.messageId, "actionId": e.actionId, "url": e.url ?? NSNull()])
        }
        HeroSignal.InAppMessages.addLifecycleListener(self)
        // Yerel SDK izin gözlemcisi: requestPermission sonrası ve uygulama yeniden etkinleştiğinde (izin Ayarlar'dan
        // değişmiş olabilir) etkin izin değiştiyse çağrılır.
        HeroSignal.Notifications.addPermissionObserver { [weak self] granted in
            self?.emit(Self.eventPermission, ["permission": granted])
        }
        Task { [weak self] in
            let state = await HeroSignal.User.pushSubscription.state()
            self?.onMain {
                guard let self else { return }
                if self.lastState == nil { self.lastState = Self.map(state) }
            }
        }
    }

    private func onSubscriptionState(_ s: HSPushSubscriptionState) {
        let current = Self.map(s)
        let previous = lastState
        lastState = current
        if previous.map({ !NSDictionary(dictionary: $0).isEqual(to: current) }) ?? true {
            emit(Self.eventSubscription, ["previous": previous ?? current, "current": current])
        }
    }

    @objc public func setConsentGiven(_ given: Bool) { HeroSignal.setConsentGiven(given) }

    @objc public func login(_ externalId: String, identityHash: String?, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        guard HeroSignal.isInitialized else { reject("NOT_READY", "HeroSignal.initialize önce çağrılmalı", nil); return }
        HeroSignal.login(externalId, identityHash: identityHash)
        resolve(nil)
    }

    @objc public func logout() { HeroSignal.logout() }

    // MARK: - Kullanıcı

    @objc public func addTags(_ tags: [String: Any], resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        HeroSignal.User.addTags(Self.stringMap(tags))
        resolve(nil)
    }

    @objc public func removeTags(_ keys: [Any], resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        HeroSignal.User.removeTags(keys.compactMap { $0 as? String })
        resolve(nil)
    }

    @objc public func getTags() -> [String: String] { HeroSignal.User.getTags() }

    /// Alias kuralları yerel SDK ile aynı: geçersizse `INVALID_ARGUMENT` (yerel SDK yalnızca günlüğe yazar).
    @objc public func addAliases(_ aliases: [String: Any], resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        let map = Self.stringMap(aliases)
        guard HSAliases.normalize(map) != nil else {
            reject("INVALID_ARGUMENT", "Geçersiz alias: etiketler küçük harf/rakam/_ (en fazla 50), değer 1-255 karakter, en fazla 20 alias.", nil)
            return
        }
        HeroSignal.User.addAliases(map)
        resolve(nil)
    }

    @objc public func removeAlias(_ label: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        guard HSAliases.isValidLabel(label) else { reject("INVALID_ARGUMENT", "Geçersiz alias etiketi.", nil); return }
        HeroSignal.User.removeAlias(label)
        resolve(nil)
    }

    @objc public func setLanguage(_ code: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        HeroSignal.User.setLanguage(code)
        resolve(nil)
    }

    @objc public func contact(_ op: String, address: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        switch op {
        case "addEmail", "removeEmail":
            guard HSContacts.normalizeEmail(address) != nil else { reject("INVALID_ARGUMENT", "Geçersiz e-posta adresi.", nil); return }
            if op == "addEmail" { HeroSignal.User.addEmail(address) } else { HeroSignal.User.removeEmail(address) }
        case "addSms", "removeSms":
            guard HSContacts.normalizePhone(address) != nil else { reject("INVALID_ARGUMENT", "Geçersiz telefon numarası (E.164 bekleniyor).", nil); return }
            if op == "addSms" { HeroSignal.User.addSms(address) } else { HeroSignal.User.removeSms(address) }
        default:
            reject("INVALID_ARGUMENT", "Bilinmeyen işlem: \(op)", nil)
            return
        }
        resolve(nil)
    }

    @objc public func externalId() -> String? { HeroSignal.User.externalId }
    @objc public func userId() -> String? { HeroSignal.User.id }

    // MARK: - Tercihler (ADR-0019 §4; abonelik yoksa NOT_READY, geçersiz girdi INVALID_ARGUMENT)

    @objc public func getPreferences(_ resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        inbox(resolve, reject) { try await Self.map(HeroSignal.User.getPreferences()) }
    }

    /// Kurallar (1-100 kayıt, kategori 1-64, bilinen kanal) yerel SDK'da doğrulanır; tipi bozuk alan boş/varsayılan
    /// değere düşer ve orada `INVALID_ARGUMENT` ile reddedilir.
    @objc public func setPreferences(_ preferences: [Any], resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        let inputs = preferences.compactMap { $0 as? [String: Any] }.map {
            HSPreferenceInput(category: $0["category"] as? String ?? "", channel: $0["channel"] as? String, optedIn: $0["optedIn"] as? Bool ?? false)
        }
        inbox(resolve, reject) { try await Self.map(HeroSignal.User.setPreferences(inputs)) }
    }

    // MARK: - Push aboneliği

    @objc public func getPushSubscriptionState(_ resolve: @escaping (Any?) -> Void) {
        Task {
            let s = await HeroSignal.User.pushSubscription.state()
            DispatchQueue.main.async { resolve(Self.map(s)) }
        }
    }

    @objc public func optIn() { HeroSignal.User.pushSubscription.optIn() }
    @objc public func optOut() { HeroSignal.User.pushSubscription.optOut() }

    // MARK: - Bildirimler

    @objc public func getPermission(_ resolve: @escaping (Any?) -> Void) {
        Task {
            let p = await HeroSignal.Notifications.permission()
            DispatchQueue.main.async { resolve(Self.granted(p)) }
        }
    }

    @objc public func requestPermission(_ resolve: @escaping (Any?) -> Void) {
        HeroSignal.Notifications.requestPermission { granted in DispatchQueue.main.async { resolve(granted) } }
    }

    @objc public func clearAll() { HeroSignal.Notifications.clearAll() }

    @objc public func setForegroundHandlerEnabled(_ enabled: Bool) { onMain { self.foregroundHandlerEnabled = enabled } }

    @objc public func displayNotification(_ id: String) { onMain { self.foregroundEvents.removeValue(forKey: id)?.display() } }

    /// JS gösterimi engelledi: olay (yerelde zaten ertelenmiş) 25 sn tutulur; bu sürede `displayNotification` ile yine
    /// gösterilebilir, çağrılmazsa SDK bildirimi göstermeden kapatır. Ek yerel işlem gerekmez.
    @objc public func preventDefault(_ id: String) {}

    // MARK: - Oturum

    @objc public func sendEvent(_ name: String, properties: [String: Any], value: NSNumber?) {
        HeroSignal.Session.sendEvent(name, properties: properties, value: value?.doubleValue)
    }

    // MARK: - In-app

    @objc public func addTriggers(_ triggers: [String: Any], resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        let map = Self.stringMap(triggers)
        guard map.allSatisfy({ !$0.key.isEmpty && $0.key.count <= 64 && $0.value.count <= 200 }) else {
            reject("INVALID_ARGUMENT", "Geçersiz trigger: anahtar 1-64, değer en fazla 200 karakter.", nil)
            return
        }
        onMain {
            HeroSignal.InAppMessages.addTriggers(map)
            resolve(nil)
        }
    }

    @objc public func removeTriggers(_ keys: [Any]) {
        let list = keys.compactMap { $0 as? String }
        onMain { HeroSignal.InAppMessages.removeTriggers(list) }
    }

    @objc public func clearTriggers() { onMain { HeroSignal.InAppMessages.clearTriggers() } }

    @objc public func getTriggers(_ resolve: @escaping (Any?) -> Void) { onMain { resolve(HeroSignal.InAppMessages.getTriggers()) } }

    @objc public func setScreen(_ name: String?) { onMain { HeroSignal.InAppMessages.setScreen(name) } }

    @objc public func setInAppPaused(_ paused: Bool) { onMain { HeroSignal.InAppMessages.paused = paused } }

    @objc public func getInAppPaused(_ resolve: @escaping (Any?) -> Void) { onMain { resolve(HeroSignal.InAppMessages.paused) } }

    public func onWillDisplay(_ message: HSInAppMessage) { emitLifecycle("willDisplay", message) }
    public func onDidDisplay(_ message: HSInAppMessage) { emitLifecycle("didDisplay", message) }
    public func onWillDismiss(_ message: HSInAppMessage) { emitLifecycle("willDismiss", message) }
    public func onDidDismiss(_ message: HSInAppMessage) { emitLifecycle("didDismiss", message) }

    private func emitLifecycle(_ event: String, _ message: HSInAppMessage) {
        emit(Self.eventInAppLifecycle, ["event": event, "messageId": message.id])
    }

    // MARK: - Bildirim kutusu

    @objc public func inboxList(_ limit: Double, cursor: String?, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        inbox(resolve, reject) { try await Self.map(HeroSignal.Inbox.list(limit: Int(limit), cursor: cursor)) }
    }

    @objc public func inboxMarkRead(_ id: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        inbox(resolve, reject) { try await Self.map(HeroSignal.Inbox.markRead(id)) }
    }

    @objc public func inboxMarkAllRead(_ resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        inbox(resolve, reject) { try await HeroSignal.Inbox.markAllRead() }
    }

    @objc public func inboxArchive(_ id: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        inbox(resolve, reject) {
            try await HeroSignal.Inbox.archive(id)
            return nil
        }
    }

    @objc public func inboxUnreadCount(_ resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
        inbox(resolve, reject) { try await HeroSignal.Inbox.unreadCount() }
    }

    /// Asenkron yerel çağrı (bildirim kutusu, tercihler). Hata kodları: sunucu `HSApiError.code`, kullanım hataları
    /// `NOT_READY` / `INVALID_ARGUMENT`.
    private func inbox(_ resolve: @escaping (Any?) -> Void, _ reject: @escaping (String, String, Error?) -> Void, _ body: @escaping () async throws -> Any?) {
        Task {
            do {
                let value = try await body()
                DispatchQueue.main.async { resolve(value) }
            } catch let error as HSApiError {
                DispatchQueue.main.async { reject(error.code, error.message, error) }
            } catch let error as HSError {
                let code: String
                switch error {
                case .invalidArgument: code = "INVALID_ARGUMENT"
                case .invalidResponse: code = "HS_ERROR"
                default: code = "NOT_READY"
                }
                DispatchQueue.main.async { reject(code, "\(error)", error) }
            } catch {
                DispatchQueue.main.async { reject("HS_ERROR", error.localizedDescription, error) }
            }
        }
    }

    // MARK: - Hata ayıklama

    @objc public func setLogLevel(_ level: String) { HeroSignal.Debug.setLogLevel(Self.logLevel(level)) }

    // MARK: - APNs token (AppDelegate'ten; bkz. HeroSignalRNPush.h)

    @objc public static func didRegisterForRemoteNotifications(deviceToken: Data) { HeroSignal.setDeviceToken(deviceToken) }
    @objc public static func didFailToRegisterForRemoteNotifications(error: Error) { HeroSignal.setDeviceTokenError(error) }

    // MARK: - Yardımcılar

    private func onMain(_ block: @escaping () -> Void) {
        if Thread.isMainThread { block() } else { DispatchQueue.main.async(execute: block) }
    }

    private static func granted(_ status: UNAuthorizationStatus) -> Bool { status == .authorized || status == .provisional || status == .ephemeral }

    private static func stringMap(_ dict: [String: Any]) -> [String: String] {
        var out: [String: String] = [:]
        for (key, value) in dict { if let s = value as? String { out[key] = s } }
        return out
    }

    private static func logLevel(_ name: String?) -> HSLog.Level {
        switch name {
        case "none": return HSLog.Level.none
        case "error": return .error
        case "info": return .info
        case "debug": return .debug
        default: return .warn
        }
    }

    private static func millis(_ date: Date?) -> Any { date.map { NSNumber(value: Int64($0.timeIntervalSince1970 * 1000)) } ?? NSNull() }

    private static func map(_ n: HSNotification) -> [String: Any] {
        ["title": n.title ?? NSNull(), "body": n.body ?? NSNull(), "url": n.url ?? NSNull(), "imageUrl": n.imageUrl ?? NSNull(),
         "deliveryId": n.deliveryId ?? NSNull(), "messageId": n.messageId ?? NSNull(), "data": n.data]
    }

    private static func map(_ s: HSPushSubscriptionState) -> [String: Any] {
        ["id": s.id ?? NSNull(), "token": s.token ?? NSNull(), "optedIn": s.optedIn, "permission": granted(s.permission)]
    }

    private static func map(_ item: HSInboxItem) -> [String: Any] {
        ["id": item.id, "messageId": item.messageId ?? NSNull(), "title": item.title ?? NSNull(), "body": item.body ?? NSNull(),
         "url": item.url ?? NSNull(), "imageUrl": item.imageUrl ?? NSNull(), "data": item.data, "read": item.read,
         "readAt": millis(item.readAt), "archivedAt": millis(item.archivedAt), "expiresAt": millis(item.expiresAt), "createdAt": millis(item.createdAt)]
    }

    private static func map(_ page: HSInboxPage) -> [String: Any] {
        ["items": page.items.map { map($0) }, "unreadCount": page.unreadCount, "nextCursor": page.nextCursor ?? NSNull(), "hasMore": page.hasMore]
    }

    private static func map(_ p: HSPreference) -> [String: Any] {
        ["category": p.category, "channel": p.channel ?? NSNull(), "optedIn": p.optedIn, "explicit": p.explicit,
         "source": p.source ?? NSNull(), "updatedAt": millis(p.updatedAt)]
    }

    private static func map(_ c: HSMessageCategory) -> [String: Any] {
        ["key": c.key, "name": c.name, "description": c.description, "channels": c.channels ?? NSNull(), "defaultOptedIn": c.defaultOptedIn]
    }

    private static func map(_ r: HSPreferencesResult) -> [String: Any] {
        ["preferences": r.preferences.map { map($0) }, "categories": r.categories.map { map($0) }]
    }
}
