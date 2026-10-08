import type { EmitterSubscription } from 'react-native';
import { addNativeListener, nativeModule, NativeEvents } from './native';
import type { NativeEventName } from './native';
import type {
  EventPropertyValue,
  HeroSignalNotification,
  HeroSignalSubscription,
  InAppLifecycleEvent,
  InAppLifecycleEventName,
  InAppLifecycleListener,
  InAppMessageClickEvent,
  InboxItem,
  InboxPage,
  InitializeOptions,
  LogLevel,
  NotificationAction,
  NotificationClickEvent,
  PushSubscriptionChangedState,
  PushSubscriptionState,
} from './types';

/** SDK hatası; `code` native tarafın hata kodudur (ör. `INVALID_ARGUMENT`). */
export class HeroSignalError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'HeroSignalError';
    this.code = code;
  }
}

const LOG_LEVELS: readonly LogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];

// --- Native yük ayrıştırma (savunmacı: eksik alanlar null olur) ---

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(asRecord(value))) {
    if (typeof v === 'string') out[key] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[key] = String(v);
  }
  return out;
}

export function parseNotification(value: unknown): HeroSignalNotification {
  const raw = asRecord(value);
  const actions: NotificationAction[] = Array.isArray(raw.actions)
    ? raw.actions
        .map(asRecord)
        .filter((a) => typeof a.id === 'string')
        .map((a) => ({ id: a.id as string, title: str(a.title) ?? '', url: str(a.url) }))
    : [];
  return {
    title: str(raw.title),
    body: str(raw.body),
    url: str(raw.url),
    imageUrl: str(raw.imageUrl),
    deliveryId: str(raw.deliveryId),
    messageId: str(raw.messageId),
    groupKey: str(raw.groupKey),
    androidNotificationId: num(raw.androidNotificationId),
    actions,
    data: stringMap(raw.data),
  };
}

export function parseSubscriptionState(value: unknown): PushSubscriptionState {
  const raw = asRecord(value);
  return {
    id: str(raw.id),
    token: str(raw.token),
    optedIn: raw.optedIn === true,
    permission: raw.permission === true,
  };
}

export function parseInboxItem(value: unknown): InboxItem {
  const raw = asRecord(value);
  return {
    id: str(raw.id) ?? '',
    messageId: str(raw.messageId),
    title: str(raw.title),
    body: str(raw.body),
    url: str(raw.url),
    imageUrl: str(raw.imageUrl),
    data: stringMap(raw.data),
    read: raw.read === true,
    readAt: num(raw.readAt),
    archivedAt: num(raw.archivedAt),
    expiresAt: num(raw.expiresAt),
    createdAt: num(raw.createdAt),
  };
}

export function parseInboxPage(value: unknown): InboxPage {
  const raw = asRecord(value);
  return {
    items: Array.isArray(raw.items) ? raw.items.map(parseInboxItem) : [],
    unreadCount: num(raw.unreadCount) ?? 0,
    nextCursor: str(raw.nextCursor),
    hasMore: raw.hasMore === true,
  };
}

/** Native Promise hatasını `HeroSignalError`'a çevirir. */
async function call<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    const err = asRecord(e);
    const code = str(err.code) ?? 'HS_ERROR';
    const message = str(err.message) ?? String(e);
    throw new HeroSignalError(code, message);
  }
}

// --- Doğrulama ---

function requireNonEmpty(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HeroSignalError('INVALID_ARGUMENT', `${name} boş olmayan bir metin olmalı.`);
  }
  return value;
}

/** Tag/trigger değerleri native tarafta metindir; sayı ve boolean metne çevrilir. */
function toStringRecord(values: Record<string, unknown>, name: string): Record<string, string> {
  if (values === null || typeof values !== 'object' || Array.isArray(values)) {
    throw new HeroSignalError('INVALID_ARGUMENT', `${name} bir nesne olmalı.`);
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    requireNonEmpty(key, `${name} anahtarı`);
    if (typeof value === 'string') out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = String(value);
    else if (typeof value === 'boolean') out[key] = String(value);
    else throw new HeroSignalError('INVALID_ARGUMENT', `${name}.${key} metin, sayı veya boolean olmalı.`);
  }
  return out;
}

