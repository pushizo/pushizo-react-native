<!-- pushizo:header -->
<p align="center">
  <a href="https://pushizo.com"><img src="https://raw.githubusercontent.com/pushizo/.github/main/profile/assets/mark.svg" alt="Pushizo" width="56" height="56"></a>
</p>
<p align="center">
  <a href="https://docs.pushizo.com/docs/sdk/react-native"><img src="https://img.shields.io/badge/docs-docs.pushizo.com-5b4bdb" alt="Docs"></a>
  <a href="https://docs.pushizo.com/docs/api"><img src="https://img.shields.io/badge/API-reference-b44fc4" alt="API reference"></a>
  <a href="https://github.com/pushizo/pushizo-react-native/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-16130f" alt="License: MIT"></a>
</p>
<p align="center"><a href="#english">English</a> · <a href="#türkçe">Türkçe</a></p>

## English

**Pushizo React Native SDK** — React Native and Expo module that wraps the native Pushizo Android and iOS SDKs. The API is compatible with the eski sağlayıcı v5 React Native API; queueing, sessions, delivery receipts and in-app rendering run natively.

> **Status:** Publishing to npm is in progress; until then you can build from this repository.<br>
> **Durum:** npm yayını hazırlanıyor; o zamana kadar bu depodan derleyerek kullanabilirsiniz.

```bash
npm install @pushizo/react-native
# Expo: add "@pushizo/react-native" to the plugins in app.json, then
npx expo prebuild
```

