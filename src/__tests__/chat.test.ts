/**
 * Canlı sohbet TS katmanı: argüman doğrulama, yerel yanıtların ayrıştırılması ve olay dağıtımı. Yerel modül ve
 * NativeEventEmitter sahte olarak verilir.
 */
import type * as Sdk from '../index';

type Handler = (payload: unknown) => void;

const MESSAGE_RAW = {
  id: 'cmsg_1',
  seq: 12,
  clientMessageId: 'm_abcdefgh',
  sender: 'bot',
  authorName: 'Asistan',
  text: 'Seçin',
  attachments: [{ id: 'att_1', name: 'a.png', type: 'image/png', size: 2048 }],
  quickReplies: [{ id: 'o1', label: 'Satış' }],
  status: 'delivered',
  createdAt: 1792490400000,
};
const CONVERSATION_RAW = {
  id: 'conv_1',
  status: 'open',
  lastSeq: 12,
  agentLastReadSeq: 10,
  visitorLastReadSeq: 11,
  unreadCount: 1,
  botActive: true,
  assigneeName: null,
  createdAt: 1792490340000,
};

function load() {
  jest.resetModules();
  const resolved = (value: unknown = undefined) => jest.fn(() => Promise.resolve(value));
  const native: Record<string, jest.Mock> = {
    chatStart: resolved({ userId: 'usr_1', conversation: CONVERSATION_RAW }),
    chatGetConfig: resolved({ enabled: true, online: false, offlineMessage: 'Şu an çevrimdışıyız', attachmentMaxBytes: 10485760, attachmentTypes: ['image/png', 4], language: 'tr' }),
    chatGetConversation: resolved({ conversation: null, unreadCount: 0 }),
    chatGetMessages: resolved({ messages: [MESSAGE_RAW], hasMore: true }),
    chatSendMessage: resolved(MESSAGE_RAW),
    chatSendAttachmentData: resolved(MESSAGE_RAW),
    chatSendAttachmentUri: resolved(MESSAGE_RAW),
    chatMarkRead: resolved(0),
    chatRefreshUnreadCount: resolved(2),
    chatGetUnreadCount: resolved(2),
    chatLeaveOfflineMessage: resolved(MESSAGE_RAW),
    chatSetTyping: jest.fn(),
    chatStartListening: jest.fn(),
    chatStopListening: jest.fn(),
    chatAttachmentUrl: resolved('https://api.example.com/sdk/v1/apps/app_1/chat/attachments/att_1?visitor_id=v&token=t'),
    chatGetVisitorId: resolved('v'.repeat(32)),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
  const handlers = new Map<string, Set<Handler>>();
  jest.doMock('react-native', () => ({
    Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
    NativeModules: {},
    TurboModuleRegistry: { get: jest.fn(() => native) },
    NativeEventEmitter: class {
      constructor(private readonly module: { addListener: (e: string) => void; removeListeners: (n: number) => void }) {}
      addListener(event: string, handler: Handler) {
        this.module.addListener(event);
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event)!.add(handler);
        return {
          remove: () => {
            this.module.removeListeners(1);
            handlers.get(event)!.delete(handler);
          },
        };
      }
    },
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sdk = require('../index') as typeof Sdk;
  return {
    ...sdk,
    native,
    emit: (event: string, payload: unknown) => handlers.get(event)?.forEach((h) => h(payload)),
    listenerCount: (event: string) => handlers.get(event)?.size ?? 0,
  };
}

describe('Pushizo.Chat (React Native)', () => {
  test('başlatma, ayar ve konuşma yanıtları tipli nesnelere çevrilir', async () => {
    const { Pushizo, native } = load();
    const started = await Pushizo.Chat.start({ name: 'Ali' });
    expect(native.chatStart).toHaveBeenCalledWith('Ali', null, null);
    expect(started.userId).toBe('usr_1');
    expect(started.conversation?.botActive).toBe(true);
    expect(started.conversation?.assigneeName).toBeNull();

    const config = await Pushizo.Chat.getConfig('tr');
    expect(native.chatGetConfig).toHaveBeenCalledWith('tr');
    expect(config.online).toBe(false);
    expect(config.offlineMessage).toBe('Şu an çevrimdışıyız');
    expect(config.attachmentTypes).toEqual(['image/png']);
    expect(config.position).toBe('right');

    expect(await Pushizo.Chat.getConversation()).toEqual({ conversation: null, unreadCount: 0 });
  });

  test('mesaj sayfası ve gönderim argümanları doğrulanır', async () => {
    const { Pushizo, native } = load();
    const page = await Pushizo.Chat.getMessages({ afterSeq: 5 });
    expect(native.chatGetMessages).toHaveBeenCalledWith(5, null, 50);
    expect(page.hasMore).toBe(true);
    expect(page.messages[0]).toMatchObject({ seq: 12, sender: 'bot', status: 'delivered', quickReplies: [{ id: 'o1', label: 'Satış' }] });
    await expect(Pushizo.Chat.getMessages({ limit: 101 })).rejects.toThrow(RangeError);
    await expect(Pushizo.Chat.getMessages({ beforeSeq: 0 })).rejects.toThrow(RangeError);

    await Pushizo.Chat.sendMessage('Merhaba', { optionId: 'o1' });
    expect(native.chatSendMessage).toHaveBeenCalledWith('Merhaba', 'o1');
    await expect(Pushizo.Chat.sendMessage('   ')).rejects.toThrow(TypeError);
    await expect(Pushizo.Chat.sendMessage('a'.repeat(4001))).rejects.toThrow(RangeError);

    await Pushizo.Chat.sendAttachment({ base64: 'AQID' }, { fileName: 'a.png', mimeType: 'image/png' });
    expect(native.chatSendAttachmentData).toHaveBeenCalledWith('AQID', 'a.png', 'image/png', null);
    await Pushizo.Chat.sendAttachment({ uri: 'file:///tmp/r.pdf' }, { fileName: 'r.pdf', mimeType: 'application/pdf; charset=binary', text: 'Rapor' });
    expect(native.chatSendAttachmentUri).toHaveBeenCalledWith('file:///tmp/r.pdf', 'r.pdf', 'application/pdf', 'Rapor');
    await expect(Pushizo.Chat.sendAttachment({ base64: 'AQID' }, { fileName: 'a.exe', mimeType: 'application/x-msdownload' })).rejects.toThrow(TypeError);

    expect(await Pushizo.Chat.markRead(12)).toBe(0);
    expect(native.chatMarkRead).toHaveBeenCalledWith(12);
    expect(() => Pushizo.Chat.markRead(-1)).toThrow(RangeError);
    expect(await Pushizo.Chat.refreshUnreadCount()).toBe(2);
    await Pushizo.Chat.leaveOfflineMessage('ali@example.com', 'Arayın');
    expect(native.chatLeaveOfflineMessage).toHaveBeenCalledWith('ali@example.com', 'Arayın', null);

    Pushizo.Chat.setTyping(true);
    Pushizo.Chat.startListening();
    Pushizo.Chat.stopListening();
    expect(native.chatSetTyping).toHaveBeenCalledWith(true);
    expect(native.chatStartListening).toHaveBeenCalled();
    expect(native.chatStopListening).toHaveBeenCalled();
    expect(await Pushizo.Chat.attachmentUrl('att_1')).toContain('/chat/attachments/att_1');
    expect(native.chatAttachmentUrl).toHaveBeenCalledWith('att_1', false);
  });

  test('olaylar türüne göre dağıtılır; yerel abonelik ilk dinleyicide açılır, sonuncusunda kapanır', () => {
    const { Pushizo, emit, listenerCount } = load();
    const messages: unknown[] = [];
    const typing: unknown[] = [];
    const onMessage = (e: { message: unknown }) => messages.push(e.message);
    const onTyping = (e: { typing: boolean; name: string | null }) => typing.push(e);
    Pushizo.Chat.addEventListener('message', onMessage);
    Pushizo.Chat.addEventListener('typing', onTyping);
    expect(listenerCount('Pushizo-chatEvent')).toBe(1);

    emit('Pushizo-chatEvent', { type: 'message', message: MESSAGE_RAW });
    emit('Pushizo-chatEvent', { type: 'typing', typing: true, name: 'Ayşe' });
    emit('Pushizo-chatEvent', { type: 'unread', count: 3 });
    expect(messages).toMatchObject([{ seq: 12, text: 'Seçin' }]);
    expect(typing).toEqual([{ typing: true, name: 'Ayşe' }]);

    Pushizo.Chat.removeEventListener('message', onMessage);
    expect(listenerCount('Pushizo-chatEvent')).toBe(1);
    Pushizo.Chat.removeEventListener('typing', onTyping);
    expect(listenerCount('Pushizo-chatEvent')).toBe(0);

    const opens: unknown[] = [];
    Pushizo.Chat.addEventListener('open', (e) => opens.push(e));
    emit('Pushizo-chatOpen', { conversationId: 'conv_9', seq: 4 });
    expect(opens).toEqual([{ conversationId: 'conv_9', seq: 4 }]);
  });

  test('zaman çizelgesi birleştirme sıra numarasına göre tekilleştirir, bekleyen mesajı değiştirir', () => {
    const { mergeChatMessages } = load();
    const m = (seq: number, clientMessageId: string | null = null, status: 'pending' | 'sent' | 'read' = 'sent') => ({
      id: seq > 0 ? `msg_${seq}` : null,
      seq,
      clientMessageId,
      sender: 'visitor' as const,
      authorName: null,
      text: null,
      attachments: [],
      quickReplies: null,
      status,
      createdAt: null,
    });
    const merged = mergeChatMessages([m(3), m(1), m(0, 'm_local001', 'pending')], [m(2), m(3, null, 'read')]);
    expect(merged.map((x) => x.seq)).toEqual([1, 2, 3, 0]);
    expect(merged[2]!.status).toBe('read');
    expect(mergeChatMessages(merged, [m(4, 'm_local001')]).map((x) => x.seq)).toEqual([1, 2, 3, 4]);
  });
});
