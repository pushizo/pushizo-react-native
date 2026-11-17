/** Günlük seviyeleri (yerel SDK `HsLog.Level` / `HSLog.Level` ile aynı sırada). */
export const LogLevel = {
  None: 'none',
  Error: 'error',
  Warn: 'warn',
  Info: 'info',
  Debug: 'debug',
} as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/** `Pushizo.initialize` seçenekleri. */
export interface InitializeOptions {
  /** Pushizo API adresi (kendi barındırma için). Varsayılan `https://api.pushizo.com`. */
  apiUrl?: string;
  /** KVKK/GDPR: true ise `setConsentGiven(true)` çağrılana kadar hiçbir ağ çağrısı yapılmaz. */
  requiresPrivacyConsent?: boolean;
  /** Başlangıç günlük seviyesi (varsayılan `warn`). */
  logLevel?: LogLevel;
  /** iOS: Notification Service Extension ile paylaşılan App Group (ör. `group.com.pushizo.app`). */
  appGroup?: string;
  /** iOS: APNs ortamı (`development` / `production`); verilmezse provisioning profilinden tespit edilir. */
  apnsEnvironment?: 'development' | 'sandbox' | 'production';
  /** iOS: provisional (sessiz) izinle başla. */
  provisionalAuthorization?: boolean;
  /** Android: varsayılan bildirim kanalı kimliği. */
  defaultChannelId?: string;
  /** Android: varsayılan bildirim kanalı adı (kullanıcı ayarlarında görünür). */
  defaultChannelName?: string;
}

/**
 * `Pushizo.login` kimlik kanıtı (ADR-0023 §9). App'in `identity_verification_mode` ayarına göre HMAC
 * `identityHash` ve/veya sunucunuzda imzalanmış ES256 `jwt` (`sub` = externalId, `aud` = appId) verilir.
 */
export interface LoginOptions {
  identityHash?: string;
  /** SDK isteklerinde `Authorization: Bearer` başlığıyla gider; süresi dolunca `updateUserJwt` ile yenilenir. */
  jwt?: string;
  /** Girişle birlikte ayarlanacak profil alanları (tek çağrı). */
  profile?: UserProfile;
}

/**
 * `Pushizo.login` ile birlikte ayarlanan profil. Geçersiz e-posta veya telefon girişten önce `INVALID_ARGUMENT` ile
 * reddedilir; yarım kalmış bir kimlik değişimi olmaz.
 */
export interface UserProfile {
  email?: string;
  /** E.164 telefon numarası. */
  sms?: string;
  tags?: Record<string, string>;
  aliases?: Record<string, string>;
}

/**
 * iOS Live Activity alan değeri (`PushizoDefaultLiveActivityAttributes.data` / `ContentState.data`): metin, sonlu
 * sayı veya mantıksal değer.
 */
export type LiveActivityValue = string | number | boolean;

/** Bildirim içeriği (yerel SDK `HsNotification` / `HSNotification`). */
export interface NotificationData {
  title: string | null;
  body: string | null;
  url: string | null;
  imageUrl: string | null;
  /** Teslimat kimliği (`hs.dlv`); opened/received geri bildirimleri buna bağlanır. */
  deliveryId: string | null;
  messageId: string | null;
  /** Mesajla gönderilen ek veri (`data`). */
  data: Record<string, string>;
  /** Yalnızca Android: tepsi kimliği (`Notifications.removeNotification` için); iOS'ta null. */
  androidNotificationId: number | null;
}

/** Bildirim tıklaması (plan 06 §6.1): `{ notification, result: { actionId, url } }`. */
export interface NotificationClickEvent {
  notification: NotificationData;
  result: {
    /** Tıklanan düğmenin kimliği; gövdeye tıklandıysa `null`. */
    actionId: string | null;
    /** Açılacak adres (düğme veya bildirim URL'si). */
    url: string | null;
  };
}

/** İzin değişimi olayı. */
export interface PermissionChangeEvent {
  permission: boolean;
}

/** Push aboneliği durumu. */
export interface PushSubscriptionState {
  id: string | null;
  token: string | null;
  optedIn: boolean;
  /** Bildirim izni var mı. */
  permission: boolean;
}

