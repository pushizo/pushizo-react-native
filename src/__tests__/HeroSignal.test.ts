/**
 * TS katmanı testleri: yerel modül (TurboModule / NativeModules) ve NativeEventEmitter sahte olarak verilir.
 */
import type * as Sdk from '../index';
import type { NotificationWillDisplayEvent } from '../index';

type Handler = (payload: unknown) => void;

interface MockEnv {
  native: Record<string, jest.Mock>;
  emit: (event: string, payload: unknown) => void;
  listenerCount: (event: string) => number;
}

function createNative(): Record<string, jest.Mock> {
  const resolved = (value: unknown = undefined) => jest.fn(() => Promise.resolve(value));
  return {
    initialize: resolved(),
    setConsentGiven: jest.fn(),
    login: resolved(),
    logout: jest.fn(),
    addTags: resolved(),
    removeTags: resolved(),
    getTags: resolved({ plan: 'pro', level: 3 }),
    addAliases: resolved(),
    removeAlias: resolved(),
    setLanguage: resolved(),
    addEmail: resolved(),
    removeEmail: resolved(),
    addSms: resolved(),
    removeSms: resolved(),
    getExternalId: resolved('user_42'),
    getUserId: resolved('hs_1'),
    getPushSubscriptionState: resolved({ id: 'sub_1', token: 'tok', optedIn: true, permission: true }),
    optIn: jest.fn(),
    optOut: jest.fn(),
    getPermission: resolved(true),
    requestPermission: resolved(false),
    clearAll: jest.fn(),
    setForegroundHandlerEnabled: jest.fn(),
    displayNotification: jest.fn(),
    preventDefault: jest.fn(),
    sendEvent: jest.fn(),
    addTriggers: resolved(),
    removeTriggers: jest.fn(),
    clearTriggers: jest.fn(),
    getTriggers: resolved({ level: 'gold' }),
    setScreen: jest.fn(),
    setInAppPaused: jest.fn(),
    getInAppPaused: resolved(true),
    inboxList: resolved({
      items: [
        { id: 'i1', messageId: 'm1', title: 'Merhaba', body: null, url: null, imageUrl: null, data: { k: 'v' }, read: false, readAt: null, archivedAt: null, expiresAt: null, createdAt: 1700000000000 },
      ],
      unreadCount: 1,
      nextCursor: 'c2',
      hasMore: true,
    }),
    inboxMarkRead: resolved({ id: 'i1', read: true, readAt: 1700000001000, data: {} }),
    inboxMarkAllRead: resolved(0),
    inboxArchive: resolved(),
    inboxUnreadCount: resolved(4),
    setLogLevel: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
}

/** react-native modülünü sahte modülle değiştirip paketi yeniden yükler. */
function load(options: { turbo?: boolean; legacy?: boolean } = { turbo: true }) {
  jest.resetModules();
  const native = createNative();
  const handlers = new Map<string, Set<Handler>>();
  jest.doMock('react-native', () => ({
    Platform: { OS: 'android', select: (o: Record<string, unknown>) => o.android ?? o.default },
    NativeModules: options.legacy ? { HeroSignal: native } : {},
    TurboModuleRegistry: { get: jest.fn(() => (options.turbo ? native : null)) },
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
  // Sahte react-native ile her testte taze modül gerekir (jest.resetModules sonrası); statik import bunu sağlayamaz.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sdk = require('../index') as typeof Sdk;
  const env: MockEnv = {
    native,
    emit: (event, payload) => handlers.get(event)?.forEach((h) => h(payload)),
    listenerCount: (event) => handlers.get(event)?.size ?? 0,
  };
  return { ...sdk, env };
}

describe('HeroSignal (React Native)', () => {
  test('initialize: appId ve tanımlı seçenekler yerel modüle iletilir, izin önbelleği güncellenir', async () => {
    const { HeroSignal, LogLevel, env } = load();
    await HeroSignal.initialize('app_1', { apiUrl: 'https://api.example.com', logLevel: LogLevel.Debug, appGroup: undefined });
    expect(env.native.initialize).toHaveBeenCalledWith('app_1', { apiUrl: 'https://api.example.com', logLevel: 'debug' });
    expect(HeroSignal.Notifications.permission).toBe(true);
    // izin olayı içeride dinlenir; tekrar initialize ikinci abonelik açmaz
    await HeroSignal.initialize('app_1');
    expect(env.listenerCount('HeroSignal-permissionChange')).toBe(1);
  });

  test('initialize: geçersiz appId ve günlük seviyesi reddedilir', async () => {
    const { HeroSignal, env } = load();
    await expect(HeroSignal.initialize('  ')).rejects.toThrow('appId');
    await expect(HeroSignal.initialize('app_1', { logLevel: 'verbose' as never })).rejects.toThrow('günlük seviyesi');
    expect(env.native.initialize).not.toHaveBeenCalled();
  });

  test('eski mimari: TurboModule yoksa NativeModules.HeroSignal kullanılır', async () => {
    const { HeroSignal, env } = load({ turbo: false, legacy: true });
    await HeroSignal.login('user_42');
    expect(env.native.login).toHaveBeenCalledWith('user_42', null);
  });

  test('yerel modül bağlı değilse açıklayıcı hata verilir', () => {
    const { HeroSignal } = load({ turbo: false, legacy: false });
    expect(() => HeroSignal.logout()).toThrow('yerel modülü bulunamadı');
  });

  test('login/logout/consent', async () => {
    const { HeroSignal, env } = load();
    await HeroSignal.login('user_42', 'hash');
    HeroSignal.logout();
    HeroSignal.setConsentGiven(true);
    expect(env.native.login).toHaveBeenCalledWith('user_42', 'hash');
    expect(env.native.logout).toHaveBeenCalled();
    expect(env.native.setConsentGiven).toHaveBeenCalledWith(true);
  });

  test('User: tag, alias, dil, e-posta/SMS ve kimlikler', async () => {
    const { HeroSignal, env } = load();
    await HeroSignal.User.addTag('plan', 'pro');
    await HeroSignal.User.addTags({ a: '1', b: '2' });
    await HeroSignal.User.removeTag('plan');
    await HeroSignal.User.addAlias('crm_id', '42');
    await HeroSignal.User.removeAlias('crm_id');
    await HeroSignal.User.setLanguage('tr');
    await HeroSignal.User.addEmail('ali@example.com');
    await HeroSignal.User.addSms('+905321234567');
    expect(env.native.addTags).toHaveBeenNthCalledWith(1, { plan: 'pro' });
    expect(env.native.addTags).toHaveBeenNthCalledWith(2, { a: '1', b: '2' });
    expect(env.native.removeTags).toHaveBeenCalledWith(['plan']);
    expect(env.native.addAliases).toHaveBeenCalledWith({ crm_id: '42' });
    expect(env.native.removeAlias).toHaveBeenCalledWith('crm_id');
    expect(env.native.setLanguage).toHaveBeenCalledWith('tr');
    expect(env.native.addEmail).toHaveBeenCalledWith('ali@example.com');
    expect(env.native.addSms).toHaveBeenCalledWith('+905321234567');
    await expect(HeroSignal.User.getTags()).resolves.toEqual({ plan: 'pro', level: '3' });
    await expect(HeroSignal.User.getExternalId()).resolves.toBe('user_42');
    await expect(HeroSignal.User.getHeroSignalId()).resolves.toBe('hs_1');
  });

  test('User: hatalı argümanlar yerel modüle gitmeden reddedilir', () => {
    const { HeroSignal, env } = load();
    expect(() => HeroSignal.User.addTags({ a: 1 } as never)).toThrow('tags.a');
    expect(() => HeroSignal.User.removeTags('a' as never)).toThrow('metin dizisi');
    expect(() => HeroSignal.User.addEmail('')).toThrow('email');
    expect(env.native.addTags).not.toHaveBeenCalled();
  });

  test('User: yerel doğrulama hatası (INVALID_ARGUMENT) uygulamaya iletilir', async () => {
    const { HeroSignal, env } = load();
    env.native.addEmail.mockImplementationOnce(() => Promise.reject(Object.assign(new Error('Geçersiz e-posta'), { code: 'INVALID_ARGUMENT' })));
    await expect(HeroSignal.User.addEmail('bozuk')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  test('pushSubscription: durum ve değişim olayı', async () => {
    const { HeroSignal, env } = load();
    await expect(HeroSignal.User.pushSubscription.getIdAsync()).resolves.toBe('sub_1');
    await expect(HeroSignal.User.pushSubscription.getTokenAsync()).resolves.toBe('tok');
    await expect(HeroSignal.User.pushSubscription.getOptedInAsync()).resolves.toBe(true);
    HeroSignal.User.pushSubscription.optOut();
    HeroSignal.User.pushSubscription.optIn();
    expect(env.native.optOut).toHaveBeenCalled();
    expect(env.native.optIn).toHaveBeenCalled();

    const listener = jest.fn();
    HeroSignal.User.pushSubscription.addEventListener('change', listener);
    env.emit('HeroSignal-pushSubscriptionChange', {
      previous: { id: null, token: null, optedIn: false, permission: false },
      current: { id: 'sub_1', token: 'tok', optedIn: true, permission: true },
    });
    expect(listener).toHaveBeenCalledWith({
      previous: { id: null, token: null, optedIn: false, permission: false },
      current: { id: 'sub_1', token: 'tok', optedIn: true, permission: true },
    });
    HeroSignal.User.pushSubscription.removeEventListener('change', listener);
    expect(env.listenerCount('HeroSignal-pushSubscriptionChange')).toBe(0);
  });

  test('Notifications: izin isteme, sorgu ve clearAll', async () => {
    const { HeroSignal, env } = load();
    await expect(HeroSignal.Notifications.requestPermission()).resolves.toBe(false);
    expect(HeroSignal.Notifications.permission).toBe(false);
    await expect(HeroSignal.Notifications.getPermissionAsync()).resolves.toBe(true);
    expect(HeroSignal.Notifications.permission).toBe(true);
    HeroSignal.Notifications.clearAll();
    expect(env.native.clearAll).toHaveBeenCalled();
  });

  test('Notifications: tıklama olayı plan 06 biçiminde iletilir; son dinleyici çıkınca abonelik kapanır', () => {
    const { HeroSignal, env } = load();
    const listener = jest.fn();
    HeroSignal.Notifications.addEventListener('click', listener);
    expect(env.native.addListener).toHaveBeenCalledWith('HeroSignal-notificationClick');
    env.emit('HeroSignal-notificationClick', {
      notification: { title: 'Kargo', body: 'Yolda', url: null, deliveryId: 'd1', messageId: 'm1', data: { order: '7' } },
      actionId: 'track',
      url: 'https://example.com/t/7',
    });
    expect(listener).toHaveBeenCalledWith({
      notification: { title: 'Kargo', body: 'Yolda', url: null, imageUrl: null, deliveryId: 'd1', messageId: 'm1', data: { order: '7' } },
      result: { actionId: 'track', url: 'https://example.com/t/7' },
    });
    HeroSignal.Notifications.removeEventListener('click', listener);
    expect(env.native.removeListeners).toHaveBeenCalledWith(1);
    expect(env.listenerCount('HeroSignal-notificationClick')).toBe(0);
  });

  test('Notifications: bilinmeyen olay adı reddedilir', () => {
    const { HeroSignal } = load();
    expect(() => HeroSignal.Notifications.addEventListener('opened' as never, jest.fn())).toThrow('bilinmeyen');
  });

  test('foregroundWillDisplay: engellenmezse gösterilir, dinleyici hatası gösterimi engellemez', () => {
    const { HeroSignal, env } = load();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const listener = jest.fn(() => {
      throw new Error('uygulama hatası');
    });
    HeroSignal.Notifications.addEventListener('foregroundWillDisplay', listener);
    expect(env.native.setForegroundHandlerEnabled).toHaveBeenCalledWith(true);
    env.emit('HeroSignal-notificationWillDisplay', { notificationId: 'n1', notification: { title: 'T', data: {} } });
    expect(listener).toHaveBeenCalled();
    expect(env.native.displayNotification).toHaveBeenCalledWith('n1');
    expect(env.native.preventDefault).not.toHaveBeenCalled();
    HeroSignal.Notifications.removeEventListener('foregroundWillDisplay', listener);
    expect(env.native.setForegroundHandlerEnabled).toHaveBeenLastCalledWith(false);
    spy.mockRestore();
  });

  test('foregroundWillDisplay: preventDefault sonrası ertelenmiş display()', () => {
    const { HeroSignal, env } = load();
    let captured: NotificationWillDisplayEvent | null = null;
    HeroSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      event.preventDefault();
      captured = event;
    });
    env.emit('HeroSignal-notificationWillDisplay', { notificationId: 'n2', notification: { title: 'Sessiz', data: { silent: '1' } } });
    expect(env.native.preventDefault).toHaveBeenCalledWith('n2');
    expect(env.native.displayNotification).not.toHaveBeenCalled();
    const event = captured as unknown as NotificationWillDisplayEvent;
    expect(event.getNotification().data).toEqual({ silent: '1' });
    event.getNotification().display();
    expect(env.native.displayNotification).toHaveBeenCalledWith('n2');
  });

  test('permissionChange: dinleyici ve önbellek', async () => {
    const { HeroSignal, env } = load();
    await HeroSignal.initialize('app_1');
    const listener = jest.fn();
    HeroSignal.Notifications.addEventListener('permissionChange', listener);
    env.emit('HeroSignal-permissionChange', { permission: false });
    expect(listener).toHaveBeenCalledWith({ permission: false });
    expect(HeroSignal.Notifications.permission).toBe(false);
    HeroSignal.Notifications.removeEventListener('permissionChange', listener);
    // initialize'ın iç aboneliği açık kalır
    expect(env.listenerCount('HeroSignal-permissionChange')).toBe(1);
  });

  test('InAppMessages: tetikler, ekran, duraklatma', async () => {
    const { HeroSignal, env } = load();
    await HeroSignal.InAppMessages.addTrigger('level', 'gold');
    HeroSignal.InAppMessages.removeTrigger('level');
    HeroSignal.InAppMessages.clearTriggers();
    HeroSignal.InAppMessages.setScreen('cart');
    HeroSignal.InAppMessages.setScreen('');
    HeroSignal.InAppMessages.setPaused(true);
    expect(env.native.addTriggers).toHaveBeenCalledWith({ level: 'gold' });
    expect(env.native.removeTriggers).toHaveBeenCalledWith(['level']);
    expect(env.native.clearTriggers).toHaveBeenCalled();
    expect(env.native.setScreen).toHaveBeenNthCalledWith(1, 'cart');
    expect(env.native.setScreen).toHaveBeenNthCalledWith(2, null);
    expect(env.native.setInAppPaused).toHaveBeenCalledWith(true);
    await expect(HeroSignal.InAppMessages.getTriggers()).resolves.toEqual({ level: 'gold' });
    await expect(HeroSignal.InAppMessages.getPaused()).resolves.toBe(true);
  });

  test('InAppMessages: tıklama ve yaşam döngüsü olayları tek yerel abonelikle yönlendirilir', () => {
    const { HeroSignal, env } = load();
    const click = jest.fn();
    const willDisplay = jest.fn();
    const didDismiss = jest.fn();
    HeroSignal.InAppMessages.addEventListener('click', click);
    HeroSignal.InAppMessages.addEventListener('willDisplay', willDisplay);
    HeroSignal.InAppMessages.addEventListener('didDismiss', didDismiss);
    expect(env.listenerCount('HeroSignal-inAppLifecycle')).toBe(1);

    env.emit('HeroSignal-inAppClick', { messageId: 'm1', actionId: 'buy', url: null });
    env.emit('HeroSignal-inAppLifecycle', { event: 'willDisplay', messageId: 'm1' });
    env.emit('HeroSignal-inAppLifecycle', { event: 'didDismiss', messageId: 'm1' });
    expect(click).toHaveBeenCalledWith({ messageId: 'm1', actionId: 'buy', url: null });
    expect(willDisplay).toHaveBeenCalledWith({ messageId: 'm1' });
    expect(didDismiss).toHaveBeenCalledWith({ messageId: 'm1' });

    HeroSignal.InAppMessages.removeEventListener('willDisplay', willDisplay);
    expect(env.listenerCount('HeroSignal-inAppLifecycle')).toBe(1);
    HeroSignal.InAppMessages.removeEventListener('didDismiss', didDismiss);
    expect(env.listenerCount('HeroSignal-inAppLifecycle')).toBe(0);
  });

  test('Inbox: liste eşlemesi, limit doğrulaması ve işlemler', async () => {
    const { HeroSignal, env } = load();
    const page = await HeroSignal.Inbox.list({ limit: 20 });
    expect(env.native.inboxList).toHaveBeenCalledWith(20, null);
    expect(page).toEqual({
      items: [
        { id: 'i1', messageId: 'm1', title: 'Merhaba', body: null, url: null, imageUrl: null, data: { k: 'v' }, read: false, readAt: null, archivedAt: null, expiresAt: null, createdAt: 1700000000000 },
      ],
      unreadCount: 1,
      nextCursor: 'c2',
      hasMore: true,
    });
    await HeroSignal.Inbox.list({ cursor: 'c2' });
    expect(env.native.inboxList).toHaveBeenLastCalledWith(50, 'c2');
    await expect(HeroSignal.Inbox.list({ limit: 0 })).rejects.toThrow('limit');
    await expect(HeroSignal.Inbox.markRead('i1')).resolves.toMatchObject({ id: 'i1', read: true, readAt: 1700000001000 });
    await expect(HeroSignal.Inbox.markAllRead()).resolves.toBe(0);
    await HeroSignal.Inbox.archive('i1');
    expect(env.native.inboxArchive).toHaveBeenCalledWith('i1');
    await expect(HeroSignal.Inbox.unreadCount()).resolves.toBe(4);
  });

  test('Session.sendEvent ve Debug.setLogLevel', () => {
    const { HeroSignal, LogLevel, env } = load();
    HeroSignal.Session.sendEvent('purchase', { sku: 'a1' }, 49.9);
    HeroSignal.Session.sendEvent('viewed');
    expect(env.native.sendEvent).toHaveBeenNthCalledWith(1, 'purchase', { sku: 'a1' }, 49.9);
    expect(env.native.sendEvent).toHaveBeenNthCalledWith(2, 'viewed', {}, null);
    expect(() => HeroSignal.Session.sendEvent('x', {}, Number.NaN)).toThrow('value');
    HeroSignal.Debug.setLogLevel(LogLevel.Info);
    expect(env.native.setLogLevel).toHaveBeenCalledWith('info');
    expect(() => HeroSignal.Debug.setLogLevel('trace' as never)).toThrow('günlük seviyesi');
  });
});
