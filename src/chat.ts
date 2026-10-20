/**
 * Canlı sohbet (ADR-0040; `Pushizo.Chat`). Ziyaretçi kimliği, çevrimdışı kuyruk, canlı akış (SSE + yoklama yedeği) ve
 * push ile gelen mesajlar yerel SDK'dadır; bu katman çağrıları doğrular ve yanıtları tipli nesnelere çevirir.
 */
import { EventHub } from './events';
import { nativeModule } from './native';

/** Yerel köprü olay adları (Android `PushizoBridge`, iOS `PushizoRNBridge` ile aynı). */
export const ChatNativeEvents = {
  Event: 'Pushizo-chatEvent',
  Open: 'Pushizo-chatOpen',
} as const;

type Raw = Record<string, unknown> | null | undefined;

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const int = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0);
const list = (value: unknown): Raw[] => (Array.isArray(value) ? (value as Raw[]) : []);

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface ChatQuickReply {
  id: string;
  label: string;
}

/** Sohbet mesajı; çevrimdışı kuyrukta bekleyen yerel mesajda `seq` 0 ve `status` `pending`. */
export interface ChatMessage {
  /** Sunucu kimliği; bekleyen yerel mesajda null. */
  id: string | null;
  seq: number;
  clientMessageId: string | null;
  sender: 'visitor' | 'agent' | 'bot' | 'system';
  authorName: string | null;
  text: string | null;
  attachments: ChatAttachment[];
  /** Bot sorusunun seçenekleri (yoksa null); seçim `sendMessage(label, { optionId })`. */
  quickReplies: ChatQuickReply[] | null;
  status: 'pending' | 'sent' | 'delivered' | 'read';
  /** Epoch milisaniye. */
  createdAt: number | null;
}

export interface ChatConversation {
  id: string;
  status: string;
  lastSeq: number;
  /** Temsilcinin okuduğu son sıra (ziyaretçi mesajlarında "okundu"). */
  agentLastReadSeq: number;
  visitorLastReadSeq: number;
  unreadCount: number;
  botActive: boolean;
  assigneeName: string | null;
  createdAt: number | null;
}

export interface ChatConversationState {
  conversation: ChatConversation | null;
  unreadCount: number;
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
}

export interface ChatIdentifyResult {
  userId: string | null;
  conversation: ChatConversation | null;
}

export interface ChatConfig {
  enabled: boolean;
  /** Çalışma saatleri içinde ve en az bir temsilci (veya bot) çevrimiçi. */
  online: boolean;
  withinBusinessHours: boolean;
  color: string | null;
  textColor: string | null;
  position: string;
  theme: string;
  title: string | null;
  greeting: string | null;
  offlineMessage: string | null;
  collectEmailOffline: boolean;
  requireEmail: boolean;
  attachmentsEnabled: boolean;
  attachmentMaxBytes: number;
  attachmentTypes: string[];
  language: string;
}

export interface ChatStartOptions {
  name?: string;
  email?: string;
  language?: string;
}

export interface ChatMessagesOptions {
  /** Bu sıradan sonraki mesajlar (eksik tamamlama). */
  afterSeq?: number;
  /** Bu sıradan önceki mesajlar (geçmiş). */
  beforeSeq?: number;
  /** 1-100 (varsayılan 50). */
  limit?: number;
}

/** Ek kaynağı: base64 içerik veya dosya adresi (Android `content://`/`file://`, iOS `file://`). */
export type ChatAttachmentSource = { base64: string } | { uri: string };

export interface ChatAttachmentOptions {
  fileName: string;
  /** `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`, `text/plain`. */
  mimeType: string;
  text?: string;
}

/** Canlı sohbet olayları (tür → olay). */
export interface ChatEventMap {
  message: { message: ChatMessage };
  typing: { typing: boolean; name: string | null };
  /** Temsilci bu sıra numarasına kadar okudu. */
  read: { seq: number };
  unread: { count: number };
  conversation: { conversationId: string; status: string; botActive: boolean };
  connection: { connected: boolean };
  /** Kalıcı hata (ör. `HS_PLAN_FEATURE_REQUIRED`); dinleme durdu. */
  error: { code: string; message: string | null };
  /** Sohbet bildirimine tıklandı: uygulama sohbet ekranını açmalı. */
  open: { conversationId: string; seq: number };
}

