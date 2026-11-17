/**
 * Pushizo yerel modül sözleşmesi (TurboModule / codegen kaynağı).
 *
 * Bu dosya codegen tarafından okunur (`codegenConfig.jsSrcsDir = src`); yalnızca codegen'in desteklediği tipler
 * kullanılır. Haritalar (`Object`) yerel tarafta `ReadableMap` / `NSDictionary` olarak gelir; codegen `object` veya
 * `Record` kabul etmediğinden bu satırlarda satır bazlı lint istisnası vardır. Eski mimaride aynı metotlar `NativeModules.Pushizo` üzerinden çağrılır (bkz. `native.ts`).
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

  // --- İçerik kartları (ADR-0082) ---
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır.
  contentCardsList(limit: number): Promise<Object>;
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır.
  contentCardEvent(id: string, event: string): Promise<Object>;

  // --- Canlı sohbet (ADR-0040) ---
  /** Sonuç: { userId, conversation } */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  chatStart(name: string | null, email: string | null, language: string | null): Promise<Object>;
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  chatGetConfig(language: string | null): Promise<Object>;
  /** Sonuç: { conversation, unreadCount } */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  chatGetConversation(): Promise<Object>;
  /** Sonuç: { messages: [ChatMessage], hasMore } */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  chatGetMessages(afterSeq: number | null, beforeSeq: number | null, limit: number): Promise<Object>;
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  chatSendMessage(text: string, optionId: string | null): Promise<Object>;
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  chatSendAttachmentData(base64: string, fileName: string, mimeType: string, text: string | null): Promise<Object>;
  /** Android `content://`/`file://`, iOS `file://` adresi. */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  chatSendAttachmentUri(uri: string, fileName: string, mimeType: string, text: string | null): Promise<Object>;
  chatMarkRead(seq: number): Promise<number>;
  chatRefreshUnreadCount(): Promise<number>;
  chatGetUnreadCount(): Promise<number>;
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  chatLeaveOfflineMessage(email: string, text: string, name: string | null): Promise<Object>;
  chatSetTyping(typing: boolean): void;
  chatStartListening(): void;
  chatStopListening(): void;
  chatAttachmentUrl(attachmentId: string, download: boolean): Promise<string>;
  chatGetVisitorId(): Promise<string | null>;

  // --- Live Activities (yalnızca iOS 16.1+; Android `PLATFORM_NOT_SUPPORTED` ile reddeder) ---
  /** Genel `PushizoDefaultLiveActivityAttributes` türünü izlemeye alır (push-to-start ve güncelleme belirteçleri). */
  setupDefaultLiveActivity(): Promise<void>;
  /** attributes / contentState: düz nesne; değerler metin, sayı veya mantıksal (JS katmanında doğrulanır). */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  startDefaultLiveActivity(activityId: string, attributes: Object, contentState: Object): Promise<void>;

  // --- Konum (v2 Faz 17b; yalnızca ön plan) ---
  /** Konum paylaşımını açar/kapatır (kalıcı); kapatınca sunucudaki konum ve rıza kaydı silinir (`location: null`). */
  setLocationShared(shared: boolean): void;
  /** Konum paylaşımı açık mı (kalıcı tercih; izin durumundan bağımsız). */
  isLocationShared(): Promise<boolean>;
  /** Açıklama diyaloğu (null → SDK'nın yerelleştirilmiş metni) ve "kullanırken" konum izni; sonuç: izin var/verildi mi. */
  requestLocationPermission(rationale: string | null): Promise<boolean>;

  // --- Arka plan bölge izleme (ADR-0065; varsayılan kapalı, köprü izin istemez) ---
  setGeofencingEnabled(enabled: boolean): void;
  /** Bölge izleme tercihi (kalıcı; izin durumundan bağımsız). */
  isGeofencingEnabled(): Promise<boolean>;

  // --- Android teslimat güçlendirme (ADR-0092; iOS'ta durum `{ supported: false }`, diğerleri etkisiz `false`) ---
  /** Sonuç: { supported, manufacturer, brand, vendor, aggressiveVendor, rom, romVersion, notificationsEnabled, channelBlocked, batteryOptimizationExempt, backgroundRestricted, standbyBucket, powerSaveMode, dataSaverEnabled, restricted, risk, recommendedSettings } */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  deliveryStatus(): Promise<Object>;
  /** Risk var ve hazır diyalog son `minIntervalDays` günde gösterilmedi mi. */
  deliveryShouldShowGuidance(minIntervalDays: number): Promise<boolean>;
  /** setting: `auto`, `notifications`, `auto_start`, `battery_optimization`, `app_details`; sonuç: bir ayar ekranı açıldı mı. */
  deliveryOpenSettings(setting: string): Promise<boolean>;
  /** Hazır açıklama diyaloğu (message null → SDK'nın yerelleştirilmiş metni); sonuç: kullanıcı kabul etti ve ayar ekranı açıldı mı. */
  deliveryShowGuidance(setting: string, message: string | null): Promise<boolean>;

  // --- Özellik bayrakları (ADR-0066) ---
  /** Değerleri hemen yeniler; sonuç: yenileme başarılı mı. */
  featureFlagsRefresh(): Promise<boolean>;
  featureFlagsIsEnabled(key: string, defaultValue: boolean): Promise<boolean>;
  /** Sonuç: { value } (metin, sayı, mantıksal, nesne, dizi veya null); varsayılan JS katmanında uygulanır. */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  featureFlagsGetValue(key: string): Promise<Object>;

  // --- Gömülü yerleşimler (ADR-0068) ---
  /** Sonuç: in-app mesaj haritaları (`types.ts` → `InAppMessage`); yerel katman rapor çağrıları için mesajları kimliğe göre önbelleğe alır. */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- codegen yalnızca `Object` (GenericObjectTypeAnnotation) tanır; `object`/Record ayrıştırılamaz.
  placementsList(key: string, limit: number): Promise<Array<Object>>;
  placementsReportImpression(messageId: string): void;
  placementsReportClick(messageId: string, buttonId: string): void;
  placementsReportDismiss(messageId: string): void;

  // --- Hata ayıklama ---
  setLogLevel(level: string): void;

  // --- NativeEventEmitter ---
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.get<Spec>('Pushizo');
