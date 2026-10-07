import UserNotifications
// CocoaPods: 'HeroSignal/Extension' alt spec'i "HeroSignal" modülünde; SPM: "HeroSignalExtension" ürünü.
#if canImport(HeroSignalExtension)
import HeroSignalExtension
#else
import HeroSignal
#endif

/// HeroSignal Notification Service Extension (@herosignal/react-native Expo config plugin tarafından eklendi).
/// Zengin medya, aksiyon düğmeleri, rozet artışı ve confirmed delivery (`received`) yerel SDK yardımcısıyla yapılır.
/// Yapılandırma bu hedefin Info.plist'indedir: HeroSignalAppId, HeroSignalApiUrl, HeroSignalAppGroup.
class NotificationService: UNNotificationServiceExtension {
    private lazy var heroSignal: HeroSignalNotificationServiceExtension? = {
        let info = Bundle.main
        guard let appId = info.object(forInfoDictionaryKey: "HeroSignalAppId") as? String, !appId.isEmpty else { return nil }
        let apiUrl = (info.object(forInfoDictionaryKey: "HeroSignalApiUrl") as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? "https://api.herosignal.dev"
        let appGroup = (info.object(forInfoDictionaryKey: "HeroSignalAppGroup") as? String).flatMap { $0.isEmpty ? nil : $0 }
        return HeroSignalNotificationServiceExtension(appId: appId, apiUrl: apiUrl, appGroup: appGroup)
    }()

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        guard let heroSignal else {
            contentHandler(request.content)
            return
        }
        heroSignal.didReceive(request, withContentHandler: contentHandler)
    }

    override func serviceExtensionTimeWillExpire() {
        heroSignal?.serviceExtensionTimeWillExpire()
    }
}
