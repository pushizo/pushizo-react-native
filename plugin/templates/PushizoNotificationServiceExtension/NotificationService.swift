import UserNotifications
// CocoaPods: 'Pushizo/Extension' alt spec'i "Pushizo" modülünde; SPM: "PushizoExtension" ürünü.
#if canImport(PushizoExtension)
import PushizoExtension
#else
import Pushizo
#endif

/// Pushizo Notification Service Extension (@pushizo/react-native Expo config plugin tarafından eklendi).
/// Zengin medya, aksiyon düğmeleri, rozet artışı ve confirmed delivery (`received`) yerel SDK yardımcısıyla yapılır.
/// Yapılandırma bu hedefin Info.plist'indedir: PushizoAppId, PushizoApiUrl, PushizoAppGroup.
class NotificationService: UNNotificationServiceExtension {
    private lazy var pushizo: PushizoNotificationServiceExtension? = {
        let info = Bundle.main
        guard let appId = info.object(forInfoDictionaryKey: "PushizoAppId") as? String, !appId.isEmpty else { return nil }
        let apiUrl = (info.object(forInfoDictionaryKey: "PushizoApiUrl") as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? "https://api.pushizo.com"
        let appGroup = (info.object(forInfoDictionaryKey: "PushizoAppGroup") as? String).flatMap { $0.isEmpty ? nil : $0 }
        return PushizoNotificationServiceExtension(appId: appId, apiUrl: apiUrl, appGroup: appGroup)
    }()

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        guard let pushizo else {
            contentHandler(request.content)
            return
        }
        pushizo.didReceive(request, withContentHandler: contentHandler)
    }

    override func serviceExtensionTimeWillExpire() {
        pushizo?.serviceExtensionTimeWillExpire()
    }
}