export function toChatMessage(raw: Raw): ChatMessage {
  const m = raw ?? {};
  const sender = str(m.sender);
  const status = str(m.status);
  return {
    id: str(m.id),
    seq: int(m.seq),
    clientMessageId: str(m.clientMessageId),
    sender: sender === 'visitor' || sender === 'agent' || sender === 'bot' ? sender : 'system',
    authorName: str(m.authorName),
    text: str(m.text),
    attachments: list(m.attachments).map((a) => ({ id: str(a?.id) ?? '', name: str(a?.name) ?? '', type: str(a?.type) ?? '', size: int(a?.size) })),
    quickReplies: Array.isArray(m.quickReplies) ? list(m.quickReplies).map((q) => ({ id: str(q?.id) ?? '', label: str(q?.label) ?? '' })) : null,
    status: status === 'pending' || status === 'delivered' || status === 'read' ? status : 'sent',
    createdAt: typeof m.createdAt === 'number' ? m.createdAt : null,
  };
}

export function toChatConversation(raw: unknown): ChatConversation | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const id = str(m.id);
  if (!id) return null;
  return {
    id,
    status: str(m.status) ?? 'open',
    lastSeq: int(m.lastSeq),
    agentLastReadSeq: int(m.agentLastReadSeq),
    visitorLastReadSeq: int(m.visitorLastReadSeq),
    unreadCount: int(m.unreadCount),
    botActive: m.botActive === true,
    assigneeName: str(m.assigneeName),
    createdAt: typeof m.createdAt === 'number' ? m.createdAt : null,
  };
}

export function toChatConfig(raw: Raw): ChatConfig {
  const m = raw ?? {};
  return {
    enabled: m.enabled === true,
    online: m.online === true,
    withinBusinessHours: m.withinBusinessHours === true,
    color: str(m.color),
    textColor: str(m.textColor),
    position: str(m.position) ?? 'right',
    theme: str(m.theme) ?? 'auto',
    title: str(m.title),
    greeting: str(m.greeting),
    offlineMessage: str(m.offlineMessage),
    collectEmailOffline: m.collectEmailOffline === true,
    requireEmail: m.requireEmail === true,
    attachmentsEnabled: m.attachmentsEnabled === true,
    attachmentMaxBytes: int(m.attachmentMaxBytes),
    attachmentTypes: Array.isArray(m.attachmentTypes) ? m.attachmentTypes.filter((t): t is string => typeof t === 'string') : [],
    language: str(m.language) ?? 'en',
  };
}

/**
 * Mesaj listesi birleştirme: sıra numarasına göre artan ve tekil; bekleyen yerel mesaj aynı `clientMessageId` ile
 * sunucu kopyası gelince kalkar (yerel SDK'lardaki `HsChatTimeline` ile aynı kural).
 */
export function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const bySeq = new Map<number, ChatMessage>();
  const pending = new Map<string, ChatMessage>();
  for (const m of [...current, ...incoming]) {
    if (m.seq <= 0) {
      if (m.clientMessageId) pending.set(m.clientMessageId, m);
      continue;
    }
    if (m.clientMessageId) pending.delete(m.clientMessageId);
    bySeq.set(m.seq, m);
  }
  const confirmed = new Set([...bySeq.values()].map((m) => m.clientMessageId).filter((id): id is string => !!id));
  const sorted = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  return [...sorted, ...[...pending.values()].filter((m) => !confirmed.has(m.clientMessageId ?? ''))];
}

const ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'];

function requireText(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`Pushizo: ${name} boş olmayan bir metin olmalı.`);
  if (name === 'text' && value.trim().length > 4000) throw new RangeError('Pushizo: mesaj en fazla 4000 karakter olabilir.');
  return value;
}

function requireSeq(value: unknown, name: string, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new RangeError(`Pushizo: ${name} en az ${min} olan bir tam sayı olmalı.`);
  }
  return value;
}

type ChatEventPayload = Record<string, unknown> & { type?: string };
type ChatListener<K extends keyof ChatEventMap> = (event: ChatEventMap[K]) => void;

