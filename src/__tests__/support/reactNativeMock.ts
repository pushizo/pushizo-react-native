/**
 * Testlerde `react-native` yerine kullanılan hafif sahte modül: TurboModuleRegistry sahte native modülü döndürür,
 * NativeEventEmitter olayları `emitNativeEvent` ile tetiklenir.
 */
type Listener = (payload: unknown) => void;

const listeners = new Map<string, Set<Listener>>();

function promise<T>(value: T) {
  return jest.fn(() => Promise.resolve(value));
}

export function createFakeNativeModule() {
  return {
    initialize: jest.fn(),
    setConsentRequired: jest.fn(),
    setConsentGiven: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    addTags: jest.fn(),
    removeTags: jest.fn(),
    getTags: promise<object>({ plan: 'pro', level: 3, bad: { nested: true } }),
    addAliases: jest.fn(),
    removeAlias: jest.fn(),
    setLanguage: jest.fn(),
    addEmail: promise<void>(undefined),
    removeEmail: promise<void>(undefined),
    addSms: promise<void>(undefined),
    removeSms: promise<void>(undefined),
    getExternalId: promise<string | null>('user_42'),
    getUserId: promise<string | null>('usr_1'),
    getPushSubscriptionState: promise<object>({ id: 'sub_1', token: 'tok', optedIn: true, permission: true }),
    optIn: jest.fn(),
    optOut: jest.fn(),
    requestPermission: promise<boolean>(true),
    getPermission: promise<boolean>(true),
    setForegroundHandlerEnabled: jest.fn(),
    completeForegroundDisplay: jest.fn(),
    displayNotification: jest.fn(),
    clearAll: jest.fn(),
    removeNotification: jest.fn(),
    removeGroupedNotifications: jest.fn(),
    sendEvent: jest.fn(),
    addTriggers: jest.fn(),
    removeTriggers: jest.fn(),
    clearTriggers: jest.fn(),
    getTriggers: promise<object>({ level: 'gold' }),
    setScreen: jest.fn(),
    setInAppPaused: jest.fn(),
    getInAppPaused: promise<boolean>(true),
    inboxList: promise<object>({
      items: [{ id: 'i1', title: 'Merhaba', read: false, data: { k: 'v' }, createdAt: 1700000000000 }],
      unreadCount: 1,
      nextCursor: 'c2',
      hasMore: true,
    }),
    inboxMarkRead: promise<object>({ id: 'i1', read: true, readAt: 1700000001000 }),
    inboxMarkAllRead: promise<number>(0),
    inboxArchive: promise<void>(undefined),
    inboxUnreadCount: promise<number>(4),
    setLogLevel: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
}

export type FakeNativeModule = ReturnType<typeof createFakeNativeModule>;

const state: { module: FakeNativeModule | null } = { module: createFakeNativeModule() };

/** Sahte native modülü değiştirir (null: modül bağlı değil). */
export function setFakeNativeModule(module: FakeNativeModule | null): void {
  state.module = module;
}

export function fakeNativeModule(): FakeNativeModule {
  if (!state.module) throw new Error('sahte modül yok');
  return state.module;
}

/** Native olay yayınını taklit eder. */
export function emitNativeEvent(event: string, payload: unknown): void {
  for (const listener of Array.from(listeners.get(event) ?? [])) listener(payload);
}

export function listenerCount(event: string): number {
  return listeners.get(event)?.size ?? 0;
}

export function resetNativeListeners(): void {
  listeners.clear();
}

export const TurboModuleRegistry = {
  get: () => state.module,
  getEnforcing: () => state.module,
};

export const Platform = {
  OS: 'android',
  select<T>(spec: { ios?: T; android?: T; default?: T }): T | undefined {
    return spec.android ?? spec.default;
  },
};

export class NativeEventEmitter {
  private readonly module: { addListener?: (e: string) => void; removeListeners?: (n: number) => void } | undefined;

  constructor(module?: { addListener?: (e: string) => void; removeListeners?: (n: number) => void }) {
    this.module = module;
  }

  addListener(event: string, listener: Listener) {
    const set = listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(event, set);
    this.module?.addListener?.(event);
    return {
      remove: () => {
        set.delete(listener);
        this.module?.removeListeners?.(1);
      },
    };
  }
}