The detailed guide below is in Turkish; code samples are language-neutral. Full documentation:
[docs.pushizo.com/docs/sdk/react-native](https://docs.pushizo.com/docs/sdk/react-native) · API reference: [docs.pushizo.com/docs/api](https://docs.pushizo.com/docs/api).

## Türkçe
<!-- /pushizo:header -->

# @pushizo/react-native

Pushizo React Native SDK'sı: Android (`com.pushizo.sdk`) ve iOS (`Pushizo`) yerel SDK'larını saran köprü ve
Expo config plugin. Push aboneliği, kullanıcı/tag/alias, e-posta/SMS, bildirim tercihleri, in-app mesajlar, bildirim
kutusu ve olaylar.
Yüzey eski sağlayıcı v5 React Native API'si ile uyumludur; kuyruk, oturum, teslimat geri bildirimi
(received/opened) ve in-app çizimi yerel SDK'dadır.

- React Native ≥ 0.74; **New Architecture** (TurboModule, codegen `RNPushizoSpec`) ve eski mimari desteklenir.
- Android minSdk 24, iOS 15.0+.
- Expo: development build (`expo prebuild` / EAS Build). Expo Go yerel modül içermediği için desteklenmez.

## Kurulum

```sh
npm install @pushizo/react-native
```

### Bare React Native

**Android**

1. Firebase konsolundan Android uygulaması ekleyip `google-services.json` dosyasını `android/app/` içine koyun.
2. `android/build.gradle` → `buildscript.dependencies` içine `classpath("com.google.gms:google-services:4.4.2")`,
   `android/app/build.gradle` içine `apply plugin: "com.google.gms.google-services"` ekleyin.
3. Pushizo paneli → Kanallar → Android: FCM v1 servis hesabı JSON'unu yükleyin.
4. `POST_NOTIFICATIONS` izni ve FCM servisi yerel SDK manifestinden otomatik birleşir.
5. (İsteğe bağlı) Varsayılan bildirim ikonu: `AndroidManifest.xml` → `<application>` içine
   `<meta-data android:name="com.pushizo.sdk.default_notification_icon" android:resource="@drawable/ic_notification" />`.

Monorepo / yerel geliştirmede SDK kaynaktan bağlanabilir (`android/settings.gradle`):

```groovy
include ':pushizo'
project(':pushizo').projectDir = new File(rootProject.projectDir, '../../../sdk/android/pushizo')
```

Bu modül yoksa köprü `com.pushizo:pushizo-android` artefaktını kullanır (Maven Central ya da `publishToMavenLocal`).

**iOS**

1. `ios/Podfile` (yalnızca yerel geliştirmede; yayınlanmış pod CocoaPods trunk'tan gelir):
   `pod 'Pushizo', :path => '<repo>/sdk/ios'` → `cd ios && pod install`.
2. Xcode → hedef → Signing & Capabilities: **Push Notifications**, **Background Modes → Remote notifications** ve
   (rozet/NSE paylaşımı için) **App Groups** (`group.<bundle id>.pushizo`) ekleyin.
3. APNs token'ını iletin (SDK swizzling kullanmaz). Swift `AppDelegate`:

   ```swift
   import Pushizo

   func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
     Pushizo.setDeviceToken(deviceToken)
   }

   func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
     Pushizo.setDeviceTokenError(error)
   }
   ```

   Objective-C `AppDelegate.mm`: `#import <PushizoReactNative/PushizoRNPush.h>` ve ilgili metotlarda
   `[PushizoRNPush didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];` /
   `[PushizoRNPush didFailToRegisterForRemoteNotificationsWithError:error];`.
4. Pushizo paneli → Kanallar → iOS: APNs `.p8` anahtarını, Key ID ve Team ID ile yükleyin.

### Expo

`app.json`:

```json
{
  "expo": {
    "ios": { "bundleIdentifier": "com.example.app" },
    "android": { "package": "com.example.app", "googleServicesFile": "./google-services.json" },
    "plugins": [
      [
        "@pushizo/react-native",
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
| iOS | `aps-environment` (`mode`: `development` / `production`), Background Modes → `remote-notification`, App Group (`iosAppGroup`, varsayılan `group.<bundle id>.pushizo`), AppDelegate'e APNs token iletimi, Info.plist `PushizoAppId` / `PushizoApiUrl` / `PushizoAppGroup` / `PushizoRequiresPrivacyConsent` / `PushizoLogLevel` (erken başlatma bunları JS yüklenmeden uygular) |
| iOS | `PushizoNotificationServiceExtension` hedefi (dosyalar `plugin/templates`), Podfile'a `Pushizo/Extension` |
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
| `iosLocationUsageDescription` | string | Konum paylaşımı için Info.plist `NSLocationWhenInUseUsageDescription` metni. Verilmezse Info.plist'e dokunulmaz. |
| `androidLocationPermission` | `coarse` \| `fine` | Konum paylaşımı için manifest izni: `coarse` → `ACCESS_COARSE_LOCATION`, `fine` → ek olarak `ACCESS_FINE_LOCATION`. Verilmezse izin eklenmez; arka plan konum izni hiçbir zaman eklenmez. |

Geçersiz seçenekler `prebuild` sırasında hangi alanın nasıl düzeltileceğini söyleyen hatayla durur.

## Kullanım

```ts
import { Pushizo, LogLevel } from '@pushizo/react-native';

await Pushizo.initialize('app_…', { apiUrl: 'https://api.example.com', logLevel: LogLevel.Warn });
await Pushizo.Notifications.requestPermission();

await Pushizo.login('user_42', identityHashFromBackend); // identity verification açıksa hash zorunlu
await Pushizo.User.addTags({ plan: 'pro', city: 'istanbul' });
await Pushizo.User.addAlias('crm_id', '1001');
await Pushizo.User.addEmail('ali@example.com');      // geçersizse INVALID_ARGUMENT
await Pushizo.User.addSms('+90 532 123 45 67');      // E.164'e normalize edilir
await Pushizo.User.setLanguage('tr');

// Bildirim tercihleri (kategori × kanal; abonelik kaydı gerekir, yoksa NOT_READY)
const { preferences, categories } = await Pushizo.User.getPreferences();
await Pushizo.User.setPreferences([
  { category: 'promo', optedIn: false },                   // channel yok/null = tüm kanallar
  { category: 'news', channel: 'email', optedIn: true },  // ios_push | android_push | web_push | email | sms
]);

Pushizo.Notifications.addEventListener('click', (e) => {
  console.log(e.notification.title, e.result.actionId, e.result.url);
});
Pushizo.Notifications.addEventListener('foregroundWillDisplay', (e) => {
  if (e.getNotification().data.silent === '1') e.preventDefault(); // ön planda gösterme
  // asenkron karar: e.preventDefault(); sonra (≤25 sn) e.getNotification().display();
});
Pushizo.Notifications.addEventListener('permissionChange', ({ permission }) => {});
Pushizo.User.pushSubscription.addEventListener('change', ({ previous, current }) => {});

await Pushizo.InAppMessages.addTrigger('level', 'gold');
Pushizo.InAppMessages.setScreen('cart');
Pushizo.InAppMessages.addEventListener('click', ({ messageId, actionId, url }) => {});
Pushizo.InAppMessages.addEventListener('didDisplay', ({ messageId }) => {});

const page = await Pushizo.Inbox.list({ limit: 20 });
await Pushizo.Inbox.markRead(page.items[0].id);
await Pushizo.Inbox.markAllRead();
await Pushizo.Inbox.archive(page.items[0].id);

Pushizo.Session.sendEvent('purchase', { sku: 'A1' }, 49.9);
Pushizo.Notifications.clearAll();
await Pushizo.Notifications.removeGroupedNotifications('orders'); // Android android_group / iOS thread-id
await Pushizo.Notifications.removeNotification(id);              // Android: notification.androidNotificationId; iOS: UNNotificationRequest.identifier
const emails = await Pushizo.User.getEmails();                    // bu cihazda kayıtlı adresler; getSmsNumbers() aynı biçimde
Pushizo.Debug.setLogLevel(LogLevel.Debug);
Pushizo.logout();
```

### JWT ile kimlik doğrulama

App ayarlarında kimlik doğrulama kipi (`identity_verification_mode`) `jwt` veya `both` ise kullanıcı, sunucunuzda
imzalanmış kısa ömürlü bir ES256 JWT ile kimliklendirilir (talepler: `sub` = external_id, `aud` = app_id, `exp`/`iat` zorunlu, en çok 24 saat, yalnızca ES256).

```ts
await Pushizo.login('user_42', { jwt: jwtFromBackend });                  // yalnızca JWT
await Pushizo.login('user_42', { identityHash: hmac, jwt: jwtFromBackend }); // both kipinde ikisi birlikte
await Pushizo.updateUserJwt(refreshedJwt); // süresi dolmadan yenileyin
Pushizo.logout();
```

- JWT yerel SDK'da identity hash ile aynı kalıcı depoda saklanır ve tüm `/sdk/v1/...` isteklerinde
  `Authorization: Bearer <jwt>` başlığıyla gider; gövdeye/URL'ye yazılmaz, loglanmaz. `logout` belirteci siler.
- `/config` yanıtında `identity_verification_required` true ise login öncesi kanıt denetlenir: `jwt` kipinde JWT, `hmac`
  kipinde `identityHash` zorunludur, `both` kipinde biri yeter; eksikse `login` `NOT_READY` ile reddedilir. Alan gelmeyen
  eski sunucularda kip `hmac` sayılır; ikinci argümanı metin olan eski `login(id, identityHash)` çağrıları aynen çalışır.
- `updateUserJwt` giriş yapılmamışsa `NOT_READY` ile reddedilir; başarıda kuyrukta bekleyen işlemler yeni belirteçle
  yeniden denenir.

### Live Activities (iOS)

Köprü, iOS SDK'nın genel `PushizoDefaultLiveActivityAttributes` türünü kullanır. Push-to-start (sunucudan
uzaktan başlatma) iOS 17.2+, yerel başlatma iOS 16.1+ ister; Android'de çağrılar `PLATFORM_NOT_SUPPORTED` ile reddedilir.

```ts
await Pushizo.initialize('app_…');
await Pushizo.LiveActivities.setupDefaultLiveActivity(); // her açılışta: belirteçler sunucuya kaydedilir
await Pushizo.LiveActivities.startDefaultLiveActivity('order_42', { title: 'Sipariş #42' }, { status: 'Yolda', eta: 12 });
```

1. Uygulamanın `Info.plist` dosyasına `NSSupportsLiveActivities = YES` ekleyin.
2. Xcode → **File → New → Target → Widget Extension** ("Include Live Activity" seçili). Widget hedefine SPM'de
   `PushizoExtension` ürününü ekleyip `import PushizoExtension`, CocoaPods'ta `pod 'Pushizo/Extension'` ekleyip
   `import Pushizo` yazın:

   ```swift
   ActivityConfiguration(for: PushizoDefaultLiveActivityAttributes.self) { context in
       VStack {
           Text(context.attributes.data["title"]?.stringValue ?? "")
           Text(context.state.data["status"]?.description ?? "")
       }
   } dynamicIsland: { context in
       DynamicIsland { DynamicIslandExpandedRegion(.center) { Text(context.state.data["status"]?.description ?? "") } }
           compactLeading: { EmptyView() } compactTrailing: { Text(context.state.data["eta"]?.description ?? "") } minimal: { EmptyView() }
   }
   ```

3. Dashboard'da (**App → Live Activities**) veya API'de tür adı tam olarak `PushizoDefaultLiveActivityAttributes`
   olarak tanımlanmalıdır. Sunucudan gönderim:
   `POST /v1/apps/{appId}/live-activities/PushizoDefaultLiveActivityAttributes/start` (`activity_id`, `attributes`,
   `content_state`, `target`), `…/update` ve `…/end` (`activity_id` ile).

- `activityId` 1-100 karakter (harf, rakam ve `_ . : -`); `attributes`/`contentState` düz nesnedir, anahtarlar 1-64
  karakter, değerler metin, sonlu sayı veya mantıksal değerdir; `attributes` içinde `pushizo` anahtarı ayrılmıştır.
  Kurala uymayan girdi yerel modüle gitmeden `TypeError` fırlatır.
- Ret kodları: `PLATFORM_NOT_SUPPORTED` (Android veya iOS 16.1 öncesi), `NOT_READY` (`initialize` çağrılmadı),
  `INVALID_ARGUMENT`, `LIVE_ACTIVITY_FAILED` (Live Activities kapalı, `NSSupportsLiveActivities` yok vb.).
- Kendi tip-güvenli `ActivityAttributes` türünüzü kullanmak isterseniz iOS yerel tarafında (AppDelegate)
  `Pushizo.LiveActivities.register(MyAttributes.self)` çağırın; ayrıntı [ios rehberi](https://docs.pushizo.com/docs/sdk/ios) → "Live Activities".

### HTML in-app ve carousel

In-app mesajları yerel Android/iOS SDK'sı çizer; bu paket köprüdür. HTML in-app (sandbox'lı WebView, köprü
`close`/`click`/`addTag`/`trackEvent`) ve carousel blokları yerel SDK'dan olduğu gibi devralınır: ek kod veya
yapılandırma gerekmez, tıklama ve yaşam döngüsü olayları mevcut in-app dinleyicilerine gelir. Yetenek bildirimi
(`supports=html,carousel`) yerel SDK tarafından yapılır; desteklemeyen eski yerel sürümlere sunucu HTML mesaj göndermez
ve carousel bloklarını çıkarır.

### Canlı sohbet

```ts
await Pushizo.Chat.start({ name: 'Ali' });
const config = await Pushizo.Chat.getConfig();          // online, offlineMessage, ek sınırları
let { messages } = await Pushizo.Chat.getMessages();
Pushizo.Chat.addEventListener('message', ({ message }) => (messages = mergeChatMessages(messages, [message])));
Pushizo.Chat.addEventListener('open', ({ conversationId }) => openChat(conversationId)); // bildirime tıklama
Pushizo.Chat.startListening();                           // ekran açıkken; ayrılınca stopListening()
await Pushizo.Chat.sendMessage('Merhaba');               // bot hızlı yanıtı: sendMessage(label, { optionId })
await Pushizo.Chat.sendAttachment({ uri: 'file:///…/rapor.pdf' }, { fileName: 'rapor.pdf', mimeType: 'application/pdf' });
await Pushizo.Chat.markRead(messages[messages.length - 1].seq);
```

Ziyaretçi kimliği, çevrimdışı kuyruk (aynı `client_message_id` ile yeniden deneme), canlı akış (SSE; koparsa üstel
geri çekilme + `after_seq` yoklaması) ve push ile gelen temsilci mesajları (`pushizo_chat`) yerel Android/iOS SDK'sındadır;
`start` sonrası login/logout ve push aboneliği değişince bağlama yerel SDK'da yenilenir, logout ziyaretçiyi sıfırlar.
Mesajlar `seq` ile sıralanır; ağ yokken gönderilen mesaj `pending` döner ve gönderilince olayla sunucu kopyası gelir.
Ayrıntı: [android rehberi](https://docs.pushizo.com/docs/sdk/android) / [ios rehberi](https://docs.pushizo.com/docs/sdk/ios) → "Canlı sohbet".
Olaylar: `message`, `typing`, `read`, `unread`, `conversation`, `connection`, `error`, `open` (soğuk açılışta
ilk dinleyiciye iletilir).

### Konum

Konum paylaşımı isteğe bağlıdır ve **yalnızca ön planda** çalışır (arka plan konumu yoktur). Paylaşım açık ve izin
verilmişken yerel SDK, oturum başında ve uygulama ön plana döndüğünde en sık 5 dakikada bir yaklaşık konumu push
aboneliğine yazar (`PATCH /sdk/v1/apps/{appId}/subscriptions/{id}` → `location: { lat, lng, accuracy_m }`); istekler
yerel SDK'nın kalıcı kuyruğuyla gider. İzin yoksa sessizce gönderilmez.

```ts
const granted = await Pushizo.Location.requestPermission('Yakındaki mağazaları göstermek için konumunuzu kullanırız.');
if (granted) Pushizo.Location.setShared(true);

const shared = await Pushizo.Location.isShared(); // kalıcı tercih (izin durumundan bağımsız)
Pushizo.Location.setShared(false);                // sunucudaki konum ve rıza kaydı silinir
```

| API | Açıklama |
|-----|----------|
| `Location.setShared(shared)` | Paylaşımı açar/kapatır; tercih cihazda kalıcıdır. Açılırken izin varsa konum hemen gönderilir. |
| `Location.isShared()` | `Promise<boolean>`: paylaşım tercihi (izin verilip verilmediğini göstermez). |
| `Location.requestPermission(rationale?)` | `Promise<boolean>`: önce açıklama diyaloğu (`rationale`, verilmezse SDK'nın tr/en varsayılan metni), kullanıcı "Devam" derse sistem izni. İzin zaten varsa veya verildiyse `true`; "Şimdi değil", ret ya da kalıcı ret `false`. |

- **iOS:** `Info.plist`'e `NSLocationWhenInUseUsageDescription` ekleyin (Expo: `iosLocationUsageDescription`). Anahtar
  yoksa `requestPermission` `false` döner. Yalnızca "kullanırken" izni istenir (Always istenmez); reddedilmiş/kısıtlı
  izin yeniden sorulamaz, kullanıcıyı Ayarlar'a yönlendirin.
- **Android:** köprü izin eklemez; uygulamanın `AndroidManifest.xml` dosyasına ekleyin (Expo: `androidLocationPermission`):

  ```xml
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <!-- isteğe bağlı, hassas konum -->
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  ```

  Manifest'te konum izni yoksa `requestPermission` uyarı loglar ve `false` döner; ön planda `ReactActivity` yoksa
  `NO_ACTIVITY` ile reddedilir. `ACCESS_BACKGROUND_LOCATION` gerekmez ve istenmez.
- **KVKK:** sunucuya ulaşan ilk konum açık rıza kaydı olarak saklanır; açıklama metninde amacı açıkça belirtin.
  `requiresPrivacyConsent` ile başlatıldıysa `setConsentGiven(true)` gelene kadar konum gönderilmez.
- **Silme:** `setShared(false)` sunucuya `location: null` gönderir; konum ve rıza kaydı silinir, bekleyen konum
  gönderilmez.

### Gizlilik (KVKK/GDPR)

`initialize(appId, { requiresPrivacyConsent: true })` ile başlatıldığında `Pushizo.setConsentGiven(true)` çağrılana
kadar hiçbir ağ çağrısı yapılmaz. `setConsentGiven(false)` kuyruğu ve yerel kimliği temizler.

### Erken başlatma ve soğuk açılış

Bildirime dokunularak açılan uygulamada tıklama, JS'te `click` dinleyicisi eklenene kadar yerelde bekletilir. SDK'nın
JS yüklenmeden başlaması için (oturum başlangıcı, in-app Activity takibi, iOS bildirim merkezi temsilcisi):

- **Android:** `AndroidManifest.xml` → `<application>` içine
  `com.pushizo.reactnative.app_id` (ve isteğe bağlı `com.pushizo.reactnative.api_url`,
  `com.pushizo.reactnative.requires_privacy_consent`, `com.pushizo.reactnative.log_level`) meta-data'sı.
- **iOS:** `Info.plist` → `PushizoAppId` (ve isteğe bağlı `PushizoApiUrl`).

Expo plugin'i `appId` verildiğinde bunları ekler. JS `initialize` yine çağrılmalıdır; aynı appId ile ikinci çağrı yerel
SDK'yı yeniden kurmaz.

### Hata kodları

Promise reddi `code` alanı: `INVALID_ARGUMENT` (geçersiz e-posta/telefon/alias/trigger/tercih), `NOT_READY`
(`initialize` çağrılmadı veya abonelik henüz kayıtlı değil), `NO_ACTIVITY` (Android'de bildirim/konum izni isteği için
ön planda Activity yok), `PLATFORM_NOT_SUPPORTED` / `LIVE_ACTIVITY_FAILED` (Live Activities), sunucu hata kodları
(`HSApiError.code` / `HsApiException.code`) ve `HS_ERROR`.

## iOS Notification Service Extension (NSE)

NSE; zengin medya (resim), aksiyon düğmeleri, rozet artışı (`badge_inc`) ve confirmed delivery (`received`) için gerekir.

- **Expo:** plugin otomatik ekler (`iosNotificationServiceExtension: false` ile kapatılır).
- **Bare RN:** Xcode → File → New → Target → *Notification Service Extension* (`PushizoNotificationServiceExtension`).
  `plugin/templates/PushizoNotificationServiceExtension/NotificationService.swift` dosyasını hedefe kopyalayın;
  hedefin Info.plist'ine `PushizoAppId`, (isteğe bağlı) `PushizoApiUrl` ve `PushizoAppGroup` ekleyin; hedefe
  aynı App Group yetkisini verin. Podfile:

  ```ruby
  target 'PushizoNotificationServiceExtension' do
    pod 'Pushizo/Extension', '~> 0.1'   # yerel geliştirme: :path => '<repo>/sdk/ios'
  end
  ```

  NSE dağıtım hedefi 15.0 veya üzeri olmalı; sürüm numaraları (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`)
  uygulamayla aynı tutulmalıdır.

## Mimari

| Katman | Dosya |
|--------|-------|
| TS API | `src/Pushizo.ts` (ad alanları), `src/events.ts` (NativeEventEmitter abonelikleri), `src/types.ts` |
| Codegen sözleşmesi | `src/NativePushizo.ts` (TurboModule `Pushizo`) |
| Android | `android/src/main/java/com/pushizo/reactnative/` (`PushizoModuleImpl`, `PushizoBridge`, `PushizoInitProvider`); `src/newarch` / `src/oldarch` modül kabukları |
| iOS | `ios/PushizoRN.mm` (ObjC++ kabuk, TurboModule), `ios/PushizoRNBridge.swift` (gövde), `ios/PushizoRNPush.h` |
| Expo | `plugin/src` → `plugin/build`, `app.plugin.js`, `plugin/templates` |

Olaylar: `Pushizo-notificationClick`, `Pushizo-notificationWillDisplay`, `Pushizo-permissionChange`,
`Pushizo-pushSubscriptionChange`, `Pushizo-inAppClick`, `Pushizo-inAppLifecycle`. In-app mesajlar yerel
SDK'nın varsayılan çizimiyle (Android Dialog, iOS UIWindow) gösterilir.

`Pushizo-permissionChange` yerel SDK izin gözlemcisinden (`Pushizo.Notifications.addPermissionObserver`, Android ve
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

Adım adım kurulum ve örnek kod: [react-native rehberi](https://docs.pushizo.com/docs/sdk/react-native).

<!-- pushizo:footer -->
---

## Support · Destek

- **Guide · Rehber:** [docs.pushizo.com/docs/sdk/react-native](https://docs.pushizo.com/docs/sdk/react-native)
- **API reference & OpenAPI · API referansı ve OpenAPI:** [docs.pushizo.com/docs/api](https://docs.pushizo.com/docs/api) ·
  [pushizo-openapi](https://github.com/pushizo/pushizo-openapi)
- **Bugs & ideas · Hata ve öneri:** [Issues](https://github.com/pushizo/pushizo-react-native/issues)
- **Security · Güvenlik:** please do not open public issues; email [security@pushizo.com](mailto:security@pushizo.com) ·
  herkese açık issue açmayın, bu adrese yazın.
- **Help · Destek:** [support@pushizo.com](mailto:support@pushizo.com)

This repository is mirrored automatically from the Pushizo main repository on every release. Please open an issue
instead of a pull request; fixes land in the main repository and ship with the next release.
Bu depo her sürümde Pushizo ana deposundan otomatik yansıtılır. Pull request yerine issue açın; düzeltmeler ana depoda
yapılır ve bir sonraki sürümle buraya gelir.

Released under the MIT License · MIT lisanslıdır — [LICENSE](https://github.com/pushizo/pushizo-react-native/blob/main/LICENSE).
<!-- /pushizo:footer -->
