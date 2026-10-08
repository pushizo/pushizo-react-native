import { NativeEventEmitter, Platform } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import NativeHeroSignal from './NativeHeroSignal';
import type { Spec } from './NativeHeroSignal';

/** Native modülün yaydığı olay adları (Android `HeroSignalModule`, iOS `HeroSignalRN` ile aynı). */
export const NativeEvents = {
  notificationClick: 'HeroSignal.notificationClick',
  notificationWillDisplay: 'HeroSignal.notificationWillDisplay',
  pushSubscriptionChange: 'HeroSignal.pushSubscriptionChange',
  inAppClick: 'HeroSignal.inAppClick',
  inAppLifecycle: 'HeroSignal.inAppLifecycle',
} as const;

export type NativeEventName = (typeof NativeEvents)[keyof typeof NativeEvents];

const LINKING_ERROR =
  "@herosignal/react-native native modülü bulunamadı. Kontrol edin:\n" +
  Platform.select({
    ios: "- iOS'ta `cd ios && pod install` çalıştırıldı\n",
    default: '',
  }) +
  '- Uygulama paket kurulumundan sonra yeniden derlendi (Metro yeniden başlatma yetmez)\n' +
  '- Expo kullanıyorsanız Expo Go yerine development build kullanılıyor (`npx expo prebuild` / `npx expo run:*`)\n';

/** Native modül; bağlanmamışsa açıklayıcı hata fırlatır. */
export function nativeModule(): Spec {
  if (!NativeHeroSignal) throw new Error(LINKING_ERROR);
  return NativeHeroSignal;
}

let emitter: NativeEventEmitter | null = null;

/** Native olaylarına abone olur (emitter tembel oluşturulur). */
export function addNativeListener(event: NativeEventName, handler: (payload: unknown) => void): EmitterSubscription {
  if (!emitter) {
    // iOS NativeEventEmitter native modül ister; Android'de addListener/removeListeners çağrıları da modüle gider.
    emitter = new NativeEventEmitter(nativeModule());
  }
  return emitter.addListener(event, handler);
}

/** Testler için emitter önbelleğini temizler. */
export function resetNativeEmitterForTests(): void {
  emitter = null;
}
