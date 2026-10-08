import Foundation
import UserNotifications
// CocoaPods: `pod 'HeroSignal/Extension'` tek "HeroSignal" modülü üretir; SPM'de ayrı "HeroSignalExtension" modülüdür.
#if canImport(HeroSignalExtension)
import HeroSignalExtension
#else
import HeroSignal
#endif

/**
 HeroSignal Notification Service Extension (Expo config plugin tarafından üretildi).
 Zengin medyayı indirir, rozet artışını App Group'taki sayaçla uygular ve `received` (confirmed delivery) bildirir.
 App ID / API adresi önce bu hedefin Info.plist'inden (`HeroSignalAppId`, `HeroSignalApiUrl`), yoksa uygulamanın
 çalışma zamanında App Group'a yazdığı değerlerden okunur.
 */
final class NotificationService: UNNotificationServiceExtension {
    private static let defaultApiUrl = "https://api.herosignal.dev"
    private var helper: HeroSignalNotificationServiceExtension?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        guard let configuration = Self.configuration() else {
            // Uygulama henüz hiç başlatılmadı ve Info.plist'te App ID yok: içerik değiştirilmeden gösterilir.
            contentHandler(request.content)
            return
        }
        let helper = HeroSignalNotificationServiceExtension(appId: configuration.appId, apiUrl: configuration.apiUrl, appGroup: configuration.appGroup)
        self.helper = helper
        helper.didReceive(request, withContentHandler: contentHandler)
    }

    override func serviceExtensionTimeWillExpire() {
        helper?.serviceExtensionTimeWillExpire()
    }

    private static func configuration() -> (appId: String, apiUrl: String, appGroup: String?)? {
        let info = Bundle.main
        let appGroup = info.object(forInfoDictionaryKey: "HeroSignalAppGroup") as? String
        let shared = appGroup.flatMap { UserDefaults(suiteName: $0) }
        let appId = nonEmpty(info.object(forInfoDictionaryKey: "HeroSignalAppId") as? String)
            ?? nonEmpty(shared?.string(forKey: "HeroSignalAppId"))
        guard let appId else { return nil }
        let apiUrl = nonEmpty(info.object(forInfoDictionaryKey: "HeroSignalApiUrl") as? String)
            ?? nonEmpty(shared?.string(forKey: "HeroSignalApiUrl"))
            ?? defaultApiUrl
        return (appId, apiUrl, appGroup)
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }
}
