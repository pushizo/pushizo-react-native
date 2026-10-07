package com.herosignal.reactnative

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.herosignal.sdk.HeroSignal
import com.herosignal.sdk.HsClickEvent
import com.herosignal.sdk.HsForegroundEvent
import com.herosignal.sdk.HsInAppClickEvent
import com.herosignal.sdk.HsInAppLifecycleEvent
import com.herosignal.sdk.HsInAppLifecycleListener
import com.herosignal.sdk.HsLog
import com.herosignal.sdk.HsPushSubscriptionState
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Yerel SDK dinleyicilerini süreç başına bir kez kuran ve olayları JS'e ileten köprü merkezi.
 *
 * React bağlamı (ve modül örneği) yeniden yüklemelerde değişebilir; dinleyiciler burada bir kez kaydedilir, olaylar o an
 * bağlı olan [Sink]'e gönderilir. Bildirim tıklamaları JS'te `click` dinleyicisi eklenene kadar bekletilir (soğuk açılış).
 */
object HeroSignalBridge {
    const val EVENT_CLICK = "HeroSignal-notificationClick"
    const val EVENT_FOREGROUND = "HeroSignal-notificationWillDisplay"
    const val EVENT_PERMISSION = "HeroSignal-permissionChange"
    const val EVENT_SUBSCRIPTION = "HeroSignal-pushSubscriptionChange"
    const val EVENT_IN_APP_CLICK = "HeroSignal-inAppClick"
    const val EVENT_IN_APP_LIFECYCLE = "HeroSignal-inAppLifecycle"

    /** iOS ile aynı: ertelenmiş ön plan kararı için bekleme süresi. */
    private const val FOREGROUND_TIMEOUT_MS = 25_000L
    private const val MAX_PENDING_CLICKS = 10

    /** JS'e olay gönderen hedef (React bağlamı). */
    fun interface Sink {
        fun emit(event: String, payload: Map<String, Any?>)
    }

    private val main = Handler(Looper.getMainLooper())
    private val lock = Any()
    @Volatile private var sink: Sink? = null
    @Volatile private var listenersRegistered = false
    @Volatile var foregroundHandlerEnabled = false

    /** JS'te en az bir kez dinleyici eklenmiş olaylar (bağlı Sink için). */
    private val jsEvents = ConcurrentHashMap.newKeySet<String>()
    private val pendingClicks = ArrayList<Map<String, Any?>>()
    private val foregroundEvents = ConcurrentHashMap<String, HsForegroundEvent>()
    private var lastState: Map<String, Any?>? = null

    // --- Başlatma ---

    /**
     * Yerel SDK'yı başlatır (aynı appId ile tekrar çağrı yerel SDK'da yok sayılır) ve köprü dinleyicilerini kaydeder.
     * Hem JS `initialize` hem de manifest tabanlı erken başlatma ([HeroSignalInitProvider]) bu yolu kullanır.
     */
    fun initialize(context: Context, appId: String, options: HeroSignal.Options) {
        HeroSignal.initialize(context.applicationContext, appId, options)
        registerListeners()
    }

    private fun registerListeners() {
        synchronized(lock) {
            if (listenersRegistered) return
            listenersRegistered = true
        }
        HeroSignal.Notifications.addClickListener(clickListener)
        HeroSignal.Notifications.addForegroundLifecycleListener(foregroundListener)
        HeroSignal.User.pushSubscription.addObserver(subscriptionObserver)
        HeroSignal.Notifications.addPermissionObserver(permissionObserver)
        HeroSignal.InAppMessages.addClickListener(inAppClickListener)
        HeroSignal.InAppMessages.addLifecycleListener(inAppLifecycleListener)
        val state = HeroSignal.User.pushSubscription.state
        synchronized(lock) { lastState = state.toMap() }
    }

    // --- Sink yönetimi ---

    fun attach(target: Sink) {
        sink = target
        jsEvents.clear()
    }

    fun detach(target: Sink) {
        if (sink !== target) return
        sink = null
        jsEvents.clear()
        foregroundHandlerEnabled = false
        // Bekleyen ön plan kararları JS olmadan verilemez: varsayılan davranış (göster) uygulanır.
        foregroundEvents.values.forEach { it.display() }
        foregroundEvents.clear()
    }