function requireStringArray(keys: unknown, name: string): string[] {
  if (!Array.isArray(keys) || keys.some((k) => typeof k !== 'string')) {
    throw new HeroSignalError('INVALID_ARGUMENT', `${name} metin dizisi olmalı.`);
  }
  return keys as string[];
}

// --- Dinleyici kayıtları ---

/** Bir native olay kanalına bağlı JS dinleyici kümesi; ilk dinleyicide abone olur, sonuncusu gidince bırakır. */
class ListenerSet<T> {
  private readonly listeners = new Set<(event: T) => void>();
  private subscription: EmitterSubscription | null = null;

  constructor(
    private readonly event: NativeEventName,
    private readonly map: (payload: unknown) => T | null,
    private readonly hooks: { onChange?: (count: number) => void; afterDispatch?: (event: T) => void } = {},
  ) {}

  add(listener: (event: T) => void): HeroSignalSubscription {
    if (typeof listener !== 'function') throw new HeroSignalError('INVALID_ARGUMENT', 'Dinleyici bir fonksiyon olmalı.');
    this.listeners.add(listener);
    if (!this.subscription) {
      this.subscription = addNativeListener(this.event, (payload) => this.dispatch(payload));
    }
    this.hooks.onChange?.(this.listeners.size);
    return { remove: () => this.remove(listener) };
  }

  remove(listener: (event: T) => void): void {
    if (!this.listeners.delete(listener)) return;
    if (this.listeners.size === 0 && this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.hooks.onChange?.(this.listeners.size);
  }

  get size(): number {
    return this.listeners.size;
  }

  /** Dinleyicileri çağırır; bir dinleyicinin hatası diğerlerini engellemez. */
  dispatch(payload: unknown): T | null {
    const event = this.map(payload);
    if (event === null) return null;
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(event);
      } catch (e) {
        console.error('[HeroSignal] dinleyici hatası', e);
      }
    }
    this.hooks.afterDispatch?.(event);
    return event;
  }

  clear(): void {
    this.listeners.clear();
    this.subscription?.remove();
    this.subscription = null;
  }
}

/**
 * Ön planda gelen bildirim. Dinleyici `preventDefault()` çağırırsa bildirim gösterilmez; karar sonradan
 * verilecekse önce `preventDefault()`, ardından (iOS'ta en geç 25 sn içinde) `display()` çağrılır.
 */
export class NotificationWillDisplayEvent {
  readonly notification: HeroSignalNotification;
  private prevented = false;
  private displayed = false;

  constructor(
    private readonly eventId: string | null,
    notification: HeroSignalNotification,
  ) {
    this.notification = notification;
  }

  getNotification(): HeroSignalNotification {
    return this.notification;
  }

  get isPrevented(): boolean {
    return this.prevented;
  }

  preventDefault(): void {
    this.prevented = true;
  }

  /** Bildirimi şimdi gösterir (yalnızca bir kez). */
  display(): void {
    if (this.displayed || !this.eventId) return;
    this.displayed = true;
    nativeModule().displayNotification(this.eventId);
  }

  /** Dinleyiciler çalıştıktan sonra native tarafa karar bildirilir. */
  complete(): void {
    if (!this.eventId) return;
    const show = !this.prevented && !this.displayed;
    if (show) this.displayed = true;
    nativeModule().completeForegroundDisplay(this.eventId, show);
  }
}

// --- Durum ---

const EMPTY_STATE: PushSubscriptionState = { id: null, token: null, optedIn: false, permission: false };
let subscriptionState: PushSubscriptionState = EMPTY_STATE;
let consentRequired = false;
let inAppPaused = false;

const permissionObservers = new Set<(permission: boolean) => void>();

