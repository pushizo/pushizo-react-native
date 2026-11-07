import type {
  FeatureFlagValue,
  InAppAction,
  InAppBlock,
  InAppButton,
  InAppCarouselCard,
  InAppDisplay,
  InAppLayout,
  InAppMessage,
  InAppTrigger,
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

/** `featureFlagsGetValue` zarfındaki (`{ value }`) değer; değer yoksa veya `null` ise `undefined`. */
export function toFeatureFlagValue(raw: RawMap): FeatureFlagValue | undefined {
  const value = raw?.value;
  return value === undefined || value === null ? undefined : (value as FeatureFlagValue);
}

const LAYOUTS: readonly string[] = ['modal', 'banner_top', 'banner_bottom', 'fullscreen'];
const maps = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isMap) : []);

function toInAppTrigger(m: Record<string, unknown>): InAppTrigger {
  switch (m.kind) {
    case 'session_start':
      return { kind: 'session_start' };
    case 'session_duration':
      return { kind: 'session_duration', seconds: num(m.seconds) ?? 0 };
    case 'event':
      return { kind: 'event', name: str(m.name) ?? '' };
    case 'screen':
      return { kind: 'screen', name: str(m.name) ?? '' };
    case 'trigger':
      return { kind: 'trigger', key: str(m.key) ?? '', op: str(m.op) ?? '', value: str(m.value) ?? num(m.value) };
    default:
      return { kind: 'unsupported', name: str(m.name) ?? '' };
  }
}

function toInAppAction(raw: unknown): InAppAction {
  const m = isMap(raw) ? raw : {};
  switch (m.type) {
    case 'url':
      return { type: 'url', url: str(m.url) ?? '' };
    case 'deeplink':
      return { type: 'deeplink', url: str(m.url) ?? '' };
    case 'tags':
      return { type: 'tags', tags: toStringMap(m.tags) };
    case 'push_prompt':
      return { type: 'push_prompt' };
    case 'outcome':
      return { type: 'outcome', name: str(m.name) ?? '', value: num(m.value) };
    default:
      return { type: 'dismiss' };
  }
}

function toInAppButton(m: Record<string, unknown>): InAppButton {
  return {
    id: str(m.id) ?? '',
    text: str(m.text) ?? '',
    action: toInAppAction(m.action),
    backgroundColor: str(m.backgroundColor),
    textColor: str(m.textColor),
  };
}

function toInAppCard(m: Record<string, unknown>): InAppCarouselCard {
  return {
    id: str(m.id) ?? '',
    title: str(m.title) ?? '',
    body: str(m.body),
    imageUrl: str(m.imageUrl),
    imageAlt: str(m.imageAlt),
    button: isMap(m.button) ? toInAppButton(m.button) : null,
  };
}

/** Tanınmayan blok türü için `null` (yerel ayrıştırıcıyla aynı: ileri uyumluluk için atlanır). */
function toInAppBlock(m: Record<string, unknown>): InAppBlock | null {
  switch (m.type) {
    case 'image':
      return { type: 'image', url: str(m.url) ?? '', alt: str(m.alt) };
    case 'title':
      return { type: 'title', text: str(m.text) ?? '' };
    case 'body':
      return { type: 'body', text: str(m.text) ?? '' };
    case 'button':
      return { type: 'button', ...toInAppButton(m) };
    case 'carousel':
      return { type: 'carousel', id: str(m.id) ?? '', cards: maps(m.cards).map(toInAppCard) };
    default:
      return null;
  }
}

function toInAppDisplay(raw: unknown): InAppDisplay {
  const m = isMap(raw) ? raw : {};
  const blocks = maps(m.blocks)
    .map(toInAppBlock)
    .filter((b): b is InAppBlock => b !== null);
  const buttons = blocks.flatMap((block): InAppButton[] => {
    if (block.type === 'button') {
      return [{ id: block.id, text: block.text, action: block.action, backgroundColor: block.backgroundColor, textColor: block.textColor }];
    }
    if (block.type === 'carousel') return block.cards.flatMap((card) => (card.button ? [card.button] : []));
    return [];
  });
  return {
    layout: (LAYOUTS.includes(m.layout as string) ? m.layout : 'modal') as InAppLayout,
    backgroundColor: str(m.backgroundColor),
    textColor: str(m.textColor),
    dismissible: m.dismissible !== false,
    autoDismissSeconds: num(m.autoDismissSeconds),
    contentType: m.contentType === 'html' ? 'html' : 'blocks',
    html: str(m.html),
    htmlHeight: num(m.htmlHeight),
    blocks,
    buttons,
  };
}

/** Kimliksiz kayıt için `null` (rapor çağrıları kimlikle eşlenir). */
export function toInAppMessage(raw: RawMap): InAppMessage | null {
  const m = raw ?? {};
  const id = str(m.id);
  if (!id) return null;
  const triggerGroups = (Array.isArray(m.triggerGroups) ? m.triggerGroups : []).map((group) => maps(group).map(toInAppTrigger));
  return {
    id,
    priority: num(m.priority) ?? 0,
    triggers: maps(m.triggers).map(toInAppTrigger),
    triggerGroups,
    variantId: str(m.variantId),
    display: toInAppDisplay(m.display),
    remainingImpressions: num(m.remainingImpressions) ?? 1,
    minIntervalSeconds: num(m.minIntervalSeconds) ?? 0,
    stopAfterInteraction: m.stopAfterInteraction === true,
    lastImpressionAt: num(m.lastImpressionAt),
    endAt: num(m.endAt),
    language: str(m.language),
    raw: isMap(m.raw) ? m.raw : {},
  };
}

/** Dizi olmayan yerel sonuç boş listeye düşer; kimliksiz kayıt atlanır. */
export function toInAppMessages(value: unknown): InAppMessage[] {
  return maps(value)
    .map(toInAppMessage)
    .filter((message): message is InAppMessage => message !== null);
}