    /** NativeEventEmitter `addListener`: tıklama dinleyicisi geldiğinde bekleyen tıklamalar gönderilir. */
    fun onJsListenerAdded(event: String) {
        jsEvents.add(event)
        if (event != EVENT_CLICK) return
        val pending = synchronized(lock) { pendingClicks.toList().also { pendingClicks.clear() } }
        pending.forEach { emit(EVENT_CLICK, it) }
    }

    private fun emit(event: String, payload: Map<String, Any?>) {
        sink?.emit(event, payload)
    }

    // --- Yerel dinleyiciler ---

    private val clickListener: (HsClickEvent) -> Unit = { e ->
        val payload = mapOf("notification" to e.notification.toMap(), "actionId" to e.actionId, "url" to e.url)
        val deliverNow = sink != null && jsEvents.contains(EVENT_CLICK)
        if (deliverNow) {
            emit(EVENT_CLICK, payload)
        } else {
            synchronized(lock) {
                if (pendingClicks.size >= MAX_PENDING_CLICKS) pendingClicks.removeAt(0)
                pendingClicks.add(payload)
            }
        }
    }

    /**
     * JS'te `foregroundWillDisplay` dinleyicisi varsa gösterim ertelenir ve karar JS'e bırakılır; JS
     * `displayNotification` / `preventDefault` ile yanıtlar. Yanıt 25 sn içinde gelmezse bildirim gösterilmez (iOS ile aynı).
     */
    private val foregroundListener: (HsForegroundEvent) -> Unit = listener@{ e ->
        if (!foregroundHandlerEnabled || sink == null) return@listener
        e.preventDefault()
        val id = UUID.randomUUID().toString()
        foregroundEvents[id] = e
        emit(EVENT_FOREGROUND, mapOf("notificationId" to id, "notification" to e.notification.toMap()))
        main.postDelayed({ foregroundEvents.remove(id) }, FOREGROUND_TIMEOUT_MS)
    }

    fun displayNotification(id: String) {
        foregroundEvents.remove(id)?.display()
    }

    fun preventDefault(id: String) {
        // Olay 25 sn boyunca tutulur; bu süre içinde `displayNotification` ile yine gösterilebilir.
        if (!foregroundEvents.containsKey(id)) HsLog.d("ön plan olayı bulunamadı veya süresi doldu: $id")
    }

    private val subscriptionObserver: (HsPushSubscriptionState) -> Unit = { s -> onSubscriptionState(s) }

    private fun onSubscriptionState(s: HsPushSubscriptionState) {
        val current = s.toMap()
        val previous: Map<String, Any?>?
        synchronized(lock) {
            previous = lastState
            lastState = current
        }
        if (previous != current) emit(EVENT_SUBSCRIPTION, mapOf("previous" to (previous ?: current), "current" to current))
    }

    /**
     * Yerel SDK izin gözlemcisi: `requestPermission` sonucu ve uygulama ön plana döndüğünde (izin ayarlardan
     * değişmiş olabilir) etkin izin değiştiyse çağrılır.
     */
    private val permissionObserver: (Boolean) -> Unit = { granted -> emit(EVENT_PERMISSION, mapOf("permission" to granted)) }

    private val inAppClickListener: (HsInAppClickEvent) -> Unit = { e ->
        emit(EVENT_IN_APP_CLICK, mapOf("messageId" to e.messageId, "actionId" to e.actionId, "url" to e.url))
    }

    private val inAppLifecycleListener = object : HsInAppLifecycleListener {
        private fun send(event: String, e: HsInAppLifecycleEvent) =
            emit(EVENT_IN_APP_LIFECYCLE, mapOf("event" to event, "messageId" to e.message.id))

        override fun onWillDisplay(event: HsInAppLifecycleEvent) = send("willDisplay", event)
        override fun onDidDisplay(event: HsInAppLifecycleEvent) = send("didDisplay", event)
        override fun onWillDismiss(event: HsInAppLifecycleEvent) = send("willDismiss", event)
        override fun onDidDismiss(event: HsInAppLifecycleEvent) = send("didDismiss", event)
    }
}