const listeners: { [K in keyof ChatEventMap]: Set<ChatListener<K>> } = {
  message: new Set(),
  typing: new Set(),
  read: new Set(),
  unread: new Set(),
  conversation: new Set(),
  connection: new Set(),
  error: new Set(),
  open: new Set(),
};

function notify<K extends keyof ChatEventMap>(type: K, event: ChatEventMap[K]): void {
  for (const listener of Array.from(listeners[type])) {
    try {
      listener(event);
    } catch (error) {
      console.error(`[Pushizo] sohbet '${type}' dinleyicisi hata verdi`, error);
    }
  }
}

function dispatchChatEvent(p: ChatEventPayload): void {
  switch (p.type) {
    case 'message':
      notify('message', { message: toChatMessage(p.message as Raw) });
      break;
    case 'typing':
      notify('typing', { typing: p.typing === true, name: str(p.name) });
      break;
    case 'read':
      notify('read', { seq: int(p.seq) });
      break;
    case 'unread':
      notify('unread', { count: int(p.count) });
      break;
    case 'conversation':
      notify('conversation', { conversationId: str(p.conversationId) ?? '', status: str(p.status) ?? 'open', botActive: p.botActive === true });
      break;
    case 'connection':
      notify('connection', { connected: p.connected === true });
      break;
    case 'error':
      notify('error', { code: str(p.code) ?? 'HS_ERROR', message: str(p.message) });
      break;
  }
}

const chatEventHub = new EventHub<ChatEventPayload, ChatEventPayload>(ChatNativeEvents.Event, (p) => p ?? {}, {
  onEvent: dispatchChatEvent,
});
const chatOpenHub = new EventHub<Record<string, unknown>, ChatEventMap['open']>(ChatNativeEvents.Open, (p) => ({
  conversationId: str(p?.conversationId) ?? '',
  seq: int(p?.seq),
}));