function updateSubscriptionState(next: PushSubscriptionState): PushSubscriptionChangedState {
  const previous = subscriptionState;
  subscriptionState = next;
  if (previous.permission !== next.permission) {
    for (const observer of Array.from(permissionObservers)) {
      try {
        observer(next.permission);
      } catch (e) {
        console.error('[HeroSignal] izin gözlemcisi hatası', e);
      }
    }
  }
  return { previous, current: next };
}

const clickListeners = new ListenerSet<NotificationClickEvent>(NativeEvents.notificationClick, (payload) => {
  const raw = asRecord(payload);
  return {
    notification: parseNotification(raw.notification),
    result: { actionId: str(raw.actionId), url: str(raw.url) },
  };
});

const foregroundListeners = new ListenerSet<NotificationWillDisplayEvent>(
  NativeEvents.notificationWillDisplay,
  (payload) => {
    const raw = asRecord(payload);
    return new NotificationWillDisplayEvent(str(raw.eventId), parseNotification(raw.notification));
  },
  {
    // Native taraf yalnızca JS dinleyicisi varken gösterimi erteler.
    onChange: (count) => nativeModule().setForegroundHandlerEnabled(count > 0),
    // Dinleyiciler çalıştıktan sonra gösterim kararı native tarafa bildirilir.
    afterDispatch: (event) => event.complete(),
  },
);

const subscriptionObservers = new ListenerSet<PushSubscriptionChangedState>(
  NativeEvents.pushSubscriptionChange,
  (payload) => updateSubscriptionState(parseSubscriptionState(payload)),
);

const inAppClickListeners = new ListenerSet<InAppMessageClickEvent>(NativeEvents.inAppClick, (payload) => {
  const raw = asRecord(payload);
  const messageId = str(raw.messageId);
  if (!messageId) return null;
  return { messageId, result: { actionId: str(raw.actionId) ?? '', url: str(raw.url) } };
});

const LIFECYCLE_METHODS: Record<InAppLifecycleEventName, keyof InAppLifecycleListener> = {
  willDisplay: 'onWillDisplay',
  didDisplay: 'onDidDisplay',
  willDismiss: 'onWillDismiss',
  didDismiss: 'onDidDismiss',
};

type RawLifecycle = { name: InAppLifecycleEventName; event: InAppLifecycleEvent };

const lifecycleListeners = new ListenerSet<RawLifecycle>(NativeEvents.inAppLifecycle, (payload) => {
  const raw = asRecord(payload);
  const name = str(raw.event) as InAppLifecycleEventName | null;
  const messageId = str(raw.messageId);
  if (!name || !(name in LIFECYCLE_METHODS) || !messageId) return null;
  return { name, event: { messageId } };
});
const lifecycleWrappers = new Map<InAppLifecycleListener, (e: RawLifecycle) => void>();

// Durum önbelleği için iç gözlemci: `pushSubscription.id/token/optedIn` ve `Notifications.permission`
// senkron okunabilsin diye abonelik olayları her zaman dinlenir.
let internalStateSubscription: EmitterSubscription | null = null;

function ensureStateTracking(): void {
  if (internalStateSubscription) return;
  internalStateSubscription = addNativeListener(NativeEvents.pushSubscriptionChange, (payload) => {
    // Kullanıcı gözlemcisi varsa durum onun eşlemesinde güncellenir (önceki/güncel doğru kalsın).
    if (subscriptionObservers.size === 0) updateSubscriptionState(parseSubscriptionState(payload));
  });
}

async function refreshSubscriptionState(): Promise<PushSubscriptionState> {
  const state = parseSubscriptionState(await call(nativeModule().getPushSubscriptionState()));
  updateSubscriptionState(state);
  return state;
}

// --- Public API ---

