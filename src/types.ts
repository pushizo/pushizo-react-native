/** SDK günlük düzeyi (native SDK'lara iletilir). */
export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

/** `HeroSignal.initialize` seçenekleri. Platforma özgü alanlar diğer platformda yok sayılır. */
export interface InitializeOptions {
  /** HeroSignal API adresi (varsayılan `https://api.herosignal.dev`). */
  apiUrl?: string;
  /** KVKK/GDPR: `setConsentGiven(true)` çağrılana kadar hiçbir ağ çağrısı yapılmaz. */
  requiresPrivacyConsent?: boolean;
  /** Varsayılan `warn`. */
  logLevel?: LogLevel;
  /** iOS: sessiz (provisional) bildirim izni ister. */
  provisionalAuthorization?: boolean;
  /** iOS: Notification Service Extension ile paylaşılan App Group (yoksa Info.plist `HeroSignalAppGroup`). */
  appGroup?: string;
  /** iOS: APNs ortamını zorlar; verilmezse provisioning profilinden tespit edilir. */
  apnsEnvironment?: 'sandbox' | 'production';
  /** Android 8+: varsayılan bildirim kanalı adı. */
  androidDefaultChannelName?: string;
  /** Android 8+: varsayılan bildirim kanalı kimliği. */
  androidDefaultChannelId?: string;
}

/** Bildirim düğmesi. */
export interface NotificationAction {
  id: string;
  title: string;
  url: string | null;
}

/** Native SDK'nın ayrıştırdığı HeroSignal bildirimi. */
export interface HeroSignalNotification {
  title: string | null;
  body: string | null;
  url: string | null;
  imageUrl: string | null;
  /** Teslimat kimliği (`received`/`opened` takibi; iOS'ta `removeNotification` ile de kullanılabilir). */
  deliveryId: string | null;
  messageId: string | null;
  /** Gruplama anahtarı (Android `hs_group`, iOS `thread-id`); `removeGroupedNotifications` ile kullanılır. */
  groupKey: string | null;
  /** Android: sistem bildirim kimliği (`removeNotification`). iOS'ta her zaman null. */
  androidNotificationId: number | null;
  actions: NotificationAction[];
  /** Mesajın özel veri alanları (`data`). */
  data: Record<string, string>;
}

/** Bildirim tıklaması (plan 06 §6.1: `{ notification, result: { actionId, url } }`). */
export interface NotificationClickEvent {
  notification: HeroSignalNotification;
  result: {
    /** Tıklanan düğmenin kimliği; bildirimin kendisine tıklandıysa null. */
    actionId: string | null;
    /** Açılacak adres (düğme URL'si, yoksa bildirim URL'si). */
    url: string | null;
  };
}

/** Push aboneliği durumu. */
export interface PushSubscriptionState {
  id: string | null;
  token: string | null;
  optedIn: boolean;
  /** Sistem bildirim izni verildi mi. */
  permission: boolean;
}

/** Abonelik değişimi: önceki ve güncel durum. */
export interface PushSubscriptionChangedState {
  previous: PushSubscriptionState;
  current: PushSubscriptionState;
}

/** In-app mesaj tıklaması. */
export interface InAppMessageClickEvent {
  messageId: string;
  result: {
    actionId: string;
    url: string | null;
  };
}

export type InAppLifecycleEventName = 'willDisplay' | 'didDisplay' | 'willDismiss' | 'didDismiss';

/** In-app yaşam döngüsü olayı. */
export interface InAppLifecycleEvent {
  messageId: string;
}

/** In-app yaşam döngüsü dinleyicisi; tüm geri çağrılar isteğe bağlıdır. */
export interface InAppLifecycleListener {
  onWillDisplay?: (event: InAppLifecycleEvent) => void;
  onDidDisplay?: (event: InAppLifecycleEvent) => void;
  onWillDismiss?: (event: InAppLifecycleEvent) => void;
  onDidDismiss?: (event: InAppLifecycleEvent) => void;
}

/** Bildirim kutusu öğesi; zaman alanları epoch milisaniyedir. */
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

/** Bildirim kutusu sayfası. */
export interface InboxPage {
  items: InboxItem[];
  unreadCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

/** `Session.sendEvent` özellik değeri (JSON uyumlu). */
export type EventPropertyValue =
  | string
  | number
  | boolean
  | null
  | EventPropertyValue[]
  | { [key: string]: EventPropertyValue };

/** Dinleyici kaydı; `remove()` dinleyiciyi kaldırır. */
export interface HeroSignalSubscription {
  remove(): void;
}

/** Native tarafın döndürdüğü hata kodları (`error.code`). */
export type HeroSignalErrorCode =
  | 'INVALID_ARGUMENT'
  | 'NOT_READY'
  | 'NOT_INITIALIZED'
  | 'HS_ERROR'
  | (string & {});