/** Push aboneliği değişimi (`previous` ilk olayda yerel SDK'nın bildirdiği ilk durumdur). */
export interface PushSubscriptionChangedState {
  previous: PushSubscriptionState;
  current: PushSubscriptionState;
}

/** In-app düğme tıklaması. */
export interface InAppMessageClickEvent {
  messageId: string;
  actionId: string;
  url: string | null;
}

/** In-app yaşam döngüsü olayı. */
export interface InAppMessageLifecycleEvent {
  messageId: string;
}

/** Bildirim kutusu öğesi; zamanlar epoch milisaniyedir. */
export interface InboxItem {
  id: string;
  messageId: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  imageUrl: string | null;
  data: Record<string, string>;
  read: boolean;
  readAt: number | null;
  archivedAt: number | null;
  expiresAt: number | null;
  createdAt: number | null;
}

/** Bildirim kutusu sayfası (yeniden eskiye). */
export interface InboxPage {
  items: InboxItem[];
  unreadCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

/** İçerik kartı türü (ADR-0082). */
export type ContentCardType = 'classic' | 'captioned_image' | 'image_only';

/** İçerik kartı; zamanlar epoch milisaniyedir. Akış sabitlenmiş → öncelik → yeni sırasıyla gelir. */
export interface ContentCard {
  id: string;
  messageId: string | null;
  type: ContentCardType;
  title: string | null;
  body: string | null;
  url: string | null;
  imageUrl: string | null;
  buttonText: string | null;
  data: Record<string, string>;
  pinned: boolean;
  priority: number;
  viewed: boolean;
  clicked: boolean;
  expiresAt: number | null;
  createdAt: number | null;
}

/** Kart akışı ve görülmemiş kart sayısı. */
export interface ContentCardFeed {
  cards: ContentCard[];
  unviewedCount: number;
}

/** `Inbox.list` seçenekleri. */
export interface InboxListOptions {
  /** 1-200 (varsayılan 50). */
  limit?: number;
  /** Önceki sayfanın `nextCursor` değeri. */
  cursor?: string | null;
}

// --- Kullanıcı tercihleri (ADR-0019 §4) ---

/** Tercih kanalları (`null` = tüm kanallar). */
export const PreferenceChannels = ['ios_push', 'android_push', 'web_push', 'email', 'sms'] as const;
export type PreferenceChannel = (typeof PreferenceChannels)[number];

/**
 * Kullanıcı tercihi: kategori × kanal (`null` = tüm kanallar) → opt-in. `explicit` false ise değer kategori
 * varsayılanından türetilmiştir; `source` kaydı yazan taraftır (sdk, api, preference_center…).
 */
export interface UserPreference {
  category: string;
  /** `null` (tüm kanallar) veya `PreferenceChannels` değerlerinden biri; ileride eklenecek kanallar da metin olarak gelir. */
  channel: string | null;
  optedIn: boolean;
  explicit: boolean;
  source: string | null;
  /** Epoch milisaniye; türetilmiş değerde `null`. */
  updatedAt: number | null;
}

/** Mesaj kategorisi: çok dilli ad/açıklama (`dil kodu → metin`), kanal kısıtı (`null` = tümü) ve varsayılan opt-in. */
export interface PreferenceCategory {
  key: string;
  name: Record<string, string>;
  description: Record<string, string>;
  channels: string[] | null;
  defaultOptedIn: boolean;
}

/** `User.getPreferences` / `User.setPreferences` sonucu: kullanıcının tercihleri ve app'in kategorileri. */
export interface UserPreferences {
  preferences: UserPreference[];
  categories: PreferenceCategory[];
  /** Rıza kayıtları (`ads_personalization` …); eski API sürümlerinde boş. */
  consents: UserConsent[];
}

/**
 * Rıza kaydı (ADR-0037). `ads_personalization`: e-posta/telefon özetinin reklam platformu kitlelerine gönderilmesine
 * açık onay. Varsayılan rıza yoktur; `source` kaydı yazan taraftır.
 */
export interface UserConsent {
  purpose: string;
  granted: boolean;
  source: string | null;
  /** Epoch milisaniye; kayıt yoksa `null`. */
  updatedAt: number | null;
}

/** `User.setPreferences` girdisi; `channel` verilmezse veya `null` ise tüm kanallar. */
export interface PreferenceInput {
  /** Kategori anahtarı (1-64 karakter). */
  category: string;
  optedIn: boolean;
  channel?: PreferenceChannel | null;
}

// --- Özellik bayrakları (ADR-0066) ---

/** Bayrak değeri: metin, sayı, mantıksal, JSON nesnesi/dizisi veya `null`. */
export type FeatureFlagValue = string | number | boolean | null | FeatureFlagValue[] | { [key: string]: FeatureFlagValue };

// --- Gömülü yerleşimler (ADR-0068): yerel SDK `HsInAppMessage` / `HSInAppMessage` modeli ---

/** In-app tetik koşulu; `unsupported.name` yerel SDK'nın tanımadığı tetik türüdür. Yerleşimlerde tetik değerlendirilmez. */
export type InAppTrigger =
  | { kind: 'session_start' }
  | { kind: 'session_duration'; seconds: number }
  | { kind: 'event'; name: string }
  | { kind: 'screen'; name: string }
  | { kind: 'trigger'; key: string; op: string; value: string | number | null }
  | { kind: 'unsupported'; name: string };

/** Düğme aksiyonu; yerleşimde aksiyonu uygulama yürütür (`url` http/https, `deeplink` uygulama şeması). */
export type InAppAction =
  | { type: 'dismiss' }
  | { type: 'url'; url: string }
  | { type: 'deeplink'; url: string }
  | { type: 'tags'; tags: Record<string, string> }
  | { type: 'push_prompt' }
  | { type: 'outcome'; name: string; value: number | null };

export interface InAppButton {
  id: string;
  text: string;
  action: InAppAction;
  backgroundColor: string | null;
  textColor: string | null;
}

/** Carousel kartı; `button` geçersiz aksiyonlu ise `null`. */
export interface InAppCarouselCard {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  button: InAppButton | null;
}

/** İçerik bloğu; metinler sunucuda kullanıcının dilinde çözülmüştür. */
export type InAppBlock =
  | { type: 'image'; url: string; alt: string | null }
  | { type: 'title'; text: string }
  | { type: 'body'; text: string }
  | ({ type: 'button' } & InAppButton)
  | { type: 'carousel'; id: string; cards: InAppCarouselCard[] };

export type InAppLayout = 'modal' | 'banner_top' | 'banner_bottom' | 'fullscreen';
export type InAppContentType = 'blocks' | 'html';

export interface InAppDisplay {
  /** Yerleşimde yok sayılır: boyutu sayfa belirler. */
  layout: InAppLayout;
  backgroundColor: string | null;
  textColor: string | null;
  dismissible: boolean;
  autoDismissSeconds: number | null;
  /** `html` ise `blocks` boştur ve içerik `html` alanındadır. */
  contentType: InAppContentType;
  html: string | null;
  htmlHeight: number | null;
  blocks: InAppBlock[];
  /** Düğme blokları ve carousel kartlarının düğmeleri (`reportClick` için `id`). */
  buttons: InAppButton[];
}

/** `Placements.list` öğesi; zamanlar epoch milisaniyedir. */
export interface InAppMessage {
  id: string;
  priority: number;
  /** İlk tetik grubu (geriye uyum). */
  triggers: InAppTrigger[];
  /** VEYA ile bağlı gruplar (grup içi VE). */
  triggerGroups: InAppTrigger[][];
  /** Sunucunun seçtiği A/B varyantı; rapor çağrılarında yerel katman geri gönderir. */
  variantId: string | null;
  display: InAppDisplay;
  remainingImpressions: number;
  minIntervalSeconds: number;
  stopAfterInteraction: boolean;
  lastImpressionAt: number | null;
  endAt: number | null;
  /** Sunucunun içeriği çözdüğü dil. */
  language: string | null;
  /** Sunucudaki ham JSON. */
  raw: Record<string, unknown>;
}

/** `Placements.list` seçenekleri. */
export interface PlacementListOptions {
  /** 1-10 (varsayılan 1). */
  limit?: number;
}

/** Yerel olay adları (NativeEventEmitter). Yerel köprülerdeki sabitlerle aynı olmalıdır. */
export const NativeEvents = {
  Click: 'Pushizo-notificationClick',
  ForegroundWillDisplay: 'Pushizo-notificationWillDisplay',
  PermissionChange: 'Pushizo-permissionChange',
  PushSubscriptionChange: 'Pushizo-pushSubscriptionChange',
  InAppClick: 'Pushizo-inAppClick',
  InAppLifecycle: 'Pushizo-inAppLifecycle',
} as const;
export type NativeEventName = (typeof NativeEvents)[keyof typeof NativeEvents];

/** Bildirim teslim riski (ADR-0092; yerel Android `HsDeliveryRisk`). */
export type DeliveryRisk = 'none' | 'elevated' | 'high';

/**
 * `Pushizo.Delivery.openSettings` / `showGuidance` ile açılabilen Android ayar ekranı: `auto` duruma en uygun ekran,
 * `notifications` bildirim ayarları, `auto_start` üreticinin otomatik başlatma yöneticisi, `battery_optimization` pil
 * optimizasyonu, `app_details` uygulama ayrıntıları.
 */
export type DeliverySetting = 'auto' | 'notifications' | 'auto_start' | 'battery_optimization' | 'app_details';

/** `DeliverySetting` değerleri (doğrulama ve seçim listeleri için). */
export const DeliverySettings: readonly DeliverySetting[] = ['auto', 'notifications', 'auto_start', 'battery_optimization', 'app_details'];

/**
 * Cihazın bildirim teslim durumu (`Pushizo.Delivery.status()`; yerel Android `HsDeliveryStatus`). Kişisel veri içermez.
 * Yalnızca Android'de doludur: iOS'ta ve Android'de SDK başlatılmadan önce `supported` `false`, `risk` `none` ve
 * `recommendedSettings` boştur.
 */
export interface DeliveryStatus {
  /** Teşhis bu platformda okunabildi mi. */
  supported: boolean;
  /** `Build.MANUFACTURER` (küçük harf). */
  manufacturer: string;
  /** `Build.BRAND` (küçük harf). */
  brand: string;
  /** Üretici ailesi: `xiaomi`, `huawei`, `honor`, `oppo`, `realme`, `oneplus`, `vivo`, `samsung`, `meizu`, `asus`, `transsion`, `other`. */
  vendor: string;
  /** Üreticinin kendi pil/otomatik başlatma yöneticisi arka plandaki uygulamaları durdurabiliyor mu. */
  aggressiveVendor: boolean;
  /** ROM kimliği: `miui`, `hyperos`, `emui`, `harmonyos`, `magicos`, `coloros`, `oxygenos`, `realmeui`, `funtouchos`, `originos`, `oneui`, `flyme`, `android`. */
  rom: string;
  romVersion: string | null;
  /** Bildirim izni verilmiş ve bildirimler açık mı. */
  notificationsEnabled: boolean;
  /** Varsayılan bildirim kanalı kullanıcı tarafından kapatılmış mı. */
  channelBlocked: boolean;
  /** Uygulama pil optimizasyonundan muaf mı. */
  batteryOptimizationExempt: boolean;
  /** Kullanıcı arka plan etkinliğini kısıtlamış mı. */
  backgroundRestricted: boolean;
  /** Bekleme kovası: `exempted`, `active`, `working_set`, `frequent`, `rare`, `restricted` (okunamadıysa null). */
  standbyBucket: string | null;
  /** Pil tasarrufu kipi açık mı. */
  powerSaveMode: boolean;
  /** Veri tasarrufu uygulamanın arka plan verisini engelliyor mu. */
  dataSaverEnabled: boolean;
  /** Sistem arka plan kısıtı: kullanıcı kısıtlamış ya da uygulama `rare`/`restricted` kovasında. */
  restricted: boolean;
  risk: DeliveryRisk;
  /** Kullanıcının açması önerilen ayar ekranları (önem sırasıyla; öneri yoksa boş). */
  recommendedSettings: DeliverySetting[];
}

/** `Pushizo.Delivery.showGuidance` seçenekleri. */
export interface DeliveryGuidanceOptions {
  /** Kullanıcı kabul edince açılacak ekran (varsayılan `auto`). */
  setting?: DeliverySetting;
  /** SDK'nın yerelleştirilmiş metni yerine gösterilecek açıklama. */
  message?: string;
}
