import Foundation
import UIKit
import UserNotifications
import HeroSignal
// SPM: ayrı modül; CocoaPods alt spec'leri tek "HeroSignal" modülünde derlenir.
#if canImport(HeroSignalCore)
import HeroSignalCore
#endif

/**
 React Native → HeroSignal iOS SDK köprüsünün Swift tarafı. ObjC++ modül (`HeroSignalRN`) yöntemleri buraya iletir;
 React başlıklarına bağımlı değildir (Promise yerine blok kullanır). SDK dinleyicileri süreç boyunca bir kez eklenir,
 olaylar etkin JS örneğine (`attach`) iletilir; JS yeniden yüklenince (`detach`) eski örnek bırakılır.
 Tüm yöntemler ana iş parçacığında çağrılır (`HeroSignalRN.methodQueue`).
 */
@objc(HeroSignalRNImpl)
public final class HeroSignalRNImpl: NSObject {
    public typealias Emitter = (String, [String: Any]) -> Void
    public typealias Resolve = (Any?) -> Void
    public typealias Reject = (String, String) -> Void

    @objc public static let shared = HeroSignalRNImpl()

    @objc public static let eventClick = "HeroSignal.notificationClick"
    @objc public static let eventWillDisplay = "HeroSignal.notificationWillDisplay"
    @objc public static let eventSubscription = "HeroSignal.pushSubscriptionChange"
    @objc public static let eventInAppClick = "HeroSignal.inAppClick"
    @objc public static let eventInAppLifecycle = "HeroSignal.inAppLifecycle"

    /// JS ön plan dinleyicisi bu sürede yanıt vermezse bildirim gösterilir.
    private static let jsResponseTimeout: TimeInterval = 5
    private static let maxPendingClicks = 10

    /// Uygulama açılış seçenekleri (`HeroSignalAppDelegateProxy` yakalar); bildirimden soğuk açılış için.
    @objc public static var launchOptions: [AnyHashable: Any]?

    private var emitter: Emitter?
    private var listenersRegistered = false
    private var consentRequired = false
    private var foregroundHandlerEnabled = false
    private var clickListenerReady = false
    private var pendingClicks: [[String: Any]] = []
    private var foregroundEvents: [String: ForegroundEntry] = [:]
    private let lifecycleForwarder = LifecycleForwarder()

    private final class ForegroundEntry {
        let event: HSForegroundEvent
        var answered = false
        init(event: HSForegroundEvent) { self.event = event }
    }

    /// In-app yaşam döngüsü olaylarını köprüye iletir (SDK zayıf olmayan bir referans tutar).
    private final class LifecycleForwarder: HSInAppLifecycleListener {
        var send: ((String, HSInAppMessage) -> Void)?
        func onWillDisplay(_ message: HSInAppMessage) { send?("willDisplay", message) }
        func onDidDisplay(_ message: HSInAppMessage) { send?("didDisplay", message) }
        func onWillDismiss(_ message: HSInAppMessage) { send?("willDismiss", message) }
        func onDidDismiss(_ message: HSInAppMessage) { send?("didDismiss", message) }
    }

    // MARK: - JS örneği

    @objc(attachEmitter:)
    public func attach(_ emitter: @escaping (String, [String: Any]) -> Void) {
        self.emitter = emitter
    }

    /// JS örneği kapandı: bekleyen ön plan kararları JS olmadan verilemez, bildirimler gösterilir.
    @objc public func detach() {
        emitter = nil
        clickListenerReady = false
        foregroundHandlerEnabled = false
        foregroundEvents.values.filter { !$0.answered }.forEach { $0.event.display() }
        foregroundEvents.removeAll()
    }

    /// JS tıklama dinleyicisi eklendi; soğuk açılışta bekleyen tıklamalar iletilir.
    @objc public func markClickListenerReady() {
        clickListenerReady = true
        let pending = pendingClicks
        pendingClicks.removeAll()
        pending.forEach { emit(Self.eventClick, $0) }
    }

