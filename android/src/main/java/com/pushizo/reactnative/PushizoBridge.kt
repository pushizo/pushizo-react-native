package com.pushizo.reactnative

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.pushizo.sdk.Pushizo
import com.pushizo.sdk.HsChatEventAdapter
import com.pushizo.sdk.HsChatOpenListener
import com.pushizo.sdk.HsClickEvent
import com.pushizo.sdk.HsForegroundEvent
import com.pushizo.sdk.HsInAppClickEvent
import com.pushizo.sdk.HsInAppLifecycleEvent
import com.pushizo.sdk.HsInAppLifecycleListener
import com.pushizo.sdk.HsLog
import com.pushizo.sdk.HsPushSubscriptionState
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Yerel SDK dinleyicilerini süreç başına bir kez kuran ve olayları JS'e ileten köprü merkezi.
 *
 * React bağlamı (ve modül örneği) yeniden yüklemelerde değişebilir; dinleyiciler burada bir kez kaydedilir, olaylar o an
 * bağlı olan [Sink]'e gönderilir. Bildirim tıklamaları JS'te `click` dinleyicisi eklenene kadar bekletilir (soğuk açılış).
 */
object PushizoBridge {
    const val EVENT_CLICK = "Pushizo-notificationClick"
    const val EVENT_FOREGROUND = "Pushizo-notificationWillDisplay"
    const val EVENT_PERMISSION = "Pushizo-permissionChange"
    const val EVENT_SUBSCRIPTION = "Pushizo-pushSubscriptionChange"
    const val EVENT_IN_APP_CLICK = "Pushizo-inAppClick"
    const val EVENT_IN_APP_LIFECYCLE = "Pushizo-inAppLifecycle"
    const val EVENT_CHAT = "Pushizo-chatEvent"
    const val EVENT_CHAT_OPEN = "Pushizo-chatOpen"

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
    /** JS `Chat.addEventListener('open')` eklenene kadar bekletilen sohbet bildirimi tıklamaları. */
    private val pendingChatOpens = ArrayList<Map<String, Any?>>()
    private val foregroundEvents = ConcurrentHashMap<String, HsForegroundEvent>()
    private var lastState: Map<String, Any?>? = null

    // --- Başlatma ---

    /**
     * Yerel SDK'yı başlatır (aynı appId ile tekrar çağrı yerel SDK'da yok sayılır) ve köprü dinleyicilerini kaydeder.
     * Hem JS `initialize` hem de manifest tabanlı erken başlatma ([PushizoInitProvider]) bu yolu kullanır.
     */
    fun initialize(context: Context, appId: String, options: Pushizo.Options) {
        Pushizo.initialize(context.applicationContext, appId, options)
        registerListeners()
    }

    private fun registerListeners() {
        synchronized(lock) {
            if (listenersRegistered) return
            listenersRegistered = true
        }
        Pushizo.Notifications.addClickListener(clickListener)
        Pushizo.Notifications.addForegroundLifecycleListener(foregroundListener)
        Pushizo.User.pushSubscription.addObserver(subscriptionObserver)
        Pushizo.Notifications.addPermissionObserver(permissionObserver)
        Pushizo.InAppMessages.addClickListener(inAppClickListener)
        Pushizo.InAppMessages.addLifecycleListener(inAppLifecycleListener)
        Pushizo.Chat.addListener(chatListener)
        Pushizo.Chat.addOpenListener(chatOpenListener)
        val state = Pushizo.User.pushSubscription.state
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
        val buffer = when (event) {
            EVENT_CLICK -> pendingClicks
            EVENT_CHAT_OPEN -> pendingChatOpens
            else -> return
        }
        val pending = synchronized(lock) { buffer.toList().also { buffer.clear() } }
        pending.forEach { emit(event, it) }
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

    /** Canlı sohbet olayları: `{ type: message|typing|read|unread|conversation|connection|error, ... }`. */
    private val chatListener = HsChatEventAdapter { type, payload -> emit(EVENT_CHAT, mapOf("type" to type) + payload) }

    /** Sohbet bildirimine tıklama; JS dinleyicisi yoksa (soğuk açılış) bekletilir. */
    private val chatOpenListener = HsChatOpenListener { info ->
        val payload = info.toMap()
        if (sink != null && jsEvents.contains(EVENT_CHAT_OPEN)) {
            emit(EVENT_CHAT_OPEN, payload)
        } else {
            synchronized(lock) {
                if (pendingChatOpens.size >= MAX_PENDING_CLICKS) pendingChatOpens.removeAt(0)
                pendingChatOpens.add(payload)
            }
        }
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