const pushSubscription = {
  /** Son bilinen abonelik kimliği (gözlemci olaylarıyla güncellenir); güncel değer için `getIdAsync()`. */
  get id(): string | null {
    return subscriptionState.id;
  },
  /** Son bilinen push token'ı (FCM / APNs). */
  get token(): string | null {
    return subscriptionState.token;
  },
  /** Son bilinen abonelik durumu (izin + opt-in). */
  get optedIn(): boolean {
    return subscriptionState.optedIn;
  },
  async getIdAsync(): Promise<string | null> {
    return (await refreshSubscriptionState()).id;
  },
  async getTokenAsync(): Promise<string | null> {
    return (await refreshSubscriptionState()).token;
  },
  async getOptedInAsync(): Promise<boolean> {
    return (await refreshSubscriptionState()).optedIn;
  },
  getStateAsync(): Promise<PushSubscriptionState> {
    return refreshSubscriptionState();
  },
  optIn(): void {
    nativeModule().optIn();
  },
  optOut(): void {
    nativeModule().optOut();
  },
  /** Token/durum değişimi gözlemcisi (`{ previous, current }`). */
  addObserver(observer: (state: PushSubscriptionChangedState) => void): HeroSignalSubscription {
    return subscriptionObservers.add(observer);
  },
  removeObserver(observer: (state: PushSubscriptionChangedState) => void): void {
    subscriptionObservers.remove(observer);
  },
};

const User = {
  addTag(key: string, value: string | number | boolean): void {
    User.addTags({ [requireNonEmpty(key, 'key')]: value });
  },
  addTags(tags: Record<string, string | number | boolean>): void {
    const values = toStringRecord(tags, 'tags');
    if (Object.keys(values).length === 0) return;
    nativeModule().addTags(values);
  },
  removeTag(key: string): void {
    User.removeTags([requireNonEmpty(key, 'key')]);
  },
  removeTags(keys: string[]): void {
    const list = requireStringArray(keys, 'keys');
    if (list.length === 0) return;
    nativeModule().removeTags(list);
  },
  /** Cihazda bilinen tag'ler (son sunucu yanıtı). */
  async getTags(): Promise<Record<string, string>> {
    return stringMap(await call(nativeModule().getTags()));
  },
  setLanguage(code: string): void {
    nativeModule().setLanguage(requireNonEmpty(code, 'code'));
  },
  addAlias(label: string, id: string): void {
    User.addAliases({ [requireNonEmpty(label, 'label')]: requireNonEmpty(id, 'id') });
  },
  addAliases(aliases: Record<string, string>): void {
    const values = toStringRecord(aliases, 'aliases');
    if (Object.keys(values).length === 0) return;
    nativeModule().addAliases(values);
  },
  removeAlias(label: string): void {
    nativeModule().removeAlias(requireNonEmpty(label, 'label'));
  },
  removeAliases(labels: string[]): void {
    requireStringArray(labels, 'labels').forEach((label) => User.removeAlias(label));
  },
  /** E-posta aboneliği ekler; geçersiz adreste `INVALID_ARGUMENT` ile reddedilir. Çevrimdışıyken kuyrukta bekler. */
  addEmail(email: string): Promise<void> {
    return call(nativeModule().addEmail(requireNonEmpty(email, 'email')));
  },
  removeEmail(email: string): Promise<void> {
    return call(nativeModule().removeEmail(requireNonEmpty(email, 'email')));
  },
  /** SMS aboneliği ekler; numara E.164'e normalize edilir (`+90 532 …` → `+90532…`). */
  addSms(phoneNumber: string): Promise<void> {
    return call(nativeModule().addSms(requireNonEmpty(phoneNumber, 'phoneNumber')));
  },
  removeSms(phoneNumber: string): Promise<void> {
    return call(nativeModule().removeSms(requireNonEmpty(phoneNumber, 'phoneNumber')));
  },
  getExternalId(): Promise<string | null> {
    return call(nativeModule().getExternalId());
  },
  /** HeroSignal kullanıcı kimliği (`user_id`). */
  getId(): Promise<string | null> {
    return call(nativeModule().getUserId());
  },
  pushSubscription,
};

