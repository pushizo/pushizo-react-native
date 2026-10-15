import { EventHub } from './events';
import {
  type RawMap,
  toInboxItem,
  toInboxPage,
  toNotification,
  toStringArray,
  toStringMap,
  toSubscriptionState,
  toUserPreferences,
} from './mappers';
import { nativeModule } from './native';
import {
  type InAppMessageClickEvent,
  type InAppMessageLifecycleEvent,
  type InboxItem,
  type InboxListOptions,
  type InboxPage,
  type InitializeOptions,
  type LiveActivityValue,
  LogLevel,
  type LoginOptions,
  type NotificationClickEvent,
  type NotificationData,
  NativeEvents,
  type PermissionChangeEvent,
  type PreferenceChannel,
  PreferenceChannels,
  type PreferenceInput,
  type PushSubscriptionChangedState,
  type UserPreferences,
} from './types';

const LOG_LEVELS: readonly string[] = Object.values(LogLevel);

function requireNonEmpty(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`HeroSignal: ${name} boş olmayan bir metin olmalı.`);
  }
  return value;
}

function requireStringMap(value: unknown, name: string): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`HeroSignal: ${name} bir nesne olmalı.`);
  }
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== 'string') throw new TypeError(`HeroSignal: ${name}.${key} metin olmalı.`);
  }
  return value as Record<string, string>;
}

function requireStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new TypeError(`HeroSignal: ${name} metin dizisi olmalı.`);
  }
  return value as string[];
}

const MAX_PREFERENCES = 100;
const MAX_CATEGORY_LENGTH = 64;

