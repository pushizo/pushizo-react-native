import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * HeroSignal native modül sözleşmesi (TurboModule codegen kaynağı, `codegenConfig.name = RNHeroSignalSpec`).
 * Android (Kotlin) ve iOS (ObjC++ / Swift) uygulamaları bu imzalarla birebir eşleşir; eski mimaride aynı modül
 * `NativeModules.HeroSignal` olarak bulunur. Sözlük parametreleri codegen uyumluluğu için `CodegenTypes.UnsafeObject` tipindedir;
 * tip güvenliği `src/HeroSignal.ts` katmanında sağlanır.
 */
export interface Spec extends TurboModule {
  // Başlatma ve gizlilik
  initialize(appId: string, options: CodegenTypes.UnsafeObject): void;
  setConsentRequired(required: boolean): void;
  setConsentGiven(given: boolean): void;
  login(externalId: string, identityHash: string | null): void;
  logout(): void;

  // Kullanıcı
  addTags(tags: CodegenTypes.UnsafeObject): void;
  removeTags(keys: Array<string>): void;
  getTags(): Promise<CodegenTypes.UnsafeObject>;
  addAliases(aliases: CodegenTypes.UnsafeObject): void;
  removeAlias(label: string): void;
  setLanguage(code: string): void;
  addEmail(email: string): Promise<void>;
  removeEmail(email: string): Promise<void>;
  addSms(phoneNumber: string): Promise<void>;
  removeSms(phoneNumber: string): Promise<void>;
  getExternalId(): Promise<string | null>;
  getUserId(): Promise<string | null>;

  // Push aboneliği
  getPushSubscriptionState(): Promise<CodegenTypes.UnsafeObject>;
  optIn(): void;
  optOut(): void;

  // Bildirimler
  requestPermission(): Promise<boolean>;
  getPermission(): Promise<boolean>;
  setForegroundHandlerEnabled(enabled: boolean): void;
  completeForegroundDisplay(eventId: string, display: boolean): void;
  displayNotification(eventId: string): void;
  clearAll(): void;
  removeNotification(id: string): void;
  removeGroupedNotifications(group: string): void;

  // Oturum / olay
  sendEvent(name: string, properties: CodegenTypes.UnsafeObject, value: number, hasValue: boolean): void;

  // In-app mesajlar
  addTriggers(triggers: CodegenTypes.UnsafeObject): void;
  removeTriggers(keys: Array<string>): void;
  clearTriggers(): void;
  getTriggers(): Promise<CodegenTypes.UnsafeObject>;
  setScreen(name: string | null): void;
  setInAppPaused(paused: boolean): void;
  getInAppPaused(): Promise<boolean>;

  // Bildirim kutusu
  inboxList(limit: number, cursor: string | null): Promise<CodegenTypes.UnsafeObject>;
  inboxMarkRead(id: string): Promise<CodegenTypes.UnsafeObject>;
  inboxMarkAllRead(): Promise<number>;
  inboxArchive(id: string): Promise<void>;
  inboxUnreadCount(): Promise<number>;

  // Hata ayıklama
  setLogLevel(level: string): void;

  // NativeEventEmitter sözleşmesi
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.get<Spec>('HeroSignal');
