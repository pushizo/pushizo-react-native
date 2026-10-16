import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import NativePushizo, { type Spec } from './NativePushizo';

const LINKING_ERROR =
  `@pushizo/react-native yerel modülü bulunamadı. Kontrol edin:\n` +
  Platform.select({ ios: "- iOS: 'cd ios && pod install' çalıştırıldı mı\n", default: '' }) +
  '- Uygulama paket kurulduktan sonra yeniden derlendi mi (Metro yeniden yükleme yetmez)\n' +
  '- Expo Go kullanılmıyor mu (yerel modül için development build gerekir)\n';

/**
 * Yeni mimaride TurboModule, eski mimaride `NativeModules.Pushizo` kullanılır. İkisi de yoksa ilk çağrıda açıklayıcı
 * bir hata fırlatılır (içe aktarma sırasında değil; test ve SSR ortamları paketi yükleyebilsin diye).
 */
function resolveModule(): Spec {
  const module = (NativePushizo ?? (NativeModules.Pushizo as Spec | undefined)) ?? null;
  if (module) return module;
  return new Proxy({} as Spec, {
    get() {
      throw new Error(LINKING_ERROR);
    },
  });
}

let cached: Spec | null = null;
let emitter: NativeEventEmitter | null = null;

/** Yerel modül (tembel çözülür). */
export function nativeModule(): Spec {
  if (!cached) cached = resolveModule();
  return cached;
}

/**
 * Olay yayıcısı: modül her iki platformda da verilir; böylece yerel taraf `addListener` ile hangi olayın dinlendiğini
 * bilir (ör. soğuk açılış tıklaması, dinleyici eklenene kadar yerelde bekletilir).
 */
export function nativeEmitter(): NativeEventEmitter {
  if (!emitter) emitter = new NativeEventEmitter(nativeModule());
  return emitter;
}

