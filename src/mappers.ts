import type {
  InboxItem,
  InboxPage,
  NotificationData,
  PreferenceCategory,
  PushSubscriptionState,
  UserPreference,
  UserPreferences,
} from './types';

/** Yerel köprüden gelen ham harita (null değerler NSNull/`null` olarak gelebilir). */
export type RawMap = Record<string, unknown> | null | undefined;

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Yalnızca metin öğeleri tutulan liste (e-posta/SMS listeleri); dizi olmayan değer boş listeye düşer. */
export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Değerleri string olan sözlük (tag, trigger, `data`); sayı/mantıksal metne, nesne JSON'a çevrilir; null atlanır. */
export function toStringMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[key] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[key] = String(v);
    else if (v !== null && typeof v === 'object') out[key] = JSON.stringify(v);
  }
  return out;
}

export function toNotification(raw: RawMap): NotificationData {
  const m = raw ?? {};
  return {
    title: str(m.title),
    body: str(m.body),
    url: str(m.url),
    imageUrl: str(m.imageUrl),
    deliveryId: str(m.deliveryId),
    messageId: str(m.messageId),
    data: toStringMap(m.data),
    androidNotificationId: num(m.androidNotificationId),
  };
}

export function toSubscriptionState(raw: RawMap): PushSubscriptionState {
  const m = raw ?? {};
  return { id: str(m.id), token: str(m.token), optedIn: m.optedIn === true, permission: m.permission === true };
}

export function toInboxItem(raw: RawMap): InboxItem {
  const m = raw ?? {};
  return {
    id: str(m.id) ?? '',
    messageId: str(m.messageId),
    title: str(m.title),
    body: str(m.body),
    url: str(m.url),
    imageUrl: str(m.imageUrl),
    data: toStringMap(m.data),
    read: m.read === true,
    readAt: num(m.readAt),
    archivedAt: num(m.archivedAt),
    expiresAt: num(m.expiresAt),
    createdAt: num(m.createdAt),
  };
}

export function toInboxPage(raw: RawMap): InboxPage {
  const m = raw ?? {};
  const items = Array.isArray(m.items) ? (m.items as RawMap[]).map(toInboxItem) : [];
  return { items, unreadCount: num(m.unreadCount) ?? 0, nextCursor: str(m.nextCursor), hasMore: m.hasMore === true };
}

const isMap = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Kategorisiz kayıt için `null` (yerel SDK ayrıştırıcısıyla aynı: geçersiz kayıt atlanır); boş kanal = tüm kanallar. */
export function toUserPreference(raw: RawMap): UserPreference | null {
  const m = raw ?? {};
  const category = str(m.category);
  if (!category) return null;
  return {
    category,
    channel: str(m.channel) || null,
    optedIn: m.optedIn === true,
    explicit: m.explicit === true,
    source: str(m.source),
    updatedAt: num(m.updatedAt),
  };
}

/** Anahtarsız kategori için `null`; `channels` dizi değilse kısıt yok (`null`). */
export function toPreferenceCategory(raw: RawMap): PreferenceCategory | null {
  const m = raw ?? {};
  const key = str(m.key);
  if (!key) return null;
  return {
    key,
    name: toStringMap(m.name),
    description: toStringMap(m.description),
    channels: Array.isArray(m.channels) ? m.channels.filter((c): c is string => typeof c === 'string' && c !== '') : null,
    defaultOptedIn: m.defaultOptedIn !== false,
  };
}

export function toUserPreferences(raw: RawMap): UserPreferences {
  const m = raw ?? {};
  const list = <T>(value: unknown, map: (r: RawMap) => T | null): T[] =>
    Array.isArray(value) ? value.filter(isMap).map(map).filter((v): v is T => v !== null) : [];
  return { preferences: list(m.preferences, toUserPreference), categories: list(m.categories, toPreferenceCategory) };
}