    private func emit(_ name: String, _ body: [String: Any]) {
        if Thread.isMainThread {
            emitter?(name, body)
        } else {
            DispatchQueue.main.async { [weak self] in self?.emitter?(name, body) }
        }
    }

    // MARK: - Başlatma ve gizlilik

    @objc(initializeWithAppId:options:)
    public func initialize(appId: String, options: [String: Any]) {
        if !HeroSignal.isInitialized {
            let infoAppGroup = Bundle.main.object(forInfoDictionaryKey: "HeroSignalAppGroup") as? String
            let launch = Self.launchOptions as? [UIApplication.LaunchOptionsKey: Any]
            HeroSignal.initialize(appId, launchOptions: launch) { [consentRequired] opts in
                if let apiUrl = options["apiUrl"] as? String, !apiUrl.isEmpty { opts.apiUrl = apiUrl }
                opts.requiresPrivacyConsent = options["requiresPrivacyConsent"] as? Bool ?? consentRequired
                opts.logLevel = Self.logLevel(options["logLevel"] as? String)
                opts.provisionalAuthorization = options["provisionalAuthorization"] as? Bool ?? false
                opts.appGroup = (options["appGroup"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? infoAppGroup
                if let env = options["apnsEnvironment"] as? String, !env.isEmpty { opts.apnsEnvironment = env }
            }
            Self.launchOptions = nil
            Self.shareConfiguration(appId: appId, options: options, infoAppGroup: infoAppGroup)
        }
        registerListeners()
    }

    /// Notification Service Extension (Expo config plugin şablonu) App ID ve API adresini App Group'tan okur.
    private static func shareConfiguration(appId: String, options: [String: Any], infoAppGroup: String?) {
        let group = (options["appGroup"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? infoAppGroup
        guard let group, let defaults = UserDefaults(suiteName: group) else { return }
        let apiUrl = (options["apiUrl"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? HSOptions().apiUrl
        defaults.set(appId, forKey: "HeroSignalAppId")
        defaults.set(apiUrl, forKey: "HeroSignalApiUrl")
    }

    private func registerListeners() {
        // iOS SDK dinleyici kaldırma sunmaz; süreç boyunca bir kez eklenir ve etkin JS örneğine yönlendirilir.
        guard !listenersRegistered else { return }
        listenersRegistered = true
        HeroSignal.Notifications.addClickListener { [weak self] e in
            DispatchQueue.main.async { self?.handleClick(e) }
        }
        HeroSignal.Notifications.addForegroundLifecycleListener { [weak self] e in
            guard let self, self.foregroundHandlerEnabled, self.emitter != nil else { return }
            // Karar JS dinleyicilerine bırakılır; yanıt gelmezse süre sonunda gösterilir.
            e.preventDefault()
            DispatchQueue.main.async { self.deferForeground(e) }
        }
        HeroSignal.User.pushSubscription.addObserver { [weak self] s in
            self?.emit(Self.eventSubscription, Self.map(s))
        }
        HeroSignal.InAppMessages.addClickListener { [weak self] e in
            self?.emit(Self.eventInAppClick, ["messageId": e.messageId, "actionId": e.actionId, "url": e.url as Any])
        }
        lifecycleForwarder.send = { [weak self] event, message in
            self?.emit(Self.eventInAppLifecycle, ["event": event, "messageId": message.id])
        }
        HeroSignal.InAppMessages.addLifecycleListener(lifecycleForwarder)
    }

    private func handleClick(_ e: HSClickEvent) {
        let payload: [String: Any] = ["notification": Self.map(e.notification), "actionId": e.actionId as Any, "url": e.url as Any]
        if clickListenerReady && emitter != nil {
            emit(Self.eventClick, payload)
        } else {
            if pendingClicks.count >= Self.maxPendingClicks { pendingClicks.removeFirst() }
            pendingClicks.append(payload)
        }
    }

    private func deferForeground(_ e: HSForegroundEvent) {
        guard emitter != nil else { e.display(); return }
        let id = UUID().uuidString
        let entry = ForegroundEntry(event: e)
        foregroundEvents[id] = entry
        emit(Self.eventWillDisplay, ["eventId": id, "notification": Self.map(e.notification)])
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.jsResponseTimeout) { [weak self] in
            guard let self, !entry.answered, self.foregroundEvents.removeValue(forKey: id) != nil else { return }
            e.display()
        }
        // SDK, preventDefault sonrası 25 sn içinde display() gelmezse bildirimi kapatır; kayıt da o sürede silinir.
        DispatchQueue.main.asyncAfter(deadline: .now() + HSForegroundEvent.displayTimeout) { [weak self] in
            self?.foregroundEvents.removeValue(forKey: id)
        }
    }

    @objc public func setConsentRequired(_ required: Bool) {
        if HeroSignal.isInitialized && required != consentRequired && HSLog.level.rawValue >= HSLog.Level.warn.rawValue {
            print("[HeroSignal] setConsentRequired initialize'dan önce çağrılmalı; değişiklik bir sonraki başlatmada geçerli olur")
        }
        consentRequired = required
    }

    @objc public func setConsentGiven(_ given: Bool) { HeroSignal.setConsentGiven(given) }

    @objc(loginWithExternalId:identityHash:)
    public func login(externalId: String, identityHash: String?) {
        HeroSignal.login(externalId, identityHash: identityHash)
    }

    @objc public func logout() { HeroSignal.logout() }

    // MARK: - Kullanıcı

    @objc public func addTags(_ tags: [String: Any]) { HeroSignal.User.addTags(Self.stringMap(tags)) }
    @objc public func removeTags(_ keys: [String]) { HeroSignal.User.removeTags(keys) }
    @objc(getTagsWithResolve:)
    public func getTags(resolve: @escaping (Any?) -> Void) { resolve(HeroSignal.User.getTags()) }
    @objc public func addAliases(_ aliases: [String: Any]) { HeroSignal.User.addAliases(Self.stringMap(aliases)) }
    @objc public func removeAlias(_ label: String) { HeroSignal.User.removeAlias(label) }
    @objc public func setLanguage(_ code: String) { HeroSignal.User.setLanguage(code) }

    @objc(addEmail:resolve:reject:)
    public func addEmail(_ email: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String) -> Void) {
        guard HSContacts.normalizeEmail(email) != nil else { reject("INVALID_ARGUMENT", "Geçersiz e-posta adresi."); return }
        HeroSignal.User.addEmail(email)
        resolve(nil)
    }

    @objc(removeEmail:resolve:reject:)
    public func removeEmail(_ email: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String) -> Void) {
        guard HSContacts.normalizeEmail(email) != nil else { reject("INVALID_ARGUMENT", "Geçersiz e-posta adresi."); return }
        HeroSignal.User.removeEmail(email)
        resolve(nil)
    }

    @objc(addSms:resolve:reject:)
    public func addSms(_ phoneNumber: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String) -> Void) {
        guard HSContacts.normalizePhone(phoneNumber) != nil else { reject("INVALID_ARGUMENT", "Geçersiz telefon numarası (E.164 bekleniyor, ör. +905321234567)."); return }
        HeroSignal.User.addSms(phoneNumber)
        resolve(nil)
    }

    @objc(removeSms:resolve:reject:)
    public func removeSms(_ phoneNumber: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String) -> Void) {
        guard HSContacts.normalizePhone(phoneNumber) != nil else { reject("INVALID_ARGUMENT", "Geçersiz telefon numarası (E.164 bekleniyor, ör. +905321234567)."); return }
        HeroSignal.User.removeSms(phoneNumber)
        resolve(nil)
    }

    @objc(getExternalIdWithResolve:)
    public func getExternalId(resolve: @escaping (Any?) -> Void) { resolve(HeroSignal.User.externalId) }

    @objc(getUserIdWithResolve:)
    public func getUserId(resolve: @escaping (Any?) -> Void) { resolve(HeroSignal.User.id) }

    // MARK: - Push aboneliği

    @objc(getPushSubscriptionStateWithResolve:)
    public func getPushSubscriptionState(resolve: @escaping (Any?) -> Void) {
        Task {
            let state = await HeroSignal.User.pushSubscription.state()
            await MainActor.run { resolve(Self.map(state)) }
        }
    }

    @objc public func optIn() { HeroSignal.User.pushSubscription.optIn() }
    @objc public func optOut() { HeroSignal.User.pushSubscription.optOut() }

    // MARK: - Bildirimler

    @objc(requestPermissionWithResolve:)
    public func requestPermission(resolve: @escaping (Any?) -> Void) {
        HeroSignal.Notifications.requestPermission { granted in
            DispatchQueue.main.async { resolve(granted) }
        }
    }

    @objc(getPermissionWithResolve:)
    public func getPermission(resolve: @escaping (Any?) -> Void) {
        Task {
            let status = await HeroSignal.Notifications.permission()
            await MainActor.run { resolve(status == .authorized || status == .provisional || status == .ephemeral) }
        }
    }

    @objc public func setForegroundHandlerEnabled(_ enabled: Bool) { foregroundHandlerEnabled = enabled }

    @objc(completeForegroundDisplay:display:)
    public func completeForegroundDisplay(_ eventId: String, display: Bool) {
        guard let entry = foregroundEvents[eventId] else { return }
        entry.answered = true
        if display {
            foregroundEvents.removeValue(forKey: eventId)
            entry.event.display()
        }
    }

    @objc public func displayNotification(_ eventId: String) {
        guard let entry = foregroundEvents.removeValue(forKey: eventId) else { return }
        entry.answered = true
        entry.event.display()
    }

    @objc public func clearAll() { HeroSignal.Notifications.clearAll() }
    @objc public func removeNotification(_ id: String) { HeroSignal.Notifications.removeNotification(id: id) }
    @objc public func removeGroupedNotifications(_ group: String) { HeroSignal.Notifications.removeGroupedNotifications(group: group) }

    // MARK: - Oturum

    @objc(sendEvent:properties:value:hasValue:)
    public func sendEvent(_ name: String, properties: [String: Any], value: Double, hasValue: Bool) {
        HeroSignal.Session.sendEvent(name, properties: properties, value: hasValue ? value : nil)
    }

    // MARK: - In-app

    @objc public func addTriggers(_ triggers: [String: Any]) { HeroSignal.InAppMessages.addTriggers(Self.stringMap(triggers)) }
    @objc public func removeTriggers(_ keys: [String]) { HeroSignal.InAppMessages.removeTriggers(keys) }
    @objc public func clearTriggers() { HeroSignal.InAppMessages.clearTriggers() }
    @objc(getTriggersWithResolve:)
    public func getTriggers(resolve: @escaping (Any?) -> Void) { resolve(HeroSignal.InAppMessages.getTriggers()) }
    @objc public func setScreen(_ name: String?) { HeroSignal.InAppMessages.setScreen(name) }
    @objc public func setInAppPaused(_ paused: Bool) { HeroSignal.InAppMessages.paused = paused }
    @objc(getInAppPausedWithResolve:)
    public func getInAppPaused(resolve: @escaping (Any?) -> Void) { resolve(HeroSignal.InAppMessages.paused) }

    // MARK: - Bildirim kutusu

    @objc(inboxList:cursor:resolve:reject:)
    public func inboxList(_ limit: Int, cursor: String?, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String) -> Void) {
        inbox(resolve, reject) { try await Self.map(HeroSignal.Inbox.list(limit: limit, cursor: cursor)) }
    }