const Notifications = {
  /** Sistem bildirim iznini ister (Android 13+ `POST_NOTIFICATIONS`, iOS `requestAuthorization`). */
  async requestPermission(): Promise<boolean> {
    const granted = await call(nativeModule().requestPermission());
    await refreshSubscriptionState().catch(() => undefined);
    return granted;
  },
  /** Son bilinen izin durumu; güncel değer için `getPermissionAsync()`. */
  get permission(): boolean {
    return subscriptionState.permission;
  },
  async getPermissionAsync(): Promise<boolean> {
    const permission = await call(nativeModule().getPermission());
    if (permission !== subscriptionState.permission) updateSubscriptionState({ ...subscriptionState, permission });
    return permission;
  },
  addPermissionObserver(observer: (permission: boolean) => void): HeroSignalSubscription {
    if (typeof observer !== 'function') throw new HeroSignalError('INVALID_ARGUMENT', 'Gözlemci bir fonksiyon olmalı.');
    ensureStateTracking();
    permissionObservers.add(observer);
    return { remove: () => permissionObservers.delete(observer) };
  },
  removePermissionObserver(observer: (permission: boolean) => void): void {
    permissionObservers.delete(observer);
  },
  /** Bildirim/düğme tıklaması. Uygulama bildirimden açıldıysa olay ilk dinleyiciye iletilir. */
  addClickListener(listener: (event: NotificationClickEvent) => void): HeroSignalSubscription {
    return clickListeners.add(listener);
  },
  removeClickListener(listener: (event: NotificationClickEvent) => void): void {
    clickListeners.remove(listener);
  },
  /** Ön planda gelen bildirim: `event.preventDefault()` ile gösterim engellenir. */
  addForegroundLifecycleListener(listener: (event: NotificationWillDisplayEvent) => void): HeroSignalSubscription {
    return foregroundListeners.add(listener);
  },
  removeForegroundLifecycleListener(listener: (event: NotificationWillDisplayEvent) => void): void {
    foregroundListeners.remove(listener);
  },
  /** SDK'nın gösterdiği tüm bildirimleri kaldırır (iOS'ta rozet de sıfırlanır). */
  clearAll(): void {
    nativeModule().clearAll();
  },
  /**
   * Tek bildirimi kaldırır. Android: `notification.androidNotificationId` (sayı) veya teslimat/collapse kimliği;
   * iOS: istek kimliği (`apns-id`/`apns-collapse-id`) veya teslimat kimliği (`notification.deliveryId`).
   */
  removeNotification(id: number | string): void {
    if (typeof id === 'number') {
      if (!Number.isInteger(id)) throw new HeroSignalError('INVALID_ARGUMENT', 'id tam sayı olmalı.');
      nativeModule().removeNotification(String(id));
      return;
    }
    nativeModule().removeNotification(requireNonEmpty(id, 'id'));
  },
  /** Gruplama anahtarı (`notification.groupKey`) eşleşen bildirimleri kaldırır. */
  removeGroupedNotifications(group: string): void {
    nativeModule().removeGroupedNotifications(requireNonEmpty(group, 'group'));
  },
};

const Session = {
  /** Özel olay / outcome. `value` sayısal değer (ör. gelir). */
  sendEvent(name: string, properties: Record<string, EventPropertyValue> = {}, value?: number): void {
    requireNonEmpty(name, 'name');
    if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) {
      throw new HeroSignalError('INVALID_ARGUMENT', 'properties bir nesne olmalı.');
    }
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new HeroSignalError('INVALID_ARGUMENT', 'value sonlu bir sayı olmalı.');
    }
    nativeModule().sendEvent(name, properties, value ?? 0, value !== undefined);
  },
};

