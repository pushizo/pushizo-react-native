import type { EmitterSubscription } from 'react-native';
import { nativeEmitter } from './native';

type Listener<T> = (event: T) => void;

/**
 * Tek bir yerel olay için JS dinleyici kümesi. Yerel aboneliği ilk dinleyicide açar, son dinleyici çıkınca kapatır;
 * böylece yerel taraf yalnızca dinlenen olayları gönderir. Bir dinleyicinin hatası diğerlerini etkilemez.
 */
export class EventHub<TNative, TPublic = TNative> {
  private readonly listeners = new Set<Listener<TPublic>>();
  private subscription: EmitterSubscription | null = null;
  /** SDK'nın kendi iç kullanımı için açık tutma sayacı (ör. izin önbelleği, in-app yaşam döngüsü alt olayları). */
  private retained = 0;

  constructor(
    private readonly eventName: string,
    private readonly transform: (payload: TNative) => TPublic,
    private readonly hooks: { onFirst?: () => void; onLast?: () => void; onEvent?: (event: TPublic) => void } = {},
  ) {}

  private get active(): boolean {
    return this.listeners.size + this.retained > 0;
  }

  add(listener: Listener<TPublic>): void {
    if (typeof listener !== 'function') throw new TypeError('Pushizo: dinleyici bir fonksiyon olmalı.');
    if (this.listeners.has(listener)) return;
    const wasActive = this.active;
    this.listeners.add(listener);
    if (!wasActive) this.open();
  }

  remove(listener: Listener<TPublic>): void {
    if (!this.listeners.delete(listener)) return;
    if (!this.active) this.close();
  }

  /** Dinleyici olmadan yerel aboneliği açık tutar (`release` ile bırakılır). */
  retain(): void {
    const wasActive = this.active;
    this.retained += 1;
    if (!wasActive) this.open();
  }

  release(): void {
    if (this.retained === 0) return;
    this.retained -= 1;
    if (!this.active) this.close();
  }

  private open(): void {
    this.hooks.onFirst?.();
    this.subscription = nativeEmitter().addListener(this.eventName, (payload: unknown) => {
      this.dispatch(payload as TNative);
    });
  }

  private close(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.hooks.onLast?.();
  }

  /** Yerelden gelen olayı dönüştürüp tüm dinleyicilere iletir; dönüştürülmüş olayı döndürür. */
  dispatch(payload: TNative): TPublic {
    const event = this.transform(payload);
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(event);
      } catch (error) {
        // Uygulama dinleyicisinin hatası SDK akışını (ör. ön plan gösterim kararı) bozmamalı.
        console.error(`[Pushizo] '${this.eventName}' dinleyicisi hata verdi`, error);
      }
    }
    this.hooks.onEvent?.(event);
    return event;
  }
}