    @objc(inboxMarkRead:resolve:reject:)
    public func inboxMarkRead(_ id: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String) -> Void) {
        inbox(resolve, reject) { try await Self.map(HeroSignal.Inbox.markRead(id)) }
    }

    @objc(inboxMarkAllReadWithResolve:reject:)
    public func inboxMarkAllRead(resolve: @escaping (Any?) -> Void, reject: @escaping (String, String) -> Void) {
        inbox(resolve, reject) { try await HeroSignal.Inbox.markAllRead() }
    }

    @objc(inboxArchive:resolve:reject:)
    public func inboxArchive(_ id: String, resolve: @escaping (Any?) -> Void, reject: @escaping (String, String) -> Void) {
        inbox(resolve, reject) {
            try await HeroSignal.Inbox.archive(id)
            return nil
        }
    }

    @objc(inboxUnreadCountWithResolve:reject:)
    public func inboxUnreadCount(resolve: @escaping (Any?) -> Void, reject: @escaping (String, String) -> Void) {
        inbox(resolve, reject) { try await HeroSignal.Inbox.unreadCount() }
    }

    /// Bildirim kutusu çağrısı: sonuç ana iş parçacığında döner; hata kodu `HSApiError.code`, diğerleri `NOT_READY`.
    private func inbox(_ resolve: @escaping (Any?) -> Void, _ reject: @escaping (String, String) -> Void, _ body: @escaping () async throws -> Any?) {
        Task {
            do {
                let value = try await body()
                await MainActor.run { resolve(value) }
            } catch let error as HSApiError {
                await MainActor.run { reject(error.code, error.message) }
            } catch {
                await MainActor.run { reject("NOT_READY", "\(error)") }
            }
        }
    }

    // MARK: - Hata ayıklama

    @objc public func setLogLevel(_ level: String) { HeroSignal.Debug.setLogLevel(Self.logLevel(level)) }

    // MARK: - APNs token (HeroSignalAppDelegateProxy çağırır)

    @objc public static func setDeviceToken(_ deviceToken: Data) { HeroSignal.setDeviceToken(deviceToken) }
    @objc public static func setDeviceTokenError(_ error: Error) { HeroSignal.setDeviceTokenError(error) }

    // MARK: - Eşleme

    /// JS katmanı değerleri metne çevirir; yine de sayı/boolean gelirse metne çevrilir.
    private static func stringMap(_ values: [String: Any]) -> [String: String] {
        var out: [String: String] = [:]
        for (key, value) in values {
            if let s = value as? String { out[key] = s }
            else if let n = value as? NSNumber { out[key] = n.stringValue }
        }
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

    private static func millis(_ date: Date?) -> Any { date.map { Double(Int64($0.timeIntervalSince1970 * 1000)) } as Any }

    private static func map(_ n: HSNotification) -> [String: Any] {
        [
            "title": n.title as Any, "body": n.body as Any, "url": n.url as Any, "imageUrl": n.imageUrl as Any,
            "deliveryId": n.deliveryId as Any, "messageId": n.messageId as Any,
            // iOS'ta gruplama `aps.thread-id` ile yapılır; payload modelinde yer almadığı için null döner.
            "groupKey": NSNull(), "androidNotificationId": NSNull(),
            "actions": n.actions.map { ["id": $0.id, "title": $0.title, "url": $0.url as Any] },
            "data": n.data,
        ]
    }

    private static func map(_ s: HSPushSubscriptionState) -> [String: Any] {
        ["id": s.id as Any, "token": s.token as Any, "optedIn": s.optedIn,
         "permission": s.permission == .authorized || s.permission == .provisional || s.permission == .ephemeral]
    }

    private static func map(_ item: HSInboxItem) -> [String: Any] {
        ["id": item.id, "messageId": item.messageId as Any, "title": item.title as Any, "body": item.body as Any,
         "url": item.url as Any, "imageUrl": item.imageUrl as Any, "data": item.data, "read": item.read,
         "readAt": millis(item.readAt), "archivedAt": millis(item.archivedAt), "expiresAt": millis(item.expiresAt), "createdAt": millis(item.createdAt)]
    }

    private static func map(_ page: HSInboxPage) -> [String: Any] {
        ["items": page.items.map { map($0) }, "unreadCount": page.unreadCount, "nextCursor": page.nextCursor as Any, "hasMore": page.hasMore]
    }
}