const InAppMessages = {
  addTrigger(key: string, value: string | number | boolean): void {
    InAppMessages.addTriggers({ [requireNonEmpty(key, 'key')]: value });
  },
  addTriggers(triggers: Record<string, string | number | boolean>): void {
    const values = toStringRecord(triggers, 'triggers');
    for (const [key, value] of Object.entries(values)) {
      if (key.length > 64) throw new HeroSignalError('INVALID_ARGUMENT', 'Trigger anahtarı 1-64 karakter olmalı.');
      if (value.length > 200) throw new HeroSignalError('INVALID_ARGUMENT', 'Trigger değeri en fazla 200 karakter olabilir.');
    }
    if (Object.keys(values).length === 0) return;
    nativeModule().addTriggers(values);
  },
  removeTrigger(key: string): void {
    InAppMessages.removeTriggers([requireNonEmpty(key, 'key')]);
  },
  removeTriggers(keys: string[]): void {
    const list = requireStringArray(keys, 'keys');
    if (list.length === 0) return;
    nativeModule().removeTriggers(list);
  },
  clearTriggers(): void {
    nativeModule().clearTriggers();
  },
  async getTriggers(): Promise<Record<string, string>> {
    return stringMap(await call(nativeModule().getTriggers()));
  },
  /** Geçerli ekran adı (`screen` tetikleri); ekrandan çıkarken `null`. */
  setScreen(name: string | null): void {
    nativeModule().setScreen(name && name.trim() !== '' ? name : null);
  },
  /** true iken yeni mesaj gösterilmez (tetikler kaydedilmeye devam eder). */
  get paused(): boolean {
    return inAppPaused;
  },
  set paused(value: boolean) {
    InAppMessages.setPaused(value);
  },
  setPaused(paused: boolean): void {
    inAppPaused = paused === true;
    nativeModule().setInAppPaused(inAppPaused);
  },
  async getPausedAsync(): Promise<boolean> {
    inAppPaused = await call(nativeModule().getInAppPaused());
    return inAppPaused;
  },
  addClickListener(listener: (event: InAppMessageClickEvent) => void): HeroSignalSubscription {
    return inAppClickListeners.add(listener);
  },
  removeClickListener(listener: (event: InAppMessageClickEvent) => void): void {
    inAppClickListeners.remove(listener);
  },
  addLifecycleListener(listener: InAppLifecycleListener): HeroSignalSubscription {
    if (listener === null || typeof listener !== 'object') {
      throw new HeroSignalError('INVALID_ARGUMENT', 'Dinleyici bir nesne olmalı.');
    }
    const existing = lifecycleWrappers.get(listener);
    if (existing) return { remove: () => InAppMessages.removeLifecycleListener(listener) };
    const wrapper = ({ name, event }: RawLifecycle) => {
      const handler = listener[LIFECYCLE_METHODS[name]];
      handler?.(event);
    };
    lifecycleWrappers.set(listener, wrapper);
    lifecycleListeners.add(wrapper);
    return { remove: () => InAppMessages.removeLifecycleListener(listener) };
  },
  removeLifecycleListener(listener: InAppLifecycleListener): void {
    const wrapper = lifecycleWrappers.get(listener);
    if (!wrapper) return;
    lifecycleWrappers.delete(listener);
    lifecycleListeners.remove(wrapper);
  },
};

const Inbox = {
  /** Öğeler (yeniden eskiye), okunmamış sayısı ve sonraki sayfa imleci (`limit` 1-200, varsayılan 50). */
  async list(options: { limit?: number; cursor?: string | null } = {}): Promise<InboxPage> {
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new HeroSignalError('INVALID_ARGUMENT', 'limit 1-200 arasında tam sayı olmalı.');
    }
    return parseInboxPage(await call(nativeModule().inboxList(limit, options.cursor ?? null)));
  },
  /** Okundu işaretler; güncel öğeyi döndürür. */
  async markRead(id: string): Promise<InboxItem> {
    return parseInboxItem(await call(nativeModule().inboxMarkRead(requireNonEmpty(id, 'id'))));
  },
  /** Tümünü okundu işaretler; kalan okunmamış sayısını döndürür. */
  markAllRead(): Promise<number> {
    return call(nativeModule().inboxMarkAllRead());
  },
  /** Öğeyi kutudan kaldırır (arşivler). */
  archive(id: string): Promise<void> {
    return call(nativeModule().inboxArchive(requireNonEmpty(id, 'id')));
  },
  unreadCount(): Promise<number> {
    return call(nativeModule().inboxUnreadCount());
  },
};