/** Yerel SDK doğrulamasıyla aynı kurallar: 1-100 kayıt, kategori 1-64 karakter, kanal bilinen anahtar veya `null`. */
function requirePreferenceInputs(value: unknown): Array<{ category: string; channel: PreferenceChannel | null; optedIn: boolean }> {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PREFERENCES) {
    throw new TypeError(`HeroSignal: preferences 1-${MAX_PREFERENCES} kayıtlı bir dizi olmalı.`);
  }
  return value.map((item: unknown, index) => {
    const name = `preferences[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError(`HeroSignal: ${name} bir nesne olmalı.`);
    const { category, channel, optedIn } = item as Record<string, unknown>;
    if (typeof category !== 'string' || category.trim() === '' || category.length > MAX_CATEGORY_LENGTH) {
      throw new TypeError(`HeroSignal: ${name}.category 1-${MAX_CATEGORY_LENGTH} karakterlik bir metin olmalı.`);
    }
    if (channel !== undefined && channel !== null && !(PreferenceChannels as readonly unknown[]).includes(channel)) {
      throw new TypeError(`HeroSignal: ${name}.channel geçersiz; ${PreferenceChannels.join(', ')} veya null olmalı.`);
    }
    if (typeof optedIn !== 'boolean') throw new TypeError(`HeroSignal: ${name}.optedIn mantıksal değer olmalı.`);
    return { category, channel: (channel ?? null) as PreferenceChannel | null, optedIn };
  });
}

/** Live Activity etkinlik kimliği: iOS SDK ve sunucu `start` kuralı (1-100 karakter; harf, rakam ve `_ . : -`). */
const LIVE_ACTIVITY_ID = /^[A-Za-z0-9_.:-]{1,100}$/;
const MAX_LIVE_ACTIVITY_KEY_LENGTH = 64;
/** Sunucunun uzaktan başlatmada `attributes` içine eklediği ayrılmış anahtar. */
const RESERVED_LIVE_ACTIVITY_KEY = 'herosignal';

function requireLiveActivityId(value: unknown): string {
  if (typeof value !== 'string' || !LIVE_ACTIVITY_ID.test(value)) {
    throw new TypeError('HeroSignal: activityId 1-100 karakter olmalı (harf, rakam ve _ . : -).');
  }
  return value;
}

/** Düz nesne; anahtar 1-64 karakter, değer metin / sonlu sayı / mantıksal (yerel SDK ile aynı kurallar). */
function requireLiveActivityValues(value: unknown, name: string, reservedKey?: string): Record<string, LiveActivityValue> {
  const proto: unknown = value !== null && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
  if (Array.isArray(value) || (proto !== Object.prototype && proto !== null)) {
    throw new TypeError(`HeroSignal: ${name} düz bir nesne olmalı.`);
  }
  const out: Record<string, LiveActivityValue> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key.length < 1 || key.length > MAX_LIVE_ACTIVITY_KEY_LENGTH) {
      throw new TypeError(`HeroSignal: ${name} anahtarları 1-${MAX_LIVE_ACTIVITY_KEY_LENGTH} karakter olmalı.`);
    }
    if (key === reservedKey) throw new TypeError(`HeroSignal: ${name} içinde '${reservedKey}' anahtarı ayrılmıştır.`);
    if (typeof item !== 'string' && typeof item !== 'boolean' && !(typeof item === 'number' && Number.isFinite(item))) {
      throw new TypeError(`HeroSignal: ${name}.${key} metin, sonlu sayı veya mantıksal değer olmalı.`);
    }
    out[key] = item;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Ön plan bildirimleri
// ---------------------------------------------------------------------------------------------------------------------

/** Ön planda gelen bildirim; `display()` ertelenmiş gösterimi yapar (yalnızca bir kez). */
export class DisplayableNotification implements NotificationData {
  readonly title: string | null;
  readonly body: string | null;
  readonly url: string | null;
  readonly imageUrl: string | null;
  readonly deliveryId: string | null;
  readonly messageId: string | null;
  readonly data: Record<string, string>;
  readonly androidNotificationId: number | null;

  constructor(
    /** Köprü içi olay kimliği (ön plan kararını yerel olayla eşler). */
    readonly notificationId: string,
    data: NotificationData,
  ) {
    this.title = data.title;
    this.body = data.body;
    this.url = data.url;
    this.imageUrl = data.imageUrl;
    this.deliveryId = data.deliveryId;
    this.messageId = data.messageId;
    this.data = data.data;
    this.androidNotificationId = data.androidNotificationId;
  }

  /** Bildirimi gösterir; `preventDefault()` sonrası en geç 25 sn içinde çağrılmalıdır. */
  display(): void {
    nativeModule().displayNotification(this.notificationId);
  }
}

/**
 * Uygulama ön plandayken gelen bildirim. Dinleyici `preventDefault()` çağırmazsa bildirim gösterilir; çağırırsa
 * gösterilmez, ancak asenkron bir karardan sonra `getNotification().display()` ile yine gösterilebilir.
 */
export class NotificationWillDisplayEvent {
  readonly notification: DisplayableNotification;
  private prevented = false;

  constructor(notification: DisplayableNotification) {
    this.notification = notification;
  }

  preventDefault(): void {
    this.prevented = true;
  }

  get isPrevented(): boolean {
    return this.prevented;
  }

  getNotification(): DisplayableNotification {
    return this.notification;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Olay kanalları
// ---------------------------------------------------------------------------------------------------------------------

type ClickPayload = { notification?: RawMap; actionId?: string | null; url?: string | null };
type ForegroundPayload = { notificationId: string; notification?: RawMap };
type SubscriptionPayload = { previous?: RawMap; current?: RawMap };
type InAppLifecyclePayload = { event: string; messageId: string };

/** Son bilinen izin (olaylar ve izin sorguları ile güncellenir). */
let lastPermission = false;

const clickHub = new EventHub<ClickPayload, NotificationClickEvent>(NativeEvents.Click, (p) => ({
  notification: toNotification(p.notification),
  result: { actionId: p.actionId ?? null, url: p.url ?? null },
}));

const foregroundHub = new EventHub<ForegroundPayload, NotificationWillDisplayEvent>(
  NativeEvents.ForegroundWillDisplay,
  (p) => new NotificationWillDisplayEvent(new DisplayableNotification(p.notificationId, toNotification(p.notification))),
  {
    // Yerel SDK yalnızca JS dinleyicisi varken kararı JS'e bırakır; yoksa bildirimi kendisi gösterir.
    onFirst: () => nativeModule().setForegroundHandlerEnabled(true),
    onLast: () => nativeModule().setForegroundHandlerEnabled(false),
    onEvent: (event) => {
      if (event.isPrevented) nativeModule().preventDefault(event.notification.notificationId);
      else nativeModule().displayNotification(event.notification.notificationId);
    },
  },
);

const permissionHub = new EventHub<{ permission: boolean }, PermissionChangeEvent>(
  NativeEvents.PermissionChange,
  (p) => ({ permission: p.permission === true }),
  { onEvent: (event) => (lastPermission = event.permission) },
);

const subscriptionHub = new EventHub<SubscriptionPayload, PushSubscriptionChangedState>(
  NativeEvents.PushSubscriptionChange,
  (p) => ({ previous: toSubscriptionState(p.previous), current: toSubscriptionState(p.current) }),
);

const inAppClickHub = new EventHub<InAppMessageClickEvent, InAppMessageClickEvent>(NativeEvents.InAppClick, (p) => ({
  messageId: p.messageId,
  actionId: p.actionId,
  url: p.url ?? null,
}));

type InAppLifecycleName = 'willDisplay' | 'didDisplay' | 'willDismiss' | 'didDismiss';
const inAppLifecycleListeners: Record<InAppLifecycleName, Set<(e: InAppMessageLifecycleEvent) => void>> = {
  willDisplay: new Set(),
  didDisplay: new Set(),
  willDismiss: new Set(),
  didDismiss: new Set(),
};
const inAppLifecycleHub = new EventHub<InAppLifecyclePayload, InAppLifecyclePayload>(NativeEvents.InAppLifecycle, (p) => p, {
  onEvent: (p) => {
    const listeners = inAppLifecycleListeners[p.event as InAppLifecycleName];
    if (!listeners) return;
    for (const listener of Array.from(listeners)) {
      try {
        listener({ messageId: p.messageId });
      } catch (error) {
        console.error(`[HeroSignal] in-app '${p.event}' dinleyicisi hata verdi`, error);
      }
    }
  },
});
/** İzin önbelleği için izin olayı bir kez (initialize'da) içeride dinlenir. */
let permissionRetained = false;

// ---------------------------------------------------------------------------------------------------------------------
// Genel API (eski sağlayıcı v5 React Native yüzeyi ile uyumlu)
// ---------------------------------------------------------------------------------------------------------------------

export interface NotificationEventMap {
  click: NotificationClickEvent;
  foregroundWillDisplay: NotificationWillDisplayEvent;
  permissionChange: PermissionChangeEvent;
}

export interface InAppEventMap {
  click: InAppMessageClickEvent;
  willDisplay: InAppMessageLifecycleEvent;
  didDisplay: InAppMessageLifecycleEvent;
  willDismiss: InAppMessageLifecycleEvent;
  didDismiss: InAppMessageLifecycleEvent;
}

/** Yaşam döngüsü alt olayının dinleyici kümesi; bilinmeyen ad (tip dışı çağrı) için `undefined`. */
function lifecycleListenersFor(event: string): Set<(e: InAppMessageLifecycleEvent) => void> | undefined {
  return Object.prototype.hasOwnProperty.call(inAppLifecycleListeners, event)
    ? inAppLifecycleListeners[event as InAppLifecycleName]
    : undefined;
}

const notificationHubs = {
  click: clickHub,
  foregroundWillDisplay: foregroundHub,
  permissionChange: permissionHub,
} as const;

const PushSubscription = {
  /** Abonelik kimliği (henüz kaydedilmediyse `null`). */
  async getIdAsync(): Promise<string | null> {
    return toSubscriptionState((await nativeModule().getPushSubscriptionState()) as RawMap).id;
  },
  /** FCM / APNs token'ı. */
  async getTokenAsync(): Promise<string | null> {
    return toSubscriptionState((await nativeModule().getPushSubscriptionState()) as RawMap).token;
  },
  /** Kullanıcı push almayı kabul etti mi (opt-in ve sistem izni). */
  async getOptedInAsync(): Promise<boolean> {
    return toSubscriptionState((await nativeModule().getPushSubscriptionState()) as RawMap).optedIn;
  },
  optIn(): void {
    nativeModule().optIn();
  },
  optOut(): void {
    nativeModule().optOut();
  },
  /** Token / opt-in / izin değişimi. */
  addEventListener(event: 'change', listener: (state: PushSubscriptionChangedState) => void): void {
    if (event !== 'change') throw new TypeError(`HeroSignal: bilinmeyen push aboneliği olayı '${String(event)}'.`);
    subscriptionHub.add(listener);
  },
  removeEventListener(event: 'change', listener: (state: PushSubscriptionChangedState) => void): void {
    if (event === 'change') subscriptionHub.remove(listener);
  },
};

const User = {
  pushSubscription: PushSubscription,

  addTag(key: string, value: string): Promise<void> {
    requireNonEmpty(key, 'key');
    return User.addTags({ [key]: value });
  },
  addTags(tags: Record<string, string>): Promise<void> {
    return nativeModule().addTags(requireStringMap(tags, 'tags'));
  },
  removeTag(key: string): Promise<void> {
    return User.removeTags([requireNonEmpty(key, 'key')]);
  },
  removeTags(keys: string[]): Promise<void> {
    return nativeModule().removeTags(requireStringArray(keys, 'keys'));
  },
  /** Cihazda bilinen (sunucuyla son eşitlenen) tag'ler. */
  async getTags(): Promise<Record<string, string>> {
    return toStringMap(await nativeModule().getTags());
  },
  /** Kullanıcı dili (ISO 639-1, ör. `tr`). */
  setLanguage(code: string): Promise<void> {
    return nativeModule().setLanguage(requireNonEmpty(code, 'code'));
  },
  /** Alias ekler (etiket: küçük harf, rakam, `_`; `external_id` login ile yönetilir). */
  addAlias(label: string, id: string): Promise<void> {
    requireNonEmpty(label, 'label');
    return User.addAliases({ [label]: requireNonEmpty(id, 'id') });
  },
  /** Birden çok alias'ı tek istekte ekler (en fazla 20). */
  addAliases(aliases: Record<string, string>): Promise<void> {
    return nativeModule().addAliases(requireStringMap(aliases, 'aliases'));
  },
  removeAlias(label: string): Promise<void> {
    return nativeModule().removeAlias(requireNonEmpty(label, 'label'));
  },
  /** E-posta aboneliği ekler; geçersiz adreste `INVALID_ARGUMENT` koduyla reddedilir. */
  addEmail(email: string): Promise<void> {
    return nativeModule().addEmail(requireNonEmpty(email, 'email'));
  },
  removeEmail(email: string): Promise<void> {
    return nativeModule().removeEmail(requireNonEmpty(email, 'email'));
  },
  /** SMS aboneliği ekler; numara E.164'e normalize edilir. Geçersizse `INVALID_ARGUMENT`. */
  addSms(phoneNumber: string): Promise<void> {
    return nativeModule().addSms(requireNonEmpty(phoneNumber, 'phoneNumber'));
  },
  removeSms(phoneNumber: string): Promise<void> {
    return nativeModule().removeSms(requireNonEmpty(phoneNumber, 'phoneNumber'));
  },
  getExternalId(): Promise<string | null> {
    return nativeModule().getExternalId();
  },
  /** HeroSignal kullanıcı kimliği (`hs_id`). */
  getHeroSignalId(): Promise<string | null> {
    return nativeModule().getUserId();
  },
  /** Bu cihazda `addEmail` ile kaydedilmiş e-posta adresleri (yerel kayıt; sunucu sorgulanmaz). */
  async getEmails(): Promise<string[]> {
    return toStringArray(await nativeModule().getEmails());
  },
  /** Bu cihazda `addSms` ile kaydedilmiş SMS numaraları (E.164; yerel kayıt). */
  async getSmsNumbers(): Promise<string[]> {
    return toStringArray(await nativeModule().getSmsNumbers());
  },
  /**
   * Kullanıcının kategori/kanal tercihleri ve app'in mesaj kategorileri (ADR-0019 §4); sahiplik kanıtı yerel SDK'da
   * eklenir. Abonelik henüz kaydedilmediyse `NOT_READY` koduyla reddedilir.
   */
  async getPreferences(): Promise<UserPreferences> {
    return toUserPreferences((await nativeModule().getPreferences()) as RawMap);
  },
  /** Tercihleri yazar (1-100 kayıt; `channel` verilmezse tüm kanallar); güncel tercihleri döndürür. */
  setPreferences(preferences: PreferenceInput[]): Promise<UserPreferences> {
    const inputs = requirePreferenceInputs(preferences);
    return nativeModule()
      .setPreferences(inputs)
      .then((raw) => toUserPreferences(raw as RawMap));
  },
};

const Notifications = {
  /** Sistem bildirim iznini ister; sonuç izin verildi mi. */
  async requestPermission(): Promise<boolean> {
    const granted = (await nativeModule().requestPermission()) === true;
    lastPermission = granted;
    return granted;
  },
  /** Bildirim izni (sistemden sorgulanır). */
  async getPermissionAsync(): Promise<boolean> {
    lastPermission = (await nativeModule().getPermission()) === true;
    return lastPermission;
  },
  /** Son bilinen izin durumu (`initialize`, izin sorgusu ve `permissionChange` olaylarıyla güncellenir). */
  get permission(): boolean {
    return lastPermission;
  },
  /** Bildirim merkezindeki HeroSignal bildirimlerini kaldırır (iOS'ta rozet de sıfırlanır). */
  clearAll(): void {
    nativeModule().clearAll();
  },
  /**
   * Tek bildirimi kaldırır. Android: `notification.androidNotificationId` (tamsayı); iOS: bildirim isteği kimliği
   * (`UNNotificationRequest.identifier`, metin). Android'de tamsayıya çevrilemeyen kimlik `INVALID_ARGUMENT` ile reddedilir.
   */
  removeNotification(id: number | string): Promise<void> {
    if (typeof id === 'number') {
      if (!Number.isInteger(id)) throw new TypeError('HeroSignal: androidNotificationId tamsayı olmalı.');
      return nativeModule().removeNotification(String(id));
    }
    return nativeModule().removeNotification(requireNonEmpty(id, 'id'));
  },
  /** Aynı gruptaki bildirimleri kaldırır (Android `android_group`, iOS `thread-id`). */
  removeGroupedNotifications(group: string): Promise<void> {
    return nativeModule().removeGroupedNotifications(requireNonEmpty(group, 'group'));
  },
  addEventListener<K extends keyof NotificationEventMap>(event: K, listener: (e: NotificationEventMap[K]) => void): void {
    const hub = notificationHubs[event] as unknown as EventHub<unknown, NotificationEventMap[K]> | undefined;
    if (!hub) throw new TypeError(`HeroSignal: bilinmeyen bildirim olayı '${String(event)}'.`);
    hub.add(listener);
  },
  removeEventListener<K extends keyof NotificationEventMap>(event: K, listener: (e: NotificationEventMap[K]) => void): void {
    const hub = notificationHubs[event] as unknown as EventHub<unknown, NotificationEventMap[K]> | undefined;
    hub?.remove(listener);
  },
};

const InAppMessages = {
  addTrigger(key: string, value: string): Promise<void> {
    requireNonEmpty(key, 'key');
    return InAppMessages.addTriggers({ [key]: value });
  },
  /** Tetik koşulları (anahtar 1-64, değer en fazla 200 karakter); uygun mesaj varsa hemen gösterilir. */
  addTriggers(triggers: Record<string, string>): Promise<void> {
    return nativeModule().addTriggers(requireStringMap(triggers, 'triggers'));
  },
  removeTrigger(key: string): void {
    InAppMessages.removeTriggers([requireNonEmpty(key, 'key')]);
  },
  removeTriggers(keys: string[]): void {
    nativeModule().removeTriggers(requireStringArray(keys, 'keys'));
  },
  clearTriggers(): void {
    nativeModule().clearTriggers();
  },
  async getTriggers(): Promise<Record<string, string>> {
    return toStringMap(await nativeModule().getTriggers());
  },
  /** Geçerli ekran adı (`screen` tetikleri); ekrandan çıkarken `null`. */
  setScreen(name: string | null): void {
    nativeModule().setScreen(name && name.trim() !== '' ? name : null);
  },
  /** true iken yeni mesaj gösterilmez (tetikler kaydedilmeye devam eder). */
  setPaused(paused: boolean): void {
    nativeModule().setInAppPaused(paused === true);
  },
  async getPaused(): Promise<boolean> {
    return (await nativeModule().getInAppPaused()) === true;
  },
  addEventListener<K extends keyof InAppEventMap>(event: K, listener: (e: InAppEventMap[K]) => void): void {
    if (event === 'click') {
      inAppClickHub.add(listener);
      return;
    }
    const set = lifecycleListenersFor(event);
    if (!set) throw new TypeError(`HeroSignal: bilinmeyen in-app olayı '${String(event)}'.`);
    // Yaşam döngüsü kanalı, herhangi bir alt olay dinlenirken açık tutulur (tek yerel abonelik).
    const typed = listener as (e: InAppMessageLifecycleEvent) => void;
    if (set.has(typed)) return;
    set.add(typed);
    inAppLifecycleHub.retain();
  },
  removeEventListener<K extends keyof InAppEventMap>(event: K, listener: (e: InAppEventMap[K]) => void): void {
    if (event === 'click') {
      inAppClickHub.remove(listener);
      return;
    }
    const set = lifecycleListenersFor(event);
    if (!set) return;
    if (set.delete(listener as (e: InAppMessageLifecycleEvent) => void)) inAppLifecycleHub.release();
  },
};

const Inbox = {
  /** Öğeler (yeniden eskiye), okunmamış sayısı ve sonraki sayfa imleci. */
  async list(options: InboxListOptions = {}): Promise<InboxPage> {
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new RangeError('HeroSignal: limit 1-200 arası tam sayı olmalı.');
    return toInboxPage((await nativeModule().inboxList(limit, options.cursor ?? null)) as RawMap);
  },
  /** Okundu işaretler; güncel öğeyi döndürür. */
  async markRead(id: string): Promise<InboxItem> {
    return toInboxItem((await nativeModule().inboxMarkRead(requireNonEmpty(id, 'id'))) as RawMap);
  },
  /** Tümünü okundu işaretler; kalan okunmamış sayısını döndürür. */
  markAllRead(): Promise<number> {
    return nativeModule().inboxMarkAllRead();
  },
  /** Öğeyi kutudan kaldırır (arşivler). */
  archive(id: string): Promise<void> {
    return nativeModule().inboxArchive(requireNonEmpty(id, 'id'));
  },
  unreadCount(): Promise<number> {
    return nativeModule().inboxUnreadCount();
  },
};

const Session = {
  /** Özel olay / outcome; adı in-app `event` tetiklerini de çalıştırır. */
  sendEvent(name: string, properties: Record<string, unknown> = {}, value?: number): void {
    requireNonEmpty(name, 'name');
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new TypeError('HeroSignal: value sonlu bir sayı olmalı.');
    }
    nativeModule().sendEvent(name, properties ?? {}, value ?? null);
  },
};

/**
 * iOS Live Activities (ADR-0024; iOS 16.1+). Köprü, genel `HeroSignalDefaultLiveActivityAttributes` türünü kullanır;
 * widget extension'da bu türle `ActivityConfiguration` tanımlanmalı ve sunucuda tür adı aynen kaydedilmelidir.
 * Android'de çağrılar `PLATFORM_NOT_SUPPORTED` koduyla reddedilir.
 */
const LiveActivities = {
  /**
   * Genel türü izlemeye alır: push-to-start belirteci (iOS 17.2+) ve başlayan her etkinliğin güncelleme belirteci
   * sunucuya kaydedilir. `initialize`'dan sonra, uygulama her açıldığında çağrılmalıdır.
   */
  setupDefaultLiveActivity(): Promise<void> {
    return nativeModule().setupDefaultLiveActivity();
  },
  /**
   * Genel türle yerel bir etkinlik başlatır (iOS 16.1+); sunucu sonraki `update`/`end` çağrılarını `activityId` ile
   * yapar. `attributes` içinde `herosignal` anahtarı ayrılmıştır.
   */
  startDefaultLiveActivity(
    activityId: string,
    attributes: Record<string, LiveActivityValue>,
    contentState: Record<string, LiveActivityValue>,
  ): Promise<void> {
    return nativeModule().startDefaultLiveActivity(
      requireLiveActivityId(activityId),
      requireLiveActivityValues(attributes, 'attributes', RESERVED_LIVE_ACTIVITY_KEY),
      requireLiveActivityValues(contentState, 'contentState'),
    );
  },
};

/**
 * Konum paylaşımı (v2 Faz 17b; yalnızca ön plan, arka plan konumu yok). Paylaşım açık ve izin verilmişken yerel SDK,
 * oturum başında ve uygulama ön plana döndüğünde en sık 5 dakikada bir konumu push aboneliğine yazar. İzin yoksa veya
 * gizlilik onayı verilmemişse hiçbir şey gönderilmez. İlk konum sunucuda KVKK açık rıza kaydı sayılır.
 */
const Location = {
  /** Paylaşımı açar/kapatır (kalıcı tercih). `false` sunucudaki konumu ve rıza kaydını sildirir. */
  setShared(shared: boolean): void {
    nativeModule().setLocationShared(shared === true);
  },
  /** Paylaşım açık mı (kalıcı tercih; izin durumundan bağımsız). */
  async isShared(): Promise<boolean> {
    return (await nativeModule().isLocationShared()) === true;
  },
  /**
   * Önce açıklama diyaloğu (`rationale`, verilmezse SDK'nın tr/en varsayılan metni), kullanıcı devam ederse sistem konum
   * izni ("kullanırken"). Sonuç: izin var mı / verildi mi. Android'de manifest'te konum izni yoksa `false`; ön planda
   * Activity yoksa `NO_ACTIVITY` koduyla reddedilir.
   */
  async requestPermission(rationale?: string): Promise<boolean> {
    if (rationale !== undefined && rationale !== null && typeof rationale !== 'string') {
      throw new TypeError('HeroSignal: rationale metin olmalı.');
    }
    const text = typeof rationale === 'string' && rationale.trim() !== '' ? rationale : null;
    return (await nativeModule().requestLocationPermission(text)) === true;
  },
};

const Debug = {
  setLogLevel(level: LogLevel): void {
    if (!LOG_LEVELS.includes(level)) throw new TypeError(`HeroSignal: geçersiz günlük seviyesi '${String(level)}'.`);
    nativeModule().setLogLevel(level);
  },
};

/**
 * HeroSignal React Native SDK. Android/iOS yerel SDK'larını sarar; kuyruk, oturum, teslimat geri bildirimi ve in-app
 * çizimi yerel SDK'dadır.
 *
 * ```ts
 * HeroSignal.initialize('app_…', { apiUrl: 'https://api.example.com' });
 * await HeroSignal.Notifications.requestPermission();
 * HeroSignal.login('user_42');
 * HeroSignal.User.addTag('plan', 'pro');
 * HeroSignal.Notifications.addEventListener('click', (e) => console.log(e.result.url));
 * ```
 */
export const HeroSignal = {
  /** SDK'yı başlatır; aynı appId ile tekrar çağrı yerel SDK'yı yeniden kurmaz. */
  async initialize(appId: string, options: InitializeOptions = {}): Promise<void> {
    requireNonEmpty(appId, 'appId');
    if (options.logLevel !== undefined && !LOG_LEVELS.includes(options.logLevel)) {
      throw new TypeError(`HeroSignal: geçersiz günlük seviyesi '${String(options.logLevel)}'.`);
    }
    const native: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(options)) if (value !== undefined) native[key] = value;
    await nativeModule().initialize(appId, native);
    // İzin önbelleği her zaman güncel kalsın diye izin olayı içeride dinlenir.
    if (!permissionRetained) {
      permissionRetained = true;
      permissionHub.retain();
    }
    lastPermission = (await nativeModule().getPermission()) === true;
  },

  /**
   * Anonim kullanıcıyı kimlikli kullanıcıya bağlar. Identity verification açıksa app moduna göre `identityHash`
   * (eski imza: ikinci argüman metin) ve/veya JWT gerekir: `login(id, { jwt })`.
   */
  login(externalId: string, proof?: string | LoginOptions): Promise<void> {
    const options: LoginOptions = typeof proof === 'string' ? { identityHash: proof } : (proof ?? {});
    if (options.jwt !== undefined) requireNonEmpty(options.jwt, 'jwt');
    return nativeModule().login(
      requireNonEmpty(externalId, 'externalId'),
      options.identityHash ?? null,
      options.jwt ?? null,
    );
  },
  /** Süresi dolan kimlik JWT'sini yeniler (giriş yapmış kullanıcı için); sonraki SDK istekleri yeni belirteci taşır. */
  updateUserJwt(jwt: string): Promise<void> {
    return nativeModule().updateUserJwt(requireNonEmpty(jwt, 'jwt'));
  },
  /** Kullanıcıyı anonim kullanıcıya döndürür; kimlik JWT'si cihazdan silinir. */
  logout(): void {
    nativeModule().logout();
  },
  /** `requiresPrivacyConsent` ile başlatıldıysa onay verilene kadar ağ çağrısı yapılmaz; `false` yerel kimliği temizler. */
  setConsentGiven(given: boolean): void {
    nativeModule().setConsentGiven(given === true);
  },

  User,
  Notifications,
  InAppMessages,
  Inbox,
  Session,
  LiveActivities,
  Location,
  Debug,
};
