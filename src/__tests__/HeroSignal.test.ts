import type * as SdkModule from '../index';
import type * as MockModule from './support/reactNativeMock';

type Sdk = typeof SdkModule;
type Mock = typeof MockModule;

let sdk: Sdk;
let rn: Mock;
let native: MockModule.FakeNativeModule;

const flush = () => new Promise((resolve) => setImmediate(resolve));

const NOTIFICATION = {
  title: 'Başlık',
  body: 'Gövde',
  url: 'https://example.com',
  imageUrl: null,
  deliveryId: 'dlv_1',
  messageId: 'msg_1',
  groupKey: 'orders',
  androidNotificationId: 42,
  actions: [{ id: 'buy', title: 'Satın al', url: 'https://example.com/buy' }, { title: 'kimliksiz' }],
  data: { order: '7', count: 3 },
};

beforeEach(() => {
  jest.resetModules();
  rn = jest.requireActual<Mock>('react-native');
  sdk = jest.requireActual<Sdk>('../index');
  native = rn.fakeNativeModule();
});

describe('initialize ve kimlik', () => {
  it('seçenekleri native modüle iletir ve abonelik durumunu önbelleğe alır', async () => {
    sdk.HeroSignal.initialize('app_1', { apiUrl: 'https://api.example.com', logLevel: 'debug', appGroup: 'group.x' });
    expect(native.initialize).toHaveBeenCalledWith('app_1', {
      apiUrl: 'https://api.example.com',
      logLevel: 'debug',
      appGroup: 'group.x',
      requiresPrivacyConsent: false,
    });
    await flush();
    expect(sdk.HeroSignal.User.pushSubscription.id).toBe('sub_1');
    expect(sdk.HeroSignal.User.pushSubscription.token).toBe('tok');
    expect(sdk.HeroSignal.User.pushSubscription.optedIn).toBe(true);
    expect(sdk.HeroSignal.Notifications.permission).toBe(true);
  });

  it('setConsentRequired initialize seçeneğine yansır', () => {
    sdk.HeroSignal.setConsentRequired(true);
    expect(native.setConsentRequired).toHaveBeenCalledWith(true);
    sdk.HeroSignal.initialize('app_1');
    expect(native.initialize).toHaveBeenCalledWith('app_1', { requiresPrivacyConsent: true });
    sdk.HeroSignal.setConsentGiven(true);
    expect(native.setConsentGiven).toHaveBeenCalledWith(true);
  });

  it('geçersiz argümanları reddeder', () => {
    expect(() => sdk.HeroSignal.initialize('')).toThrow(sdk.HeroSignalError);
    expect(() => sdk.HeroSignal.initialize('app_1', { logLevel: 'verbose' as never })).toThrow(/logLevel/);
    expect(() => sdk.HeroSignal.login('  ')).toThrow(/externalId/);
  });

  it('login/logout', () => {
    sdk.HeroSignal.login('user_42');
    sdk.HeroSignal.login('user_43', 'hash');
    sdk.HeroSignal.logout();
    expect(native.login).toHaveBeenNthCalledWith(1, 'user_42', null);
    expect(native.login).toHaveBeenNthCalledWith(2, 'user_43', 'hash');
    expect(native.logout).toHaveBeenCalled();
  });

  it('native modül bağlı değilse açıklayıcı hata verir', () => {
    jest.resetModules();
    const mock = jest.requireActual<Mock>('react-native');
    mock.setFakeNativeModule(null);
    const fresh = jest.requireActual<Sdk>('../index');
    expect(() => fresh.HeroSignal.initialize('app_1')).toThrow(/native modülü bulunamadı/);
  });
});

