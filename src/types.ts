/** Günlük seviyeleri (yerel SDK `HsLog.Level` / `HSLog.Level` ile aynı sırada). */
export const LogLevel = {
  None: 'none',
  Error: 'error',
  Warn: 'warn',
  Info: 'info',
  Debug: 'debug',
} as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/** `HeroSignal.initialize` seçenekleri. */
export interface InitializeOptions {
  /** HeroSignal API adresi (kendi barındırma için). Varsayılan `https://api.herosignal.dev`. */
  apiUrl?: string;
  /** KVKK/GDPR: true ise `setConsentGiven(true)` çağrılana kadar hiçbir ağ çağrısı yapılmaz. */
  requiresPrivacyConsent?: boolean;
  /** Başlangıç günlük seviyesi (varsayılan `warn`). */
  logLevel?: LogLevel;
  /** iOS: Notification Service Extension ile paylaşılan App Group (ör. `group.com.example.app`). */
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

/** `Inbox.list` seçenekleri. */
export interface InboxListOptions {
  /** 1-200 (varsayılan 50). */
  limit?: number;
  /** Önceki sayfanın `nextCursor` değeri. */
  cursor?: string | null;
}

/** Yerel olay adları (NativeEventEmitter). Yerel köprülerdeki sabitlerle aynı olmalıdır. */
export const NativeEvents = {
  Click: 'HeroSignal-notificationClick',
  ForegroundWillDisplay: 'HeroSignal-notificationWillDisplay',
  PermissionChange: 'HeroSignal-permissionChange',
  PushSubscriptionChange: 'HeroSignal-pushSubscriptionChange',
  InAppClick: 'HeroSignal-inAppClick',
  InAppLifecycle: 'HeroSignal-inAppLifecycle',
} as const;
export type NativeEventName = (typeof NativeEvents)[keyof typeof NativeEvents];
