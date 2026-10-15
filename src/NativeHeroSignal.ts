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
  login(externalId: string, identityHash: string | null, jwt: string | null): Promise<void>;
  updateUserJwt(jwt: string): Promise<void>;
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
  /** Bu cihazda kaydedilmiş e-posta adresleri (yerel kayıt). */
  getEmails(): Promise<Array<string>>;
  /** Bu cihazda kaydedilmiş SMS numaraları (E.164, yerel kayıt). */
  getSmsNumbers(): Promise<Array<string>>;
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
  /** Android: `androidNotificationId` (metin olarak tamsayı); iOS: `UNNotificationRequest.identifier`. */
  removeNotification(id: string): Promise<void>;
  /** Android `android_group`, iOS `thread-id` grubundaki bildirimleri kaldırır. */
  removeGroupedNotifications(group: string): Promise<void>;
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

  // --- Live Activities (yalnızca iOS 16.1+; Android `PLATFORM_NOT_SUPPORTED` ile reddeder) ---
  /** Genel `HeroSignalDefaultLiveActivityAttributes` türünü izlemeye alır (push-to-start ve güncelleme belirteçleri). */
  setupDefaultLiveActivity(): Promise<void>;
  /** attributes / contentState: düz nesne; değerler metin, sayı veya mantıksal (JS katmanında doğrulanır). */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  startDefaultLiveActivity(activityId: string, attributes: Object, contentState: Object): Promise<void>;

  // --- Hata ayıklama ---
  setLogLevel(level: string): void;

  // --- NativeEventEmitter ---
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.get<Spec>('HeroSignal');