describe('User', () => {
  it('tag değerlerini metne çevirir, boş istekleri atlar', async () => {
    sdk.HeroSignal.User.addTag('plan', 'pro');
    sdk.HeroSignal.User.addTags({ level: 3, vip: true });
    sdk.HeroSignal.User.addTags({});
    expect(native.addTags).toHaveBeenNthCalledWith(1, { plan: 'pro' });
    expect(native.addTags).toHaveBeenNthCalledWith(2, { level: '3', vip: 'true' });
    expect(native.addTags).toHaveBeenCalledTimes(2);
    expect(() => sdk.HeroSignal.User.addTags({ bad: {} as never })).toThrow(/bad/);
    sdk.HeroSignal.User.removeTag('plan');
    sdk.HeroSignal.User.removeTags(['a', 'b']);
    expect(native.removeTags).toHaveBeenNthCalledWith(1, ['plan']);
    expect(native.removeTags).toHaveBeenNthCalledWith(2, ['a', 'b']);
    await expect(sdk.HeroSignal.User.getTags()).resolves.toEqual({ plan: 'pro', level: '3' });
  });

  it('alias, dil ve kimlik okuma', async () => {
    sdk.HeroSignal.User.addAlias('crm_id', '42');
    sdk.HeroSignal.User.removeAliases(['crm_id', 'x']);
    sdk.HeroSignal.User.setLanguage('tr');
    expect(native.addAliases).toHaveBeenCalledWith({ crm_id: '42' });
    expect(native.removeAlias).toHaveBeenCalledTimes(2);
    expect(native.setLanguage).toHaveBeenCalledWith('tr');
    await expect(sdk.HeroSignal.User.getExternalId()).resolves.toBe('user_42');
    await expect(sdk.HeroSignal.User.getId()).resolves.toBe('usr_1');
  });

  it('e-posta/SMS native hatasını HeroSignalError olarak döndürür', async () => {
    native.addEmail.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('Geçersiz e-posta adresi.'), { code: 'INVALID_ARGUMENT' })),
    );
    await expect(sdk.HeroSignal.User.addEmail('kotu')).rejects.toMatchObject({
      name: 'HeroSignalError',
      code: 'INVALID_ARGUMENT',
      message: 'Geçersiz e-posta adresi.',
    });
    await sdk.HeroSignal.User.addSms('+905321234567');
    await sdk.HeroSignal.User.removeSms('+905321234567');
    await sdk.HeroSignal.User.removeEmail('a@b.co');
    expect(native.addSms).toHaveBeenCalledWith('+905321234567');
    expect(native.removeEmail).toHaveBeenCalledWith('a@b.co');
  });
});

describe('pushSubscription', () => {
  it('optIn/optOut ve async okuyucular', async () => {
    sdk.HeroSignal.User.pushSubscription.optIn();
    sdk.HeroSignal.User.pushSubscription.optOut();
    expect(native.optIn).toHaveBeenCalled();
    expect(native.optOut).toHaveBeenCalled();
    await expect(sdk.HeroSignal.User.pushSubscription.getIdAsync()).resolves.toBe('sub_1');
    await expect(sdk.HeroSignal.User.pushSubscription.getTokenAsync()).resolves.toBe('tok');
    await expect(sdk.HeroSignal.User.pushSubscription.getOptedInAsync()).resolves.toBe(true);
  });

  it('gözlemci önceki ve güncel durumu alır; izin gözlemcisi tetiklenir', () => {
    const observer = jest.fn();
    const permission = jest.fn();
    const sub = sdk.HeroSignal.User.pushSubscription.addObserver(observer);
    sdk.HeroSignal.Notifications.addPermissionObserver(permission);
    rn.emitNativeEvent('HeroSignal.pushSubscriptionChange', { id: 'sub_9', token: 't9', optedIn: true, permission: true });
    expect(observer).toHaveBeenCalledWith({
      previous: { id: null, token: null, optedIn: false, permission: false },
      current: { id: 'sub_9', token: 't9', optedIn: true, permission: true },
    });
    expect(permission).toHaveBeenCalledWith(true);
    expect(sdk.HeroSignal.User.pushSubscription.id).toBe('sub_9');
    sub.remove();
    // İç durum izleyicisi kalır; senkron okuyucular güncellenmeye devam eder.
    expect(rn.listenerCount('HeroSignal.pushSubscriptionChange')).toBe(1);
    rn.emitNativeEvent('HeroSignal.pushSubscriptionChange', { id: 'sub_9', token: 't10', optedIn: false, permission: true });
    expect(observer).toHaveBeenCalledTimes(1);
    expect(sdk.HeroSignal.User.pushSubscription.token).toBe('t10');
    expect(permission).toHaveBeenCalledTimes(1);
  });
});

