/**
 * HeroSignal yerel modül sözleşmesi (TurboModule / codegen kaynağı).
 *
 * Bu dosya codegen tarafından okunur (`codegenConfig.jsSrcsDir = src`); yalnızca codegen'in desteklediği tipler
 * kullanılır. Haritalar (`Object`) yerel tarafta `ReadableMap` / `NSDictionary` olarak gelir; codegen `object` veya
 * `Record` kabul etmediğinden bu satırlarda satır bazlı lint istisnası vardır. Eski mimaride aynı metotlar `NativeModules.HeroSignal` üzerinden çağrılır (bkz. `native.ts`).
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // --- Başlatma ve gizlilik ---
  /** options: { apiUrl, requiresPrivacyConsent, logLevel, appGroup, apnsEnvironment, provisionalAuthorization, defaultChannelId, defaultChannelName } */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  initialize(appId: string, options: Object): Promise<void>;
  setConsentGiven(given: boolean): void;
  login(externalId: string, identityHash: string | null): Promise<void>;
  logout(): void;

  // --- Kullanıcı ---
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  addTags(tags: Object): Promise<void>;
  removeTags(keys: Array<string>): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  getTags(): Promise<Object>;
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  addAliases(aliases: Object): Promise<void>;
  removeAlias(label: string): Promise<void>;
  setLanguage(code: string): Promise<void>;
  addEmail(email: string): Promise<void>;
  removeEmail(email: string): Promise<void>;
  addSms(phoneNumber: string): Promise<void>;
  removeSms(phoneNumber: string): Promise<void>;
  getExternalId(): Promise<string | null>;
  getUserId(): Promise<string | null>;
  /** Sonuç: { preferences: [{ category, channel, optedIn, explicit, source, updatedAt }], categories: [{ key, name, description, channels, defaultOptedIn }] } */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  getPreferences(): Promise<Object>;
  /** preferences: [{ category, channel (null = tüm kanallar), optedIn }]; sonuç `getPreferences` ile aynı biçimdedir. */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  setPreferences(preferences: Array<Object>): Promise<Object>;

  // --- Push aboneliği ---
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  getPushSubscriptionState(): Promise<Object>;
  optIn(): void;
  optOut(): void;

  // --- Bildirimler ---
  getPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  clearAll(): void;
  setForegroundHandlerEnabled(enabled: boolean): void;
  /** Ön plan olayı için bildirimi gösterir (bir kez). */
  displayNotification(notificationId: string): void;
  /** Ön plan olayı için gösterimi engeller; 25 sn içinde `displayNotification` ile yine gösterilebilir. */
  preventDefault(notificationId: string): void;

  // --- Oturum / olay ---
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  sendEvent(name: string, properties: Object, value: number | null): void;

  // --- In-app ---
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  addTriggers(triggers: Object): Promise<void>;
  removeTriggers(keys: Array<string>): void;
  clearTriggers(): void;
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  getTriggers(): Promise<Object>;
  setScreen(name: string | null): void;
  setInAppPaused(paused: boolean): void;
  getInAppPaused(): Promise<boolean>;

  // --- Bildirim kutusu ---
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  inboxList(limit: number, cursor: string | null): Promise<Object>;
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  inboxMarkRead(id: string): Promise<Object>;
  inboxMarkAllRead(): Promise<number>;
  inboxArchive(id: string): Promise<void>;
  inboxUnreadCount(): Promise<number>;

  // --- Hata ayıklama ---
  setLogLevel(level: string): void;

  // --- NativeEventEmitter ---
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.get<Spec>('HeroSignal');