/** Canlı sohbet (Android ve iOS). */
export const Chat = {
  /** Sohbeti etkinleştirir ve ziyaretçiyi bağlar (giriş yapmış kullanıcı, push aboneliği); konuşma varsa döner. */
  async start(options: ChatStartOptions = {}): Promise<ChatIdentifyResult> {
    const raw = (await nativeModule().chatStart(options.name ?? null, options.email ?? null, options.language ?? null)) as Raw;
    return { userId: str(raw?.userId), conversation: toChatConversation(raw?.conversation) };
  },
  /** Widget ayarları, çevrimiçi durumu, çevrimdışı metni ve ek sınırları. */
  async getConfig(language?: string): Promise<ChatConfig> {
    return toChatConfig((await nativeModule().chatGetConfig(language ?? null)) as Raw);
  },
  /** Konuşma (yoksa null) ve okunmamış sayısı. */
  async getConversation(): Promise<ChatConversationState> {
    const raw = (await nativeModule().chatGetConversation()) as Raw;
    return { conversation: toChatConversation(raw?.conversation), unreadCount: int(raw?.unreadCount) };
  },
  /** Mesajlar (kronolojik): parametresiz en yeni `limit`; `afterSeq` sonrakiler, `beforeSeq` daha eski geçmiş. */
  async getMessages(options: ChatMessagesOptions = {}): Promise<ChatMessagePage> {
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('Pushizo: limit 1-100 arası tam sayı olmalı.');
    const after = options.afterSeq === undefined ? null : requireSeq(options.afterSeq, 'afterSeq', 0);
    const before = options.beforeSeq === undefined ? null : requireSeq(options.beforeSeq, 'beforeSeq', 1);
    const raw = (await nativeModule().chatGetMessages(after, before, limit)) as Raw;
    return { messages: list(raw?.messages).map(toChatMessage), hasMore: raw?.hasMore === true };
  },
  /**
   * Mesaj gönderir (ilk mesaj konuşmayı açar); `optionId` bot sorusunda seçilen hızlı yanıttır. Ağ yoksa mesaj yerel SDK
   * kuyruğuna alınır ve `pending` mesaj döner; gönderilince `message` olayıyla sunucu kopyası gelir.
   */
  async sendMessage(text: string, options: { optionId?: string } = {}): Promise<ChatMessage> {
    return toChatMessage((await nativeModule().chatSendMessage(requireText(text, 'text'), options.optionId ?? null)) as Raw);
  },
  /** Ek gönderir (PNG/JPEG/WebP/GIF/PDF/düz metin, en çok 10 MB). */
  async sendAttachment(source: ChatAttachmentSource, options: ChatAttachmentOptions): Promise<ChatMessage> {
    requireText(options.fileName, 'fileName');
    const mime = requireText(options.mimeType, 'mimeType').split(';')[0].trim().toLowerCase();
    if (!ATTACHMENT_TYPES.includes(mime)) throw new TypeError(`Pushizo: desteklenmeyen dosya türü '${mime}'.`);
    const text = options.text?.trim() ? options.text : null;
    const native = nativeModule();
    const raw = 'base64' in source
      ? await native.chatSendAttachmentData(requireText(source.base64, 'base64'), options.fileName, mime, text)
      : await native.chatSendAttachmentUri(requireText(source.uri, 'uri'), options.fileName, mime, text);
    return toChatMessage(raw as Raw);
  },
  /** `seq` numarasına kadar okundu işaretler; kalan okunmamış sayısını döndürür. */
  markRead(seq: number): Promise<number> {
    return nativeModule().chatMarkRead(requireSeq(seq, 'seq', 0));
  },
  /** Okunmamış sayısını sunucudan yeniler. */
  refreshUnreadCount(): Promise<number> {
    return nativeModule().chatRefreshUnreadCount();
  },
  /** Son bilinen okunmamış sayısı (ağ çağrısı yok). */
  getUnreadCount(): Promise<number> {
    return nativeModule().chatGetUnreadCount();
  },
  /** Çevrimdışı / çalışma saatleri dışında e-postayla mesaj bırakır. */
  async leaveOfflineMessage(email: string, text: string, name?: string): Promise<ChatMessage> {
    const raw = await nativeModule().chatLeaveOfflineMessage(requireText(email, 'email'), requireText(text, 'text'), name ?? null);
    return toChatMessage(raw as Raw);
  },
  /** Yazıyor göstergesi (yerel SDK tekrarları seyreltir). */
  setTyping(typing: boolean): void {
    nativeModule().chatSetTyping(typing === true);
  },
  /** Canlı dinlemeyi başlatır; koparsa yerel SDK geri çekilmeyle yeniden bağlanır ve eksikleri yoklar. */
  startListening(): void {
    nativeModule().chatStartListening();
  },
  /** Canlı dinlemeyi durdurur (arka plana geçişte önerilir; temsilci mesajı push ile gelir). */
  stopListening(): void {
    nativeModule().chatStopListening();
  },
  /** Ek dosyasının adresi; ziyaretçi belirtecini taşır, yalnızca görsel bileşenine verin ve loglamayın. */
  attachmentUrl(attachmentId: string, download = false): Promise<string> {
    return nativeModule().chatAttachmentUrl(requireText(attachmentId, 'attachmentId'), download === true);
  },
  /** Bu cihazın ziyaretçi kimliği (sohbet henüz kullanılmadıysa null). */
  getVisitorId(): Promise<string | null> {
    return nativeModule().chatGetVisitorId();
  },
  /** Sohbet olay dinleyicisi; `open` sohbet bildirimine tıklamadır (soğuk açılışta ilk dinleyiciye iletilir). */
  addEventListener<K extends keyof ChatEventMap>(event: K, listener: ChatListener<K>): void {
    if (typeof listener !== 'function') throw new TypeError('Pushizo: dinleyici bir fonksiyon olmalı.');
    if (event === 'open') {
      chatOpenHub.add(listener as ChatListener<'open'>);
      return;
    }
    const set = listeners[event] as Set<ChatListener<K>> | undefined;
    if (!set) throw new TypeError(`Pushizo: bilinmeyen sohbet olayı '${String(event)}'.`);
    if (set.has(listener)) return;
    set.add(listener);
    chatEventHub.retain();
  },
  removeEventListener<K extends keyof ChatEventMap>(event: K, listener: ChatListener<K>): void {
    if (event === 'open') {
      chatOpenHub.remove(listener as ChatListener<'open'>);
      return;
    }
    const set = listeners[event] as Set<ChatListener<K>> | undefined;
    if (set?.delete(listener)) chatEventHub.release();
  },
};