describe('Notifications', () => {
  it('izin isteği sonucu ve durum yenilemesi', async () => {
    await expect(sdk.HeroSignal.Notifications.requestPermission()).resolves.toBe(true);
    expect(native.getPushSubscriptionState).toHaveBeenCalled();
    native.getPermission.mockResolvedValueOnce(false);
    await expect(sdk.HeroSignal.Notifications.getPermissionAsync()).resolves.toBe(false);
    expect(sdk.HeroSignal.Notifications.permission).toBe(false);
  });

  it('tıklama olayını ayrıştırır ve dinleyiciye iletir', () => {
    const listener = jest.fn();
    const failing = jest.fn(() => {
      throw new Error('dinleyici patladı');
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    sdk.HeroSignal.Notifications.addClickListener(failing);
    sdk.HeroSignal.Notifications.addClickListener(listener);
    expect(native.addListener).toHaveBeenCalledWith('HeroSignal.notificationClick');
    rn.emitNativeEvent('HeroSignal.notificationClick', { notification: NOTIFICATION, actionId: 'buy', url: 'https://example.com/buy' });
    expect(listener).toHaveBeenCalledWith({
      notification: {
        title: 'Başlık',
        body: 'Gövde',
        url: 'https://example.com',
        imageUrl: null,
        deliveryId: 'dlv_1',
        messageId: 'msg_1',
        groupKey: 'orders',
        androidNotificationId: 42,
        actions: [{ id: 'buy', title: 'Satın al', url: 'https://example.com/buy' }],
        data: { order: '7', count: '3' },
      },
      result: { actionId: 'buy', url: 'https://example.com/buy' },
    });
    expect(errorSpy).toHaveBeenCalled();
    sdk.HeroSignal.Notifications.removeClickListener(listener);
    sdk.HeroSignal.Notifications.removeClickListener(failing);
    expect(rn.listenerCount('HeroSignal.notificationClick')).toBe(0);
    errorSpy.mockRestore();
  });

  it('ön plan: engellenmezse gösterim, preventDefault + display ile ertelenmiş gösterim', () => {
    const sub = sdk.HeroSignal.Notifications.addForegroundLifecycleListener(() => undefined);
    expect(native.setForegroundHandlerEnabled).toHaveBeenLastCalledWith(true);
    rn.emitNativeEvent('HeroSignal.notificationWillDisplay', { eventId: 'e1', notification: NOTIFICATION });
    expect(native.completeForegroundDisplay).toHaveBeenLastCalledWith('e1', true);
    sub.remove();
    expect(native.setForegroundHandlerEnabled).toHaveBeenLastCalledWith(false);

    const held: SdkModule.NotificationWillDisplayEvent[] = [];
    sdk.HeroSignal.Notifications.addForegroundLifecycleListener((event) => {
      event.preventDefault();
      held.push(event);
    });
    rn.emitNativeEvent('HeroSignal.notificationWillDisplay', { eventId: 'e2', notification: NOTIFICATION });
    expect(native.completeForegroundDisplay).toHaveBeenLastCalledWith('e2', false);
    expect(held[0].getNotification().messageId).toBe('msg_1');
    expect(held[0].isPrevented).toBe(true);
    held[0].display();
    held[0].display();
    expect(native.displayNotification).toHaveBeenCalledTimes(1);
    expect(native.displayNotification).toHaveBeenCalledWith('e2');
  });

  it('dinleyici içinde display() çağrılırsa ikinci gösterim istenmez', () => {
    sdk.HeroSignal.Notifications.addForegroundLifecycleListener((event) => event.display());
    rn.emitNativeEvent('HeroSignal.notificationWillDisplay', { eventId: 'e3', notification: NOTIFICATION });
    expect(native.displayNotification).toHaveBeenCalledWith('e3');
    expect(native.completeForegroundDisplay).toHaveBeenLastCalledWith('e3', false);
  });

  it('tepsi temizleme yöntemleri', () => {
    sdk.HeroSignal.Notifications.clearAll();
    sdk.HeroSignal.Notifications.removeNotification(42);
    sdk.HeroSignal.Notifications.removeNotification('dlv_1');
    sdk.HeroSignal.Notifications.removeGroupedNotifications('orders');
    expect(native.clearAll).toHaveBeenCalled();
    expect(native.removeNotification).toHaveBeenNthCalledWith(1, '42');
    expect(native.removeNotification).toHaveBeenNthCalledWith(2, 'dlv_1');
    expect(native.removeGroupedNotifications).toHaveBeenCalledWith('orders');
    expect(() => sdk.HeroSignal.Notifications.removeNotification(1.5)).toThrow(/tam sayı/);
    expect(() => sdk.HeroSignal.Notifications.removeGroupedNotifications('')).toThrow(/group/);
  });
});

describe('Session', () => {
  it('değerli ve değersiz olay', () => {
    sdk.HeroSignal.Session.sendEvent('purchase', { sku: 'A1', items: [1, 2] }, 49.9);
    sdk.HeroSignal.Session.sendEvent('opened_cart');
    expect(native.sendEvent).toHaveBeenNthCalledWith(1, 'purchase', { sku: 'A1', items: [1, 2] }, 49.9, true);
    expect(native.sendEvent).toHaveBeenNthCalledWith(2, 'opened_cart', {}, 0, false);
    expect(() => sdk.HeroSignal.Session.sendEvent('x', {}, Number.NaN)).toThrow(/value/);
    expect(() => sdk.HeroSignal.Session.sendEvent('')).toThrow(/name/);
  });
});

describe('InAppMessages', () => {
  it('tetikler, ekran ve duraklatma', async () => {
    sdk.HeroSignal.InAppMessages.addTrigger('level', 5);
    sdk.HeroSignal.InAppMessages.removeTrigger('level');
    sdk.HeroSignal.InAppMessages.clearTriggers();
    sdk.HeroSignal.InAppMessages.setScreen('checkout');
    sdk.HeroSignal.InAppMessages.setScreen('');
    sdk.HeroSignal.InAppMessages.paused = true;
    expect(native.addTriggers).toHaveBeenCalledWith({ level: '5' });
    expect(native.removeTriggers).toHaveBeenCalledWith(['level']);
    expect(native.clearTriggers).toHaveBeenCalled();
    expect(native.setScreen).toHaveBeenNthCalledWith(1, 'checkout');
    expect(native.setScreen).toHaveBeenNthCalledWith(2, null);
    expect(native.setInAppPaused).toHaveBeenCalledWith(true);
    expect(sdk.HeroSignal.InAppMessages.paused).toBe(true);
    await expect(sdk.HeroSignal.InAppMessages.getTriggers()).resolves.toEqual({ level: 'gold' });
    await expect(sdk.HeroSignal.InAppMessages.getPausedAsync()).resolves.toBe(true);
    expect(() => sdk.HeroSignal.InAppMessages.addTrigger('k'.repeat(65), 'v')).toThrow(/1-64/);
    expect(() => sdk.HeroSignal.InAppMessages.addTrigger('k', 'v'.repeat(201))).toThrow(/200/);
  });

  it('tıklama ve yaşam döngüsü dinleyicileri', () => {
    const click = jest.fn();
    const willDisplay = jest.fn();
    const didDismiss = jest.fn();
    sdk.HeroSignal.InAppMessages.addClickListener(click);
    const lifecycle = { onWillDisplay: willDisplay, onDidDismiss: didDismiss };
    const sub = sdk.HeroSignal.InAppMessages.addLifecycleListener(lifecycle);
    // Aynı dinleyici iki kez eklenmez.
    sdk.HeroSignal.InAppMessages.addLifecycleListener(lifecycle);
    rn.emitNativeEvent('HeroSignal.inAppClick', { messageId: 'iam_1', actionId: 'cta', url: null });
    rn.emitNativeEvent('HeroSignal.inAppLifecycle', { event: 'willDisplay', messageId: 'iam_1' });
    rn.emitNativeEvent('HeroSignal.inAppLifecycle', { event: 'didDismiss', messageId: 'iam_1' });
    rn.emitNativeEvent('HeroSignal.inAppLifecycle', { event: 'unknown', messageId: 'iam_1' });
    expect(click).toHaveBeenCalledWith({ messageId: 'iam_1', result: { actionId: 'cta', url: null } });
    expect(willDisplay).toHaveBeenCalledTimes(1);
    expect(willDisplay).toHaveBeenCalledWith({ messageId: 'iam_1' });
    expect(didDismiss).toHaveBeenCalledTimes(1);
    sub.remove();
    expect(rn.listenerCount('HeroSignal.inAppLifecycle')).toBe(0);
  });
});

describe('Inbox', () => {
  it('liste ve işlemler', async () => {
    const page = await sdk.HeroSignal.Inbox.list({ limit: 20 });
    expect(native.inboxList).toHaveBeenCalledWith(20, null);
    expect(page).toEqual({
      items: [
        {
          id: 'i1',
          messageId: null,
          title: 'Merhaba',
          body: null,
          url: null,
          imageUrl: null,
          data: { k: 'v' },
          read: false,
          readAt: null,
          archivedAt: null,
          expiresAt: null,
          createdAt: 1700000000000,
        },
      ],
      unreadCount: 1,
      nextCursor: 'c2',
      hasMore: true,
    });
    await sdk.HeroSignal.Inbox.list({ cursor: 'c2' });
    expect(native.inboxList).toHaveBeenLastCalledWith(50, 'c2');
    await expect(sdk.HeroSignal.Inbox.markRead('i1')).resolves.toMatchObject({ id: 'i1', read: true, readAt: 1700000001000 });
    await expect(sdk.HeroSignal.Inbox.markAllRead()).resolves.toBe(0);
    await sdk.HeroSignal.Inbox.archive('i1');
    expect(native.inboxArchive).toHaveBeenCalledWith('i1');
    await expect(sdk.HeroSignal.Inbox.unreadCount()).resolves.toBe(4);
    await expect(sdk.HeroSignal.Inbox.list({ limit: 0 })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('NOT_READY hatası korunur', async () => {
    native.inboxUnreadCount.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('Abonelik henüz kaydedilmedi'), { code: 'NOT_READY' })),
    );
    await expect(sdk.HeroSignal.Inbox.unreadCount()).rejects.toMatchObject({ code: 'NOT_READY' });
  });
});

describe('Debug', () => {
  it('log düzeyi', () => {
    sdk.HeroSignal.Debug.setLogLevel('debug');
    expect(native.setLogLevel).toHaveBeenCalledWith('debug');
    expect(() => sdk.HeroSignal.Debug.setLogLevel('trace' as never)).toThrow(/level/);
  });
});
