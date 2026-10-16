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

/** Yerel köprünün tercih sonucu (Android `HsPreferencesResult.toMap()` / iOS `map(HSPreferencesResult)` biçimi). */
const PREFERENCES_RAW = {
  preferences: [
    { category: 'promo', channel: null, optedIn: false, explicit: true, source: 'sdk', updatedAt: 1700000000000 },
    { category: 'news', channel: 'email', optedIn: true, explicit: false, source: null, updatedAt: null },
    // Kategorisiz kayıt yerel ayrıştırıcıda olduğu gibi atlanır.
    { channel: 'sms', optedIn: true },
  ],
  categories: [
    { key: 'promo', name: { tr: 'Kampanyalar', en: 'Promotions' }, description: { tr: 'İndirimler' }, channels: ['email', 'android_push'], defaultOptedIn: false },
    { key: 'news', name: { en: 'News' }, description: {}, channels: null, defaultOptedIn: true },
    { name: { en: 'Anahtarsız' } },
  ],
};

function createNative(): Record<string, jest.Mock> {
  const resolved = (value: unknown = undefined) => jest.fn(() => Promise.resolve(value));
  return {
    initialize: resolved(),
    setConsentGiven: jest.fn(),
    login: resolved(),
    updateUserJwt: resolved(),
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
    getEmails: resolved(['ali@example.com', 5]),
    getSmsNumbers: resolved(['+905321234567']),
    getPreferences: resolved(PREFERENCES_RAW),
    setPreferences: resolved(PREFERENCES_RAW),
    getPushSubscriptionState: resolved({ id: 'sub_1', token: 'tok', optedIn: true, permission: true }),
    optIn: jest.fn(),
    optOut: jest.fn(),
    getPermission: resolved(true),
    requestPermission: resolved(false),
    clearAll: jest.fn(),
    removeNotification: resolved(),
    removeGroupedNotifications: resolved(),
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
    setupDefaultLiveActivity: resolved(),
    startDefaultLiveActivity: resolved(),
    setLocationShared: jest.fn(),
    isLocationShared: resolved(true),
    requestLocationPermission: resolved(true),
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
    NativeModules: options.legacy ? { Pushizo: native } : {},
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

describe('Pushizo (React Native)', () => {
  test('initialize: appId ve tanımlı seçenekler yerel modüle iletilir, izin önbelleği güncellenir', async () => {
    const { Pushizo, LogLevel, env } = load();
    await Pushizo.initialize('app_1', { apiUrl: 'https://api.example.com', logLevel: LogLevel.Debug, appGroup: undefined });
    expect(env.native.initialize).toHaveBeenCalledWith('app_1', { apiUrl: 'https://api.example.com', logLevel: 'debug' });
    expect(Pushizo.Notifications.permission).toBe(true);
    // izin olayı içeride dinlenir; tekrar initialize ikinci abonelik açmaz
    await Pushizo.initialize('app_1');
    expect(env.listenerCount('Pushizo-permissionChange')).toBe(1);
  });

  test('initialize: geçersiz appId ve günlük seviyesi reddedilir', async () => {
    const { Pushizo, env } = load();
    await expect(Pushizo.initialize('  ')).rejects.toThrow('appId');
    await expect(Pushizo.initialize('app_1', { logLevel: 'verbose' as never })).rejects.toThrow('günlük seviyesi');
    expect(env.native.initialize).not.toHaveBeenCalled();
  });

  test('eski mimari: TurboModule yoksa NativeModules.Pushizo kullanılır', async () => {
    const { Pushizo, env } = load({ turbo: false, legacy: true });
    await Pushizo.login('user_42');
    expect(env.native.login).toHaveBeenCalledWith('user_42', null, null);
  });

  test('yerel modül bağlı değilse açıklayıcı hata verilir', () => {
    const { Pushizo } = load({ turbo: false, legacy: false });
    expect(() => Pushizo.logout()).toThrow('yerel modülü bulunamadı');
  });

  test('login/logout/consent', async () => {
    const { Pushizo, env } = load();
    await Pushizo.login('user_42', 'hash');
    Pushizo.logout();
    Pushizo.setConsentGiven(true);
    expect(env.native.login).toHaveBeenCalledWith('user_42', 'hash', null);
    expect(env.native.logout).toHaveBeenCalled();
    expect(env.native.setConsentGiven).toHaveBeenCalledWith(true);
  });

  test('JWT identity verification: login seçenekleri ve updateUserJwt', async () => {
    const { Pushizo, env } = load();
    await Pushizo.login('user_42', { jwt: 'a.b.c' });
    expect(env.native.login).toHaveBeenLastCalledWith('user_42', null, 'a.b.c');
    await Pushizo.login('user_42', { identityHash: 'hash', jwt: 'a.b.c' });
    expect(env.native.login).toHaveBeenLastCalledWith('user_42', 'hash', 'a.b.c');
    await Pushizo.login('user_42', {});
    expect(env.native.login).toHaveBeenLastCalledWith('user_42', null, null);
    expect(() => Pushizo.login('user_42', { jwt: ' ' })).toThrow('jwt');

    await Pushizo.updateUserJwt('d.e.f');
    expect(env.native.updateUserJwt).toHaveBeenCalledWith('d.e.f');
    expect(() => Pushizo.updateUserJwt('')).toThrow('jwt');
  });

  test('LiveActivities: genel tür kurulumu ve yerel başlatma argümanları yerel modüle iletilir', async () => {
    const { Pushizo, env } = load();
    await Pushizo.LiveActivities.setupDefaultLiveActivity();
    expect(env.native.setupDefaultLiveActivity).toHaveBeenCalledTimes(1);

    await Pushizo.LiveActivities.startDefaultLiveActivity('order_42', { title: 'Sipariş #42' }, { status: 'Yolda', eta: 12, late: false });
    expect(env.native.startDefaultLiveActivity).toHaveBeenCalledWith(
      'order_42',
      { title: 'Sipariş #42' },
      { status: 'Yolda', eta: 12, late: false },
    );
    await Pushizo.LiveActivities.startDefaultLiveActivity('ns:order.1-a', {}, {});
    expect(env.native.startDefaultLiveActivity).toHaveBeenLastCalledWith('ns:order.1-a', {}, {});
  });

  test('LiveActivities: geçersiz kimlik, nesne, anahtar ve değerler yerel modüle gitmeden reddedilir', () => {
    const { Pushizo, env } = load();
    const start = (...args: Parameters<typeof Pushizo.LiveActivities.startDefaultLiveActivity>) =>
      Pushizo.LiveActivities.startDefaultLiveActivity(...args);
    expect(() => start('', {}, {})).toThrow('activityId');
    expect(() => start('a'.repeat(101), {}, {})).toThrow('activityId');
    expect(() => start('sipariş 42', {}, {})).toThrow('activityId');
    expect(() => start(42 as never, {}, {})).toThrow(TypeError);
    expect(() => start('order_42', null as never, {})).toThrow('attributes düz bir nesne');
    expect(() => start('order_42', [] as never, {})).toThrow('attributes düz bir nesne');
    expect(() => start('order_42', new Date() as never, {})).toThrow('attributes düz bir nesne');
    expect(() => start('order_42', {}, 'durum' as never)).toThrow('contentState düz bir nesne');
    expect(() => start('order_42', { pushizo: 'x' }, {})).toThrow("'pushizo' anahtarı ayrılmıştır");
    expect(() => start('order_42', { ['k'.repeat(65)]: 'x' }, {})).toThrow('1-64');
    expect(() => start('order_42', { '': 'x' }, {})).toThrow('1-64');
    expect(() => start('order_42', {}, { eta: Number.NaN })).toThrow('contentState.eta');
    expect(() => start('order_42', {}, { eta: Infinity })).toThrow('contentState.eta');
    expect(() => start('order_42', {}, { nested: { a: 1 } } as never)).toThrow('contentState.nested');
    expect(() => start('order_42', { note: null } as never, {})).toThrow('attributes.note');
    // contentState içinde `pushizo` ayrılmış değildir.
    expect(() => start('order_42', {}, { pushizo: 'ok' })).not.toThrow();
    expect(env.native.startDefaultLiveActivity).toHaveBeenCalledTimes(1);
  });

  test('LiveActivities: yerel hata kodu (ör. Android PLATFORM_NOT_SUPPORTED) çağırana aynen iletilir', async () => {
    const { Pushizo, env } = load();
    const error = Object.assign(new Error("Live Activities yalnızca iOS'ta desteklenir"), { code: 'PLATFORM_NOT_SUPPORTED' });
    env.native.setupDefaultLiveActivity.mockReturnValueOnce(Promise.reject(error));
    await expect(Pushizo.LiveActivities.setupDefaultLiveActivity()).rejects.toMatchObject({ code: 'PLATFORM_NOT_SUPPORTED' });
  });

  test('Location: setShared ve isShared yerel modüle iletilir', async () => {
    const { Pushizo, env } = load();
    Pushizo.Location.setShared(true);
    Pushizo.Location.setShared(false);
    // Mantıksal olmayan değer paylaşımı açmaz (gizlilik açısından güvenli varsayılan).
    Pushizo.Location.setShared('true' as never);
    expect(env.native.setLocationShared.mock.calls).toEqual([[true], [false], [false]]);

    await expect(Pushizo.Location.isShared()).resolves.toBe(true);
    env.native.isLocationShared.mockResolvedValueOnce(null);
    await expect(Pushizo.Location.isShared()).resolves.toBe(false);
    expect(env.native.isLocationShared).toHaveBeenCalledTimes(2);
  });

  test('Location.requestPermission: açıklama metni iletilir, boş metin varsayılana düşer, sonuç döner', async () => {
    const { Pushizo, env } = load();
    await expect(Pushizo.Location.requestPermission()).resolves.toBe(true);
    expect(env.native.requestLocationPermission).toHaveBeenLastCalledWith(null);
    await Pushizo.Location.requestPermission('Yakındaki mağazaları göstermek için konumunuzu kullanırız.');
    expect(env.native.requestLocationPermission).toHaveBeenLastCalledWith('Yakındaki mağazaları göstermek için konumunuzu kullanırız.');
    await Pushizo.Location.requestPermission('   ');
    expect(env.native.requestLocationPermission).toHaveBeenLastCalledWith(null);
    env.native.requestLocationPermission.mockResolvedValueOnce(false);
    await expect(Pushizo.Location.requestPermission()).resolves.toBe(false);
  });

  test('Location.requestPermission: geçersiz açıklama yerel modüle gitmez; NO_ACTIVITY iletilir', async () => {
    const { Pushizo, env } = load();
    await expect(Pushizo.Location.requestPermission(42 as never)).rejects.toThrow('rationale');
    expect(env.native.requestLocationPermission).not.toHaveBeenCalled();
    env.native.requestLocationPermission.mockReturnValueOnce(
      Promise.reject(Object.assign(new Error('İzin istemek için ön planda bir ReactActivity gerekli.'), { code: 'NO_ACTIVITY' })),
    );
    await expect(Pushizo.Location.requestPermission()).rejects.toMatchObject({ code: 'NO_ACTIVITY' });
  });

  test('Location: eski mimaride NativeModules.Pushizo kullanılır', async () => {
    const { Pushizo, env } = load({ turbo: false, legacy: true });
    Pushizo.Location.setShared(true);
    await expect(Pushizo.Location.isShared()).resolves.toBe(true);
    expect(env.native.setLocationShared).toHaveBeenCalledWith(true);
  });

  test('User: tag, alias, dil, e-posta/SMS ve kimlikler', async () => {
    const { Pushizo, env } = load();
    await Pushizo.User.addTag('plan', 'pro');
    await Pushizo.User.addTags({ a: '1', b: '2' });
    await Pushizo.User.removeTag('plan');
    await Pushizo.User.addAlias('crm_id', '42');
    await Pushizo.User.removeAlias('crm_id');
    await Pushizo.User.setLanguage('tr');
    await Pushizo.User.addEmail('ali@example.com');
    await Pushizo.User.addSms('+905321234567');
    expect(env.native.addTags).toHaveBeenNthCalledWith(1, { plan: 'pro' });
    expect(env.native.addTags).toHaveBeenNthCalledWith(2, { a: '1', b: '2' });
    expect(env.native.removeTags).toHaveBeenCalledWith(['plan']);
    expect(env.native.addAliases).toHaveBeenCalledWith({ crm_id: '42' });
    expect(env.native.removeAlias).toHaveBeenCalledWith('crm_id');
    expect(env.native.setLanguage).toHaveBeenCalledWith('tr');
    expect(env.native.addEmail).toHaveBeenCalledWith('ali@example.com');
    expect(env.native.addSms).toHaveBeenCalledWith('+905321234567');
    await expect(Pushizo.User.getTags()).resolves.toEqual({ plan: 'pro', level: '3' });
    await expect(Pushizo.User.getExternalId()).resolves.toBe('user_42');
    await expect(Pushizo.User.getPushizoId()).resolves.toBe('hs_1');
    await expect(Pushizo.User.getEmails()).resolves.toEqual(['ali@example.com']);
    await expect(Pushizo.User.getSmsNumbers()).resolves.toEqual(['+905321234567']);
  });

  test('User: e-posta/SMS listesi yerelden dizi dışı gelirse boş liste döner', async () => {
    const { Pushizo, env } = load();
    env.native.getEmails.mockResolvedValueOnce(null);
    env.native.getSmsNumbers.mockResolvedValueOnce(undefined);
    await expect(Pushizo.User.getEmails()).resolves.toEqual([]);
    await expect(Pushizo.User.getSmsNumbers()).resolves.toEqual([]);
  });

  test('User: hatalı argümanlar yerel modüle gitmeden reddedilir', () => {
    const { Pushizo, env } = load();
    expect(() => Pushizo.User.addTags({ a: 1 } as never)).toThrow('tags.a');
    expect(() => Pushizo.User.removeTags('a' as never)).toThrow('metin dizisi');
    expect(() => Pushizo.User.addEmail('')).toThrow('email');
    expect(env.native.addTags).not.toHaveBeenCalled();
  });

  test('User: yerel doğrulama hatası (INVALID_ARGUMENT) uygulamaya iletilir', async () => {
    const { Pushizo, env } = load();
    env.native.addEmail.mockImplementationOnce(() => Promise.reject(Object.assign(new Error('Geçersiz e-posta'), { code: 'INVALID_ARGUMENT' })));
    await expect(Pushizo.User.addEmail('bozuk')).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  test('User.getPreferences: yerel sonuç tipli modele eşlenir', async () => {
    const { Pushizo, env } = load();
    const result = await Pushizo.User.getPreferences();
    expect(env.native.getPreferences).toHaveBeenCalledWith();
    expect(result).toEqual({
      preferences: [
        { category: 'promo', channel: null, optedIn: false, explicit: true, source: 'sdk', updatedAt: 1700000000000 },
        { category: 'news', channel: 'email', optedIn: true, explicit: false, source: null, updatedAt: null },
      ],
      categories: [
        { key: 'promo', name: { tr: 'Kampanyalar', en: 'Promotions' }, description: { tr: 'İndirimler' }, channels: ['email', 'android_push'], defaultOptedIn: false },
        { key: 'news', name: { en: 'News' }, description: {}, channels: null, defaultOptedIn: true },
      ],
    });
  });

  test('User.getPreferences: boş/eksik yerel sonuç boş listelere düşer; NOT_READY iletilir', async () => {
    const { Pushizo, env } = load();
    env.native.getPreferences.mockImplementationOnce(() => Promise.resolve(null));
    await expect(Pushizo.User.getPreferences()).resolves.toEqual({ preferences: [], categories: [] });
    env.native.getPreferences.mockImplementationOnce(() => Promise.resolve({ preferences: 'bozuk', categories: [null, 3] }));
    await expect(Pushizo.User.getPreferences()).resolves.toEqual({ preferences: [], categories: [] });
    env.native.getPreferences.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('Abonelik henüz kaydedilmedi'), { code: 'NOT_READY' })),
    );
    await expect(Pushizo.User.getPreferences()).rejects.toMatchObject({ code: 'NOT_READY' });
  });

  test('User.setPreferences: girdi normalize edilip yerel modüle iletilir, güncel tercihler döner', async () => {
    const { Pushizo, env } = load();
    const result = await Pushizo.User.setPreferences([
      { category: 'promo', optedIn: false },
      { category: 'news', channel: 'email', optedIn: true },
      { category: 'alerts', channel: null, optedIn: true },
    ]);
    expect(env.native.setPreferences).toHaveBeenCalledWith([
      { category: 'promo', channel: null, optedIn: false },
      { category: 'news', channel: 'email', optedIn: true },
      { category: 'alerts', channel: null, optedIn: true },
    ]);
    expect(result.preferences).toHaveLength(2);
    expect(result.categories.map((c) => c.key)).toEqual(['promo', 'news']);
  });

  test('User.setPreferences: hatalı girdi yerel modüle gitmeden reddedilir', () => {
    const { Pushizo, env } = load();
    const tooMany = Array.from({ length: 101 }, (_, i) => ({ category: `c${i}`, optedIn: true }));
    expect(() => Pushizo.User.setPreferences([])).toThrow('1-100');
    expect(() => Pushizo.User.setPreferences(tooMany)).toThrow('1-100');
    expect(() => Pushizo.User.setPreferences('promo' as never)).toThrow('dizi');
    expect(() => Pushizo.User.setPreferences([null as never])).toThrow('preferences[0] bir nesne');
    expect(() => Pushizo.User.setPreferences([{ category: ' ', optedIn: true }])).toThrow('preferences[0].category');
    expect(() => Pushizo.User.setPreferences([{ category: 'x'.repeat(65), optedIn: true }])).toThrow('category');
    expect(() => Pushizo.User.setPreferences([{ category: 'promo', channel: 'push' as never, optedIn: true }])).toThrow('channel');
    expect(() => Pushizo.User.setPreferences([{ category: 'a', optedIn: true }, { category: 'b', optedIn: 'yes' as never }])).toThrow(
      'preferences[1].optedIn',
    );
    expect(env.native.setPreferences).not.toHaveBeenCalled();
  });

  test('User.setPreferences: yerel doğrulama/API hatası uygulamaya iletilir', async () => {
    const { Pushizo, env } = load();
    env.native.setPreferences.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('Kategori bulunamadı'), { code: 'HS_VALIDATION_ERROR' })),
    );
    await expect(Pushizo.User.setPreferences([{ category: 'missing', optedIn: true }])).rejects.toMatchObject({
      code: 'HS_VALIDATION_ERROR',
    });
  });

  test('pushSubscription: durum ve değişim olayı', async () => {
    const { Pushizo, env } = load();
    await expect(Pushizo.User.pushSubscription.getIdAsync()).resolves.toBe('sub_1');
    await expect(Pushizo.User.pushSubscription.getTokenAsync()).resolves.toBe('tok');
    await expect(Pushizo.User.pushSubscription.getOptedInAsync()).resolves.toBe(true);
    Pushizo.User.pushSubscription.optOut();
    Pushizo.User.pushSubscription.optIn();
    expect(env.native.optOut).toHaveBeenCalled();
    expect(env.native.optIn).toHaveBeenCalled();

    const listener = jest.fn();
    Pushizo.User.pushSubscription.addEventListener('change', listener);
    env.emit('Pushizo-pushSubscriptionChange', {
      previous: { id: null, token: null, optedIn: false, permission: false },
      current: { id: 'sub_1', token: 'tok', optedIn: true, permission: true },
    });
    expect(listener).toHaveBeenCalledWith({
      previous: { id: null, token: null, optedIn: false, permission: false },
      current: { id: 'sub_1', token: 'tok', optedIn: true, permission: true },
    });
    Pushizo.User.pushSubscription.removeEventListener('change', listener);
    expect(env.listenerCount('Pushizo-pushSubscriptionChange')).toBe(0);
  });

  test('Notifications: izin isteme, sorgu ve clearAll', async () => {
    const { Pushizo, env } = load();
    await expect(Pushizo.Notifications.requestPermission()).resolves.toBe(false);
    expect(Pushizo.Notifications.permission).toBe(false);
    await expect(Pushizo.Notifications.getPermissionAsync()).resolves.toBe(true);
    expect(Pushizo.Notifications.permission).toBe(true);
    Pushizo.Notifications.clearAll();
    expect(env.native.clearAll).toHaveBeenCalled();
  });

  test('Notifications: tekil ve gruplu bildirim kaldırma yerel modüle iletilir', async () => {
    const { Pushizo, env } = load();
    await Pushizo.Notifications.removeNotification(42);
    await Pushizo.Notifications.removeNotification('ios-request-1');
    await Pushizo.Notifications.removeGroupedNotifications('orders');
    expect(env.native.removeNotification).toHaveBeenNthCalledWith(1, '42');
    expect(env.native.removeNotification).toHaveBeenNthCalledWith(2, 'ios-request-1');
    expect(env.native.removeGroupedNotifications).toHaveBeenCalledWith('orders');
    expect(() => Pushizo.Notifications.removeNotification(1.5)).toThrow('tamsayı');
    expect(() => Pushizo.Notifications.removeNotification(' ')).toThrow(TypeError);
    expect(() => Pushizo.Notifications.removeGroupedNotifications('')).toThrow(TypeError);
    expect(env.native.removeNotification).toHaveBeenCalledTimes(2);
    expect(env.native.removeGroupedNotifications).toHaveBeenCalledTimes(1);
  });

  test('Notifications: tıklama olayı plan 06 biçiminde iletilir; son dinleyici çıkınca abonelik kapanır', () => {
    const { Pushizo, env } = load();
    const listener = jest.fn();
    Pushizo.Notifications.addEventListener('click', listener);
    expect(env.native.addListener).toHaveBeenCalledWith('Pushizo-notificationClick');
    env.emit('Pushizo-notificationClick', {
      notification: { title: 'Kargo', body: 'Yolda', url: null, deliveryId: 'd1', messageId: 'm1', data: { order: '7' }, androidNotificationId: 77 },
      actionId: 'track',
      url: 'https://example.com/t/7',
    });
    expect(listener).toHaveBeenCalledWith({
      notification: {
        title: 'Kargo',
        body: 'Yolda',
        url: null,
        imageUrl: null,
        deliveryId: 'd1',
        messageId: 'm1',
        data: { order: '7' },
        androidNotificationId: 77,
      },
      result: { actionId: 'track', url: 'https://example.com/t/7' },
    });
    Pushizo.Notifications.removeEventListener('click', listener);
    expect(env.native.removeListeners).toHaveBeenCalledWith(1);
    expect(env.listenerCount('Pushizo-notificationClick')).toBe(0);
  });

  test('Notifications: bilinmeyen olay adı reddedilir', () => {
    const { Pushizo } = load();
    expect(() => Pushizo.Notifications.addEventListener('opened' as never, jest.fn())).toThrow('bilinmeyen');
  });

  test('foregroundWillDisplay: engellenmezse gösterilir, dinleyici hatası gösterimi engellemez', () => {
    const { Pushizo, env } = load();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const listener = jest.fn(() => {
      throw new Error('uygulama hatası');
    });
    Pushizo.Notifications.addEventListener('foregroundWillDisplay', listener);
    expect(env.native.setForegroundHandlerEnabled).toHaveBeenCalledWith(true);
    env.emit('Pushizo-notificationWillDisplay', { notificationId: 'n1', notification: { title: 'T', data: {} } });
    expect(listener).toHaveBeenCalled();
    expect(env.native.displayNotification).toHaveBeenCalledWith('n1');
    expect(env.native.preventDefault).not.toHaveBeenCalled();
    Pushizo.Notifications.removeEventListener('foregroundWillDisplay', listener);
    expect(env.native.setForegroundHandlerEnabled).toHaveBeenLastCalledWith(false);
    spy.mockRestore();
  });

  test('foregroundWillDisplay: preventDefault sonrası ertelenmiş display()', () => {
    const { Pushizo, env } = load();
    let captured: NotificationWillDisplayEvent | null = null;
    Pushizo.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      event.preventDefault();
      captured = event;
    });
    env.emit('Pushizo-notificationWillDisplay', { notificationId: 'n2', notification: { title: 'Sessiz', data: { silent: '1' } } });
    expect(env.native.preventDefault).toHaveBeenCalledWith('n2');
    expect(env.native.displayNotification).not.toHaveBeenCalled();
    const event = captured as unknown as NotificationWillDisplayEvent;
    expect(event.getNotification().data).toEqual({ silent: '1' });
    event.getNotification().display();
    expect(env.native.displayNotification).toHaveBeenCalledWith('n2');
  });

  test('permissionChange: dinleyici ve önbellek', async () => {
    const { Pushizo, env } = load();
    await Pushizo.initialize('app_1');
    const listener = jest.fn();
    Pushizo.Notifications.addEventListener('permissionChange', listener);
    env.emit('Pushizo-permissionChange', { permission: false });
    expect(listener).toHaveBeenCalledWith({ permission: false });
    expect(Pushizo.Notifications.permission).toBe(false);
    Pushizo.Notifications.removeEventListener('permissionChange', listener);
    // initialize'ın iç aboneliği açık kalır
    expect(env.listenerCount('Pushizo-permissionChange')).toBe(1);
  });

  test('InAppMessages: tetikler, ekran, duraklatma', async () => {
    const { Pushizo, env } = load();
    await Pushizo.InAppMessages.addTrigger('level', 'gold');
    Pushizo.InAppMessages.removeTrigger('level');
    Pushizo.InAppMessages.clearTriggers();
    Pushizo.InAppMessages.setScreen('cart');
    Pushizo.InAppMessages.setScreen('');
    Pushizo.InAppMessages.setPaused(true);
    expect(env.native.addTriggers).toHaveBeenCalledWith({ level: 'gold' });
    expect(env.native.removeTriggers).toHaveBeenCalledWith(['level']);
    expect(env.native.clearTriggers).toHaveBeenCalled();
    expect(env.native.setScreen).toHaveBeenNthCalledWith(1, 'cart');
    expect(env.native.setScreen).toHaveBeenNthCalledWith(2, null);
    expect(env.native.setInAppPaused).toHaveBeenCalledWith(true);
    await expect(Pushizo.InAppMessages.getTriggers()).resolves.toEqual({ level: 'gold' });
    await expect(Pushizo.InAppMessages.getPaused()).resolves.toBe(true);
  });

  test('InAppMessages: tıklama ve yaşam döngüsü olayları tek yerel abonelikle yönlendirilir', () => {
    const { Pushizo, env } = load();
    const click = jest.fn();
    const willDisplay = jest.fn();
    const didDismiss = jest.fn();
    Pushizo.InAppMessages.addEventListener('click', click);
    Pushizo.InAppMessages.addEventListener('willDisplay', willDisplay);
    Pushizo.InAppMessages.addEventListener('didDismiss', didDismiss);
    expect(env.listenerCount('Pushizo-inAppLifecycle')).toBe(1);

    env.emit('Pushizo-inAppClick', { messageId: 'm1', actionId: 'buy', url: null });
    env.emit('Pushizo-inAppLifecycle', { event: 'willDisplay', messageId: 'm1' });
    env.emit('Pushizo-inAppLifecycle', { event: 'didDismiss', messageId: 'm1' });
    expect(click).toHaveBeenCalledWith({ messageId: 'm1', actionId: 'buy', url: null });
    expect(willDisplay).toHaveBeenCalledWith({ messageId: 'm1' });
    expect(didDismiss).toHaveBeenCalledWith({ messageId: 'm1' });

    Pushizo.InAppMessages.removeEventListener('willDisplay', willDisplay);
    expect(env.listenerCount('Pushizo-inAppLifecycle')).toBe(1);
    Pushizo.InAppMessages.removeEventListener('didDismiss', didDismiss);
    expect(env.listenerCount('Pushizo-inAppLifecycle')).toBe(0);
  });

  test('Inbox: liste eşlemesi, limit doğrulaması ve işlemler', async () => {
    const { Pushizo, env } = load();
    const page = await Pushizo.Inbox.list({ limit: 20 });
    expect(env.native.inboxList).toHaveBeenCalledWith(20, null);
    expect(page).toEqual({
      items: [
        { id: 'i1', messageId: 'm1', title: 'Merhaba', body: null, url: null, imageUrl: null, data: { k: 'v' }, read: false, readAt: null, archivedAt: null, expiresAt: null, createdAt: 1700000000000 },
      ],
      unreadCount: 1,
      nextCursor: 'c2',
      hasMore: true,
    });
    await Pushizo.Inbox.list({ cursor: 'c2' });
    expect(env.native.inboxList).toHaveBeenLastCalledWith(50, 'c2');
    await expect(Pushizo.Inbox.list({ limit: 0 })).rejects.toThrow('limit');
    await expect(Pushizo.Inbox.markRead('i1')).resolves.toMatchObject({ id: 'i1', read: true, readAt: 1700000001000 });
    await expect(Pushizo.Inbox.markAllRead()).resolves.toBe(0);
    await Pushizo.Inbox.archive('i1');
    expect(env.native.inboxArchive).toHaveBeenCalledWith('i1');
    await expect(Pushizo.Inbox.unreadCount()).resolves.toBe(4);
  });

  test('Session.sendEvent ve Debug.setLogLevel', () => {
    const { Pushizo, LogLevel, env } = load();
    Pushizo.Session.sendEvent('purchase', { sku: 'a1' }, 49.9);
    Pushizo.Session.sendEvent('viewed');
    expect(env.native.sendEvent).toHaveBeenNthCalledWith(1, 'purchase', { sku: 'a1' }, 49.9);
    expect(env.native.sendEvent).toHaveBeenNthCalledWith(2, 'viewed', {}, null);
    expect(() => Pushizo.Session.sendEvent('x', {}, Number.NaN)).toThrow('value');
    Pushizo.Debug.setLogLevel(LogLevel.Info);
    expect(env.native.setLogLevel).toHaveBeenCalledWith('info');
    expect(() => Pushizo.Debug.setLogLevel('trace' as never)).toThrow('günlük seviyesi');
  });
});
