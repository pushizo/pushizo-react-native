# @herosignal/react-native

HeroSignal React Native SDK'sı: Android (`com.herosignal.sdk`) ve iOS (`HeroSignal`) yerel SDK'larını saran köprü ve
Expo config plugin. Push aboneliği, kullanıcı/tag/alias, e-posta/SMS, bildirim tercihleri, in-app mesajlar, bildirim
kutusu ve olaylar.
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
| iOS | `aps-environment` (`mode`: `development` / `production`), Background Modes → `remote-notification`, App Group (`iosAppGroup`, varsayılan `group.<bundle id>.herosignal`), AppDelegate'e APNs token iletimi, Info.plist `HeroSignalAppId` / `HeroSignalApiUrl` / `HeroSignalAppGroup` / `HeroSignalRequiresPrivacyConsent` / `HeroSignalLogLevel` (erken başlatma bunları JS yüklenmeden uygular) |
| iOS | `HeroSignalNotificationServiceExtension` hedefi (dosyalar `plugin/templates`), Podfile'a `HeroSignal/Extension` |
| Android | `POST_NOTIFICATIONS`, küçük ikon (PNG'den tüm yoğunluklar), vurgu rengi, erken başlatma meta-data'sı (onay, günlük seviyesi, varsayılan kanal) |
| Android | `android.googleServicesFile` verilmişse dosyayı `android/app/google-services.json` olarak kopyalar, `com.google.gms:google-services` sınıf yolunu ve `com.google.gms.google-services` Gradle eklentisini ekler (idempotent; Expo'nun kendi adımıyla çakışmaz). Dosya yoksa prebuild açık hatayla durur; alan hiç verilmemişse uyarı verilir. |

| Seçenek | Tip | Açıklama |
|---------|-----|----------|
| `mode` | `development` \| `production` | **Zorunlu.** APNs ortamı. TestFlight/App Store için `production`. |
| `appId` | string | Erken başlatma ve NSE için. NSE açıkken zorunlu. |
| `apiUrl` | string | Kendi barındırma API adresi. |
| `requiresPrivacyConsent` | boolean | Erken başlatmada onay bekle (JS `initialize` ile aynı olmalı). `true` iken SDK, `setConsentGiven(true)` gelene kadar ağa çıkmaz — JS yüklenmeden önce de. |
| `logLevel` | `none`…`debug` | Erken başlatma günlük seviyesi. |
| `iosAppGroup` | string | `group.` ile başlayan App Group. |
| `iosNotificationServiceExtension` | boolean | NSE hedefi (varsayılan `true`). |
| `iosDeploymentTarget` | string | NSE dağıtım hedefi (varsayılan `15.0`). |
| `devTeam` | string | Apple Team ID (NSE imzalama). |
| `iosSdkPath` / `androidSdkPath` | string | Monorepo: yerel SDK'ları kaynaktan bağlar. |
| `androidSmallIcon` | string | PNG (beyaz şekil, saydam arka plan). |
| `androidAccentColor` | `#RRGGBB` | Bildirim vurgu rengi. |
| `androidDefaultChannelId` / `androidDefaultChannelName` | string | Erken başlatmada varsayılan bildirim kanalı (JS `defaultChannelId` / `defaultChannelName` ile aynı olmalı). |

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

// Bildirim tercihleri (kategori × kanal; abonelik kaydı gerekir, yoksa NOT_READY)
const { preferences, categories } = await HeroSignal.User.getPreferences();
await HeroSignal.User.setPreferences([
  { category: 'promo', optedIn: false },                   // channel yok/null = tüm kanallar
  { category: 'news', channel: 'email', optedIn: true },  // ios_push | android_push | web_push | email | sms
]);

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
await HeroSignal.Notifications.removeGroupedNotifications('orders'); // Android android_group / iOS thread-id
await HeroSignal.Notifications.removeNotification(id);              // Android: notification.androidNotificationId; iOS: UNNotificationRequest.identifier
const emails = await HeroSignal.User.getEmails();                    // bu cihazda kayıtlı adresler; getSmsNumbers() aynı biçimde
HeroSignal.Debug.setLogLevel(LogLevel.Debug);
HeroSignal.logout();
```

### JWT ile kimlik doğrulama

App ayarlarında kimlik doğrulama kipi (`identity_verification_mode`) `jwt` veya `both` ise kullanıcı, sunucunuzda
imzalanmış kısa ömürlü bir ES256 JWT ile kimliklendirilir (ADR-0023 §9; talepler: `sub` = external_id, `aud` = app_id, `exp`/`iat` zorunlu, en çok 24 saat, yalnızca ES256).

```ts
await HeroSignal.login('user_42', { jwt: jwtFromBackend });                  // yalnızca JWT
await HeroSignal.login('user_42', { identityHash: hmac, jwt: jwtFromBackend }); // both kipinde ikisi birlikte
await HeroSignal.updateUserJwt(refreshedJwt); // süresi dolmadan yenileyin
HeroSignal.logout();
```

- JWT yerel SDK'da identity hash ile aynı kalıcı depoda saklanır ve tüm `/sdk/v1/...` isteklerinde
  `Authorization: Bearer <jwt>` başlığıyla gider; gövdeye/URL'ye yazılmaz, loglanmaz. `logout` belirteci siler.
- `/config` yanıtında `identity_verification_required` true ise login öncesi kanıt denetlenir: `jwt` kipinde JWT, `hmac`
  kipinde `identityHash` zorunludur, `both` kipinde biri yeter; eksikse `login` `NOT_READY` ile reddedilir. Alan gelmeyen
  eski sunucularda kip `hmac` sayılır; ikinci argümanı metin olan eski `login(id, identityHash)` çağrıları aynen çalışır.
- `updateUserJwt` giriş yapılmamışsa `NOT_READY` ile reddedilir; başarıda kuyrukta bekleyen işlemler yeni belirteçle
  yeniden denenir.

### Live Activities (iOS)

Köprü, iOS SDK'nın genel `HeroSignalDefaultLiveActivityAttributes` türünü kullanır (ADR-0024). Push-to-start (sunucudan
uzaktan başlatma) iOS 17.2+, yerel başlatma iOS 16.1+ ister; Android'de çağrılar `PLATFORM_NOT_SUPPORTED` ile reddedilir.

```ts
await HeroSignal.initialize('app_…');
await HeroSignal.LiveActivities.setupDefaultLiveActivity(); // her açılışta: belirteçler sunucuya kaydedilir
await HeroSignal.LiveActivities.startDefaultLiveActivity('order_42', { title: 'Sipariş #42' }, { status: 'Yolda', eta: 12 });
```

1. Uygulamanın `Info.plist` dosyasına `NSSupportsLiveActivities = YES` ekleyin.
2. Xcode → **File → New → Target → Widget Extension** ("Include Live Activity" seçili). Widget hedefine SPM'de
   `HeroSignalExtension` ürününü ekleyip `import HeroSignalExtension`, CocoaPods'ta `pod 'HeroSignal/Extension'` ekleyip
   `import HeroSignal` yazın:

   ```swift
   ActivityConfiguration(for: HeroSignalDefaultLiveActivityAttributes.self) { context in
       VStack {
           Text(context.attributes.data["title"]?.stringValue ?? "")
           Text(context.state.data["status"]?.description ?? "")
       }
   } dynamicIsland: { context in
       DynamicIsland { DynamicIslandExpandedRegion(.center) { Text(context.state.data["status"]?.description ?? "") } }
           compactLeading: { EmptyView() } compactTrailing: { Text(context.state.data["eta"]?.description ?? "") } minimal: { EmptyView() }
   }
   ```

3. Dashboard'da (**App → Live Activities**) veya API'de tür adı tam olarak `HeroSignalDefaultLiveActivityAttributes`
   olarak tanımlanmalıdır. Sunucudan gönderim:
   `POST /v1/apps/{appId}/live-activities/HeroSignalDefaultLiveActivityAttributes/start` (`activity_id`, `attributes`,
   `content_state`, `target`), `…/update` ve `…/end` (`activity_id` ile).

- `activityId` 1-100 karakter (harf, rakam ve `_ . : -`); `attributes`/`contentState` düz nesnedir, anahtarlar 1-64
  karakter, değerler metin, sonlu sayı veya mantıksal değerdir; `attributes` içinde `herosignal` anahtarı ayrılmıştır.
  Kurala uymayan girdi yerel modüle gitmeden `TypeError` fırlatır.
- Ret kodları: `PLATFORM_NOT_SUPPORTED` (Android veya iOS 16.1 öncesi), `NOT_READY` (`initialize` çağrılmadı),
  `INVALID_ARGUMENT`, `LIVE_ACTIVITY_FAILED` (Live Activities kapalı, `NSSupportsLiveActivities` yok vb.).
- Kendi tip-güvenli `ActivityAttributes` türünüzü kullanmak isterseniz iOS yerel tarafında (AppDelegate)
  `HeroSignal.LiveActivities.register(MyAttributes.self)` çağırın; ayrıntı `docs/sdk/ios.md` → "Live Activities".

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

Promise reddi `code` alanı: `INVALID_ARGUMENT` (geçersiz e-posta/telefon/alias/trigger/tercih), `NOT_READY`
(`initialize` çağrılmadı veya abonelik henüz kayıtlı değil), `NO_ACTIVITY` (Android'de izin isteği için ön planda
Activity yok), `PLATFORM_NOT_SUPPORTED` / `LIVE_ACTIVITY_FAILED` (Live Activities), sunucu hata kodları
(`HSApiError.code` / `HsApiException.code`) ve `HS_ERROR`.

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