const Debug = {
  setLogLevel(level: LogLevel): void {
    if (!LOG_LEVELS.includes(level)) {
      throw new HeroSignalError('INVALID_ARGUMENT', `level şunlardan biri olmalı: ${LOG_LEVELS.join(', ')}.`);
    }
    nativeModule().setLogLevel(level);
  },
};

/**
 * HeroSignal React Native SDK (eski sağlayıcı v5 yüzeyiyle uyumlu, plan 06 §6.1).
 *
 * ```ts
 * HeroSignal.initialize('app_…', { apiUrl: 'https://api.example.com' });
 * await HeroSignal.Notifications.requestPermission();
 * HeroSignal.login('user_42');
 * HeroSignal.User.addTag('plan', 'pro');
 * ```
 */
export const HeroSignal = {
  /** SDK'yı başlatır (uygulama açılışında bir kez; tekrar çağrı yok sayılır). */
  initialize(appId: string, options: InitializeOptions = {}): void {
    requireNonEmpty(appId, 'appId');
    if (options.logLevel !== undefined && !LOG_LEVELS.includes(options.logLevel)) {
      throw new HeroSignalError('INVALID_ARGUMENT', `logLevel şunlardan biri olmalı: ${LOG_LEVELS.join(', ')}.`);
    }
    const nativeOptions: Record<string, string | boolean> = {
      requiresPrivacyConsent: options.requiresPrivacyConsent ?? consentRequired,
    };
    if (options.apiUrl) nativeOptions.apiUrl = options.apiUrl;
    if (options.logLevel) nativeOptions.logLevel = options.logLevel;
    if (options.provisionalAuthorization !== undefined) nativeOptions.provisionalAuthorization = options.provisionalAuthorization;
    if (options.appGroup) nativeOptions.appGroup = options.appGroup;
    if (options.apnsEnvironment) nativeOptions.apnsEnvironment = options.apnsEnvironment;
    if (options.androidDefaultChannelName) nativeOptions.androidDefaultChannelName = options.androidDefaultChannelName;
    if (options.androidDefaultChannelId) nativeOptions.androidDefaultChannelId = options.androidDefaultChannelId;
    nativeModule().initialize(appId, nativeOptions);
    ensureStateTracking();
    refreshSubscriptionState().catch(() => undefined);
  },
  /** Anonim cihazı `externalId` kullanıcısına bağlar; identity verification açıksa `identityHash` zorunludur. */
  login(externalId: string, identityHash?: string): void {
    nativeModule().login(requireNonEmpty(externalId, 'externalId'), identityHash ?? null);
  },
  logout(): void {
    nativeModule().logout();
  },
  /** KVKK/GDPR: `initialize` öncesinde çağrılır; true ise onay verilene kadar ağ çağrısı yapılmaz. */
  setConsentRequired(required: boolean): void {
    consentRequired = required === true;
    nativeModule().setConsentRequired(consentRequired);
  },
  /** Kullanıcı onayı; false verilirse kuyruk ve cihaz kimliği temizlenir. */
  setConsentGiven(given: boolean): void {
    nativeModule().setConsentGiven(given === true);
  },
  User,
  Notifications,
  Session,
  InAppMessages,
  Inbox,
  Debug,
};

/** Testler için modül durumunu sıfırlar. */
export function resetHeroSignalStateForTests(): void {
  subscriptionState = EMPTY_STATE;
  consentRequired = false;
  inAppPaused = false;
  permissionObservers.clear();
  clickListeners.clear();
  foregroundListeners.clear();
  subscriptionObservers.clear();
  inAppClickListeners.clear();
  lifecycleListeners.clear();
  lifecycleWrappers.clear();
  internalStateSubscription?.remove();
  internalStateSubscription = null;
}
