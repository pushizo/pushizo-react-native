# @herosignal/react-native

HeroSignal React Native SDK'sı: Android (`com.herosignal.sdk`) ve iOS (`HeroSignal`) yerel SDK'larını saran köprü ve
Expo config plugin. Push aboneliği, kullanıcı/tag/alias, e-posta/SMS, in-app mesajlar, bildirim kutusu ve olaylar.
Yüzey plan 06 §6.1 ile ve eski sağlayıcı v5 React Native API'si ile uyumludur; kuyruk, oturum, teslimat geri bildirimi
(received/opened) ve in-app çizimi yerel SDK'dadır.

- React Native ≥ 0.74; **New Architecture** (TurboModule, codegen `RNHeroSignalSpec`) ve eski mimari desteklenir.
- Android minSdk 24, iOS 15.0+.
- Expo: development build (`expo prebuild` / EAS Build). Expo Go yerel modül içermediği için desteklenmez.

## Kurulum

```sh
npm install @herosignal/react-native
```

### Bare React Native

**Android**

1. Firebase konsolundan Android uygulaması ekleyip `google-services.json` dosyasını `android/app/` içine koyun.
2. `android/build.gradle` → `buildscript.dependencies` içine `classpath("com.google.gms:google-services:4.4.2")`,
   `android/app/build.gradle` içine `apply plugin: "com.google.gms.google-services"` ekleyin.
3. HeroSignal paneli → Kanallar → Android: FCM v1 servis hesabı JSON'unu yükleyin.
4. `POST_NOTIFICATIONS` izni ve FCM servisi yerel SDK manifestinden otomatik birleşir.
5. (İsteğe bağlı) Varsayılan bildirim ikonu: `AndroidManifest.xml` → `<application>` içine
   `<meta-data android:name="com.herosignal.sdk.default_notification_icon" android:resource="@drawable/ic_notification" />`.

Monorepo / yerel geliştirmede SDK kaynaktan bağlanabilir (`android/settings.gradle`):

```groovy
include ':herosignal'
project(':herosignal').projectDir = new File(rootProject.projectDir, '../../../sdk/android/herosignal')
```

Bu modül yoksa köprü `com.herosignal:herosignal-android` artefaktını kullanır (Maven Central ya da `publishToMavenLocal`).

**iOS**

1. `ios/Podfile` (yalnızca yerel geliştirmede; yayınlanmış pod CocoaPods trunk'tan gelir):
   `pod 'HeroSignal', :path => '<repo>/sdk/ios'` → `cd ios && pod install`.
2. Xcode → hedef → Signing & Capabilities: **Push Notifications**, **Background Modes → Remote notifications** ve
   (rozet/NSE paylaşımı için) **App Groups** (`group.<bundle id>.herosignal`) ekleyin.
3. APNs token'ını iletin (SDK swizzling kullanmaz). Swift `AppDelegate`:

   ```swift
   import HeroSignal

   func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
     HeroSignal.setDeviceToken(deviceToken)
   }

   func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
     HeroSignal.setDeviceTokenError(error)
   }
   ```

   Objective-C `AppDelegate.mm`: `#import <HeroSignalReactNative/HeroSignalRNPush.h>` ve ilgili metotlarda
   `[HeroSignalRNPush didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];` /
   `[HeroSignalRNPush didFailToRegisterForRemoteNotificationsWithError:error];`.
4. HeroSignal paneli → Kanallar → iOS: APNs `.p8` anahtarını, Key ID ve Team ID ile yükleyin.

### Expo

`app.json`:

```json
{
  "expo": {
    "ios": { "bundleIdentifier": "com.example.app" },
    "android": { "package": "com.example.app", "googleServicesFile": "./google-services.json" },
    "plugins": [
      [
        "@herosignal/react-native",
        {
          "mode": "development",
          "appId": "app_…",
          "androidSmallIcon": "./assets/notification-icon.png",
          "androidAccentColor": "#FF5A1F"
        }
      ]
    ]
  }
}
```

Ardından `npx expo prebuild` (veya EAS Build). Plugin şunları yapar:

| Platform | Değişiklik |
|----------|------------|
| iOS | `aps-environment` (`mode`: `development` / `production`), Background Modes → `remote-notification`, App Group (`iosAppGroup`, varsayılan `group.<bundle id>.herosignal`), AppDelegate'e APNs token iletimi, Info.plist `HeroSignalAppId` / `HeroSignalApiUrl` / `HeroSignalAppGroup` |
| iOS | `HeroSignalNotificationServiceExtension` hedefi (dosyalar `plugin/templates`), Podfile'a `HeroSignal/Extension` |
| Android | `POST_NOTIFICATIONS`, küçük ikon (PNG'den tüm yoğunluklar), vurgu rengi, erken başlatma meta-data'sı; `android.googleServicesFile` yoksa uyarı |

| Seçenek | Tip | Açıklama |
|---------|-----|----------|
| `mode` | `development` \| `production` | **Zorunlu.** APNs ortamı. TestFlight/App Store için `production`. |
| `appId` | string | Erken başlatma ve NSE için. NSE açıkken zorunlu. |
| `apiUrl` | string | Kendi barındırma API adresi. |
| `requiresPrivacyConsent` | boolean | Erken başlatmada onay bekle (JS `initialize` ile aynı olmalı). |
| `logLevel` | `none`…`debug` | Erken başlatma günlük seviyesi. |
| `iosAppGroup` | string | `group.` ile başlayan App Group. |
| `iosNotificationServiceExtension` | boolean | NSE hedefi (varsayılan `true`). |
| `iosDeploymentTarget` | string | NSE dağıtım hedefi (varsayılan `15.0`). |
| `devTeam` | string | Apple Team ID (NSE imzalama). |
| `iosSdkPath` / `androidSdkPath` | string | Monorepo: yerel SDK'ları kaynaktan bağlar. |
| `androidSmallIcon` | string | PNG (beyaz şekil, saydam arka plan). |
| `androidAccentColor` | `#RRGGBB` | Bildirim vurgu rengi. |

Geçersiz seçenekler `prebuild` sırasında hangi alanın nasıl düzeltileceğini söyleyen hatayla durur.

## Kullanım

```ts
import { HeroSignal, LogLevel } from '@herosignal/react-native';

await HeroSignal.initialize('app_…', { apiUrl: 'https://api.example.com', logLevel: LogLevel.Warn });
await HeroSignal.Notifications.requestPermission();

await HeroSignal.login('user_42', identityHashFromBackend); // identity verification açıksa hash zorunlu
await HeroSignal.User.addTags({ plan: 'pro', city: 'istanbul' });
await HeroSignal.User.addAlias('crm_id', '1001');
await HeroSignal.User.addEmail('ali@example.com');      // geçersizse INVALID_ARGUMENT
await HeroSignal.User.addSms('+90 532 123 45 67');      // E.164'e normalize edilir
await HeroSignal.User.setLanguage('tr');

HeroSignal.Notifications.addEventListener('click', (e) => {
  console.log(e.notification.title, e.result.actionId, e.result.url);
});
HeroSignal.Notifications.addEventListener('foregroundWillDisplay', (e) => {
  if (e.getNotification().data.silent === '1') e.preventDefault(); // ön planda gösterme
  // asenkron karar: e.preventDefault(); sonra (≤25 sn) e.getNotification().display();
});
HeroSignal.Notifications.addEventListener('permissionChange', ({ permission }) => {});
HeroSignal.User.pushSubscription.addEventListener('change', ({ previous, current }) => {});

await HeroSignal.InAppMessages.addTrigger('level', 'gold');
HeroSignal.InAppMessages.setScreen('cart');
HeroSignal.InAppMessages.addEventListener('click', ({ messageId, actionId, url }) => {});
HeroSignal.InAppMessages.addEventListener('didDisplay', ({ messageId }) => {});

const page = await HeroSignal.Inbox.list({ limit: 20 });
await HeroSignal.Inbox.markRead(page.items[0].id);
await HeroSignal.Inbox.markAllRead();
await HeroSignal.Inbox.archive(page.items[0].id);

HeroSignal.Session.sendEvent('purchase', { sku: 'A1' }, 49.9);
HeroSignal.Notifications.clearAll();
HeroSignal.Debug.setLogLevel(LogLevel.Debug);
HeroSignal.logout();
```

### Gizlilik (KVKK/GDPR)

`initialize(appId, { requiresPrivacyConsent: true })` ile başlatıldığında `HeroSignal.setConsentGiven(true)` çağrılana
kadar hiçbir ağ çağrısı yapılmaz. `setConsentGiven(false)` kuyruğu ve yerel kimliği temizler.

### Erken başlatma ve soğuk açılış

Bildirime dokunularak açılan uygulamada tıklama, JS'te `click` dinleyicisi eklenene kadar yerelde bekletilir. SDK'nın
JS yüklenmeden başlaması için (oturum başlangıcı, in-app Activity takibi, iOS bildirim merkezi temsilcisi):

- **Android:** `AndroidManifest.xml` → `<application>` içine
  `com.herosignal.reactnative.app_id` (ve isteğe bağlı `com.herosignal.reactnative.api_url`,
  `com.herosignal.reactnative.requires_privacy_consent`, `com.herosignal.reactnative.log_level`) meta-data'sı.
- **iOS:** `Info.plist` → `HeroSignalAppId` (ve isteğe bağlı `HeroSignalApiUrl`).

Expo plugin'i `appId` verildiğinde bunları ekler. JS `initialize` yine çağrılmalıdır; aynı appId ile ikinci çağrı yerel
SDK'yı yeniden kurmaz.

### Hata kodları

Promise reddi `code` alanı: `INVALID_ARGUMENT` (geçersiz e-posta/telefon/alias/trigger), `NOT_READY`
(`initialize` çağrılmadı veya abonelik henüz kayıtlı değil), `NO_ACTIVITY` (Android'de izin isteği için ön planda
Activity yok), sunucu hata kodları (`HSApiError.code` / `HsApiException.code`) ve `HS_ERROR`.

## iOS Notification Service Extension (NSE)

NSE; zengin medya (resim), aksiyon düğmeleri, rozet artışı (`badge_inc`) ve confirmed delivery (`received`) için gerekir.

- **Expo:** plugin otomatik ekler (`iosNotificationServiceExtension: false` ile kapatılır).
- **Bare RN:** Xcode → File → New → Target → *Notification Service Extension* (`HeroSignalNotificationServiceExtension`).
  `plugin/templates/HeroSignalNotificationServiceExtension/NotificationService.swift` dosyasını hedefe kopyalayın;
  hedefin Info.plist'ine `HeroSignalAppId`, (isteğe bağlı) `HeroSignalApiUrl` ve `HeroSignalAppGroup` ekleyin; hedefe
  aynı App Group yetkisini verin. Podfile:

  ```ruby
  target 'HeroSignalNotificationServiceExtension' do
    pod 'HeroSignal/Extension', '~> 0.1'   # yerel geliştirme: :path => '<repo>/sdk/ios'
  end
  ```

  NSE dağıtım hedefi 15.0 veya üzeri olmalı; sürüm numaraları (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`)
  uygulamayla aynı tutulmalıdır.

## Mimari

| Katman | Dosya |
|--------|-------|
| TS API | `src/HeroSignal.ts` (ad alanları), `src/events.ts` (NativeEventEmitter abonelikleri), `src/types.ts` |
| Codegen sözleşmesi | `src/NativeHeroSignal.ts` (TurboModule `HeroSignal`) |
| Android | `android/src/main/java/com/herosignal/reactnative/` (`HeroSignalModuleImpl`, `HeroSignalBridge`, `HeroSignalInitProvider`); `src/newarch` / `src/oldarch` modül kabukları |
| iOS | `ios/HeroSignalRN.mm` (ObjC++ kabuk, TurboModule), `ios/HeroSignalRNBridge.swift` (gövde), `ios/HeroSignalRNPush.h` |
| Expo | `plugin/src` → `plugin/build`, `app.plugin.js`, `plugin/templates` |

Olaylar: `HeroSignal-notificationClick`, `HeroSignal-notificationWillDisplay`, `HeroSignal-permissionChange`,
`HeroSignal-pushSubscriptionChange`, `HeroSignal-inAppClick`, `HeroSignal-inAppLifecycle`. In-app mesajlar yerel
SDK'nın varsayılan çizimiyle (Android Dialog, iOS UIWindow) gösterilir.

`HeroSignal-permissionChange` yerel SDK izin gözlemcisinden (`HeroSignal.Notifications.addPermissionObserver`, Android ve
iOS) üretilir: izin isteği sonuçlandığında ve uygulama ön plana döndüğünde izin ayarlardan değiştiyse yalnızca gerçek
değişiklikte gönderilir; köprü kendi izin yoklaması yapmaz.

## Geliştirme

Paket kök workspace'e dahil değildir:

```sh
cd sdk/react-native
npm install
npm test          # TS katmanı (sahte yerel modül) + config plugin testleri
npm run typecheck
npm run build     # lib/ ve plugin/build/
```

Örnek uygulama: `examples/react-native`.
