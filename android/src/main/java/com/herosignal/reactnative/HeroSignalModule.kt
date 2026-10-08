package com.herosignal.reactnative

import android.Manifest
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.herosignal.sdk.HeroSignal
import com.herosignal.sdk.HsApiException
import com.herosignal.sdk.HsCallback
import com.herosignal.sdk.HsClickEvent
import com.herosignal.sdk.HsForegroundEvent
import com.herosignal.sdk.HsInAppClickEvent
import com.herosignal.sdk.HsInAppLifecycleEvent
import com.herosignal.sdk.HsInAppLifecycleListener
import com.herosignal.sdk.HsInboxItem
import com.herosignal.sdk.HsInboxPage
import com.herosignal.sdk.HsLog
import com.herosignal.sdk.HsNotification
import com.herosignal.sdk.HsPushSubscriptionState
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * React Native → HeroSignal Android SDK köprüsü. Yeni mimaride codegen'in ürettiği `NativeHeroSignalSpec`
 * (TurboModule), eski mimaride `src/oldarch` altındaki aynı adlı el yazımı spec sınıfı üzerinden çalışır.
 * Olaylar `RCTDeviceEventEmitter` ile JS `NativeEventEmitter`'a iletilir (olay adları `src/native.ts` ile aynı).
 */
@ReactModule(name = HeroSignalModule.NAME)
class HeroSignalModule(reactContext: ReactApplicationContext) : NativeHeroSignalSpec(reactContext) {

    private val main = Handler(Looper.getMainLooper())

    /** `setConsentRequired` initialize'dan önce çağrılırsa seçenek olarak kullanılır. */
    @Volatile private var consentRequired = false
    @Volatile private var listenersRegistered = false
    /** JS'te ön plan dinleyicisi var mı (yoksa gösterim ertelenmez). */
    @Volatile private var foregroundHandlerEnabled = false
    /** JS tarafında tıklama dinleyicisi eklendi mi; eklenene kadar tıklamalar bekletilir (soğuk açılış). */
    @Volatile private var clickListenerReady = false
    private val pendingClicks = ArrayDeque<Map<String, Any?>>()
    private val foregroundEvents = ConcurrentHashMap<String, ForegroundEntry>()

    private class ForegroundEntry(val event: HsForegroundEvent) {
        @Volatile var answered = false
    }

    override fun getName(): String = NAME

    // --- Native SDK dinleyicileri ---

    private val clickListener: (HsClickEvent) -> Unit = { e ->
        val payload = mapOf("notification" to e.notification.toMap(), "actionId" to e.actionId, "url" to e.url)
        val deliverNow = synchronized(pendingClicks) {
            if (!clickListenerReady) {
                if (pendingClicks.size >= MAX_PENDING_CLICKS) pendingClicks.removeFirst()
                pendingClicks.addLast(payload)
            }
            clickListenerReady
        }
        if (deliverNow) emit(EVENT_CLICK, payload)
    }

    private val foregroundListener: (HsForegroundEvent) -> Unit = { e ->
        if (foregroundHandlerEnabled) {
            // Karar JS dinleyicilerine bırakılır: gösterim önce ertelenir, yanıt gelmezse süre sonunda gösterilir.
            e.preventDefault()
            val id = UUID.randomUUID().toString()
            val entry = ForegroundEntry(e)
            foregroundEvents[id] = entry
            emit(EVENT_WILL_DISPLAY, mapOf("eventId" to id, "notification" to e.notification.toMap()))
            main.postDelayed({
                if (!entry.answered && foregroundEvents.remove(id) != null) e.display()
            }, JS_RESPONSE_TIMEOUT_MS)
            main.postDelayed({ foregroundEvents.remove(id) }, FOREGROUND_HOLD_MS)
        }
    }

    private val subscriptionObserver: (HsPushSubscriptionState) -> Unit = { s -> emit(EVENT_SUBSCRIPTION, s.toMap()) }

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

    private fun registerListeners() {
        if (listenersRegistered) return
        listenersRegistered = true
        HeroSignal.Notifications.addClickListener(clickListener)
        HeroSignal.Notifications.addForegroundLifecycleListener(foregroundListener)
        HeroSignal.User.pushSubscription.addObserver(subscriptionObserver)
        // In-app dinleyicileri SDK başlatıldıktan sonra eklenebilir (denetleyici initialize'da oluşur).
        HeroSignal.InAppMessages.addClickListener(inAppClickListener)
        HeroSignal.InAppMessages.addLifecycleListener(inAppLifecycleListener)
    }

    /** JS yeniden yüklendiğinde (dev reload) eski modülün dinleyicileri SDK'dan çıkarılır. */
    override fun invalidate() {
        if (listenersRegistered) {
            HeroSignal.Notifications.removeClickListener(clickListener)
            HeroSignal.Notifications.removeForegroundLifecycleListener(foregroundListener)
            HeroSignal.User.pushSubscription.removeObserver(subscriptionObserver)
            HeroSignal.InAppMessages.removeClickListener(inAppClickListener)
            HeroSignal.InAppMessages.removeLifecycleListener(inAppLifecycleListener)
            listenersRegistered = false
        }
        // Bekleyen ön plan kararları JS olmadan verilemez: bildirimler gösterilir.
        foregroundEvents.values.forEach { if (!it.answered) it.event.display() }
        foregroundEvents.clear()
        main.removeCallbacksAndMessages(null)
        super.invalidate()
    }

    // --- Başlatma ve gizlilik ---

    override fun initialize(appId: String, options: ReadableMap) {
        val defaults = HeroSignal.Options()
        HeroSignal.initialize(
            reactApplicationContext,
            appId,
            HeroSignal.Options(
                apiUrl = options.optString("apiUrl") ?: defaults.apiUrl,
                requiresPrivacyConsent = options.optBoolean("requiresPrivacyConsent") ?: consentRequired,
                logLevel = logLevel(options.optString("logLevel")),
                defaultChannelName = options.optString("androidDefaultChannelName") ?: defaults.defaultChannelName,
                defaultChannelId = options.optString("androidDefaultChannelId") ?: defaults.defaultChannelId,
            ),
        )
        registerListeners()
    }

    override fun setConsentRequired(required: Boolean) {
        if (HeroSignal.isInitialized && required != consentRequired) {
            HsLog.w("setConsentRequired initialize'dan önce çağrılmalı; değişiklik bir sonraki başlatmada geçerli olur")
        }
        consentRequired = required
    }

    override fun setConsentGiven(given: Boolean) = HeroSignal.setConsentGiven(given)

    override fun login(externalId: String, identityHash: String?) {
        runCatching { HeroSignal.login(externalId, identityHash) }.onFailure { HsLog.e("login başarısız", it) }
    }

    override fun logout() = HeroSignal.logout()

    // --- Kullanıcı ---

    override fun addTags(tags: ReadableMap) = HeroSignal.User.addTags(tags.toStringMap())

    override fun removeTags(keys: ReadableArray) = HeroSignal.User.removeTags(keys.toStringList())

    override fun getTags(promise: Promise) = promise.resolve(HeroSignal.User.getTags().toWritableMap())

    override fun addAliases(aliases: ReadableMap) {
        runCatching { HeroSignal.User.addAliases(aliases.toStringMap()) }.onFailure { HsLog.e("alias eklenemedi", it) }
    }

    override fun removeAlias(label: String) {
        runCatching { HeroSignal.User.removeAlias(label) }.onFailure { HsLog.e("alias kaldırılamadı", it) }
    }

    override fun setLanguage(code: String) = HeroSignal.User.setLanguage(code)

    override fun addEmail(email: String, promise: Promise) = settle(promise) { HeroSignal.User.addEmail(email) }

    override fun removeEmail(email: String, promise: Promise) = settle(promise) { HeroSignal.User.removeEmail(email) }

    override fun addSms(phoneNumber: String, promise: Promise) = settle(promise) { HeroSignal.User.addSms(phoneNumber) }

    override fun removeSms(phoneNumber: String, promise: Promise) = settle(promise) { HeroSignal.User.removeSms(phoneNumber) }

    override fun getExternalId(promise: Promise) = promise.resolve(HeroSignal.User.externalId)

    override fun getUserId(promise: Promise) = promise.resolve(HeroSignal.User.id)

    // --- Push aboneliği ---

    override fun getPushSubscriptionState(promise: Promise) =
        promise.resolve(HeroSignal.User.pushSubscription.state.toMap().toWritableMap())

    override fun optIn() = HeroSignal.User.pushSubscription.optIn()

    override fun optOut() = HeroSignal.User.pushSubscription.optOut()

    // --- Bildirimler ---

    override fun requestPermission(promise: Promise) {
        if (HeroSignal.Notifications.permission || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            // Android 12 ve öncesinde çalışma zamanı izni yok; durum sistem ayarından okunur.
            HeroSignal.Notifications.onPermissionResult()
            promise.resolve(HeroSignal.Notifications.permission)
            return
        }
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "İzin istemek için ön planda bir Activity gerekli.")
            return
        }
        if (activity is PermissionAwareActivity) {
            val listener = PermissionListener { requestCode, _, _ ->
                if (requestCode != HeroSignal.Notifications.PERMISSION_REQUEST_CODE) return@PermissionListener false
                HeroSignal.Notifications.onPermissionResult()
                promise.resolve(HeroSignal.Notifications.permission)
                true
            }
            activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), HeroSignal.Notifications.PERMISSION_REQUEST_CODE, listener)
        } else {
            // ReactActivity dışı Activity: izin penceresi kapanınca uygulama yeniden ön plana gelir.
            reactApplicationContext.addLifecycleEventListener(object : LifecycleEventListener {
                override fun onHostResume() {
                    reactApplicationContext.removeLifecycleEventListener(this)
                    HeroSignal.Notifications.onPermissionResult()
                    promise.resolve(HeroSignal.Notifications.permission)
                }
                override fun onHostPause() = Unit
                override fun onHostDestroy() {
                    reactApplicationContext.removeLifecycleEventListener(this)
                    promise.resolve(HeroSignal.Notifications.permission)
                }
            })
            HeroSignal.Notifications.requestPermission(activity)
        }
    }

    override fun getPermission(promise: Promise) = promise.resolve(HeroSignal.Notifications.permission)

    override fun setForegroundHandlerEnabled(enabled: Boolean) {
        foregroundHandlerEnabled = enabled
    }

    override fun completeForegroundDisplay(eventId: String, display: Boolean) {
        val entry = foregroundEvents[eventId] ?: return
        entry.answered = true
        if (display) {
            foregroundEvents.remove(eventId)
            entry.event.display()
        }
    }

    override fun displayNotification(eventId: String) {
        foregroundEvents.remove(eventId)?.let {
            it.answered = true
            it.event.display()
        }
    }

    override fun clearAll() = HeroSignal.Notifications.clearAll()

    /** Sayısal kimlik doğrudan, diğerleri (teslimat/collapse kimliği) SDK ile aynı `hashCode()` kuralıyla eşlenir. */
    override fun removeNotification(id: String) =
        HeroSignal.Notifications.removeNotification(id.toIntOrNull() ?: id.hashCode())

    override fun removeGroupedNotifications(group: String) = HeroSignal.Notifications.removeGroupedNotifications(group)

    // --- Oturum ---

    override fun sendEvent(name: String, properties: ReadableMap, value: Double, hasValue: Boolean) {
        runCatching { HeroSignal.Session.sendEvent(name, properties.toHashMap(), if (hasValue) value else null) }
            .onFailure { HsLog.e("olay gönderilemedi", it) }
    }

    // --- In-app ---

    override fun addTriggers(triggers: ReadableMap) {
        runCatching { HeroSignal.InAppMessages.addTriggers(triggers.toStringMap()) }.onFailure { HsLog.e("trigger eklenemedi", it) }
    }

    override fun removeTriggers(keys: ReadableArray) = HeroSignal.InAppMessages.removeTriggers(keys.toStringList())

    override fun clearTriggers() = HeroSignal.InAppMessages.clearTriggers()

    override fun getTriggers(promise: Promise) = promise.resolve(HeroSignal.InAppMessages.getTriggers().toWritableMap())

    override fun setScreen(name: String?) = HeroSignal.InAppMessages.setScreen(name)

    override fun setInAppPaused(paused: Boolean) {
        HeroSignal.InAppMessages.paused = paused
    }

    override fun getInAppPaused(promise: Promise) = promise.resolve(HeroSignal.InAppMessages.paused)

    // --- Bildirim kutusu ---

    override fun inboxList(limit: Double, cursor: String?, promise: Promise) =
        guarded(promise) { HeroSignal.Inbox.list(limit.toInt(), cursor, reply(promise) { it.toMap().toWritableMap() }) }

    override fun inboxMarkRead(id: String, promise: Promise) =
        guarded(promise) { HeroSignal.Inbox.markRead(id, reply(promise) { it.toMap().toWritableMap() }) }

    override fun inboxMarkAllRead(promise: Promise) =
        guarded(promise) { HeroSignal.Inbox.markAllRead(reply(promise) { it }) }

    override fun inboxArchive(id: String, promise: Promise) =
        guarded(promise) { HeroSignal.Inbox.archive(id, reply(promise) { null }) }

    override fun inboxUnreadCount(promise: Promise) =
        guarded(promise) { HeroSignal.Inbox.unreadCount(reply(promise) { it }) }

    // --- Hata ayıklama ---

    override fun setLogLevel(level: String) = HeroSignal.Debug.setLogLevel(logLevel(level))

    // --- NativeEventEmitter ---

    override fun addListener(eventName: String) {
        if (eventName != EVENT_CLICK) return
        val pending = synchronized(pendingClicks) {
            clickListenerReady = true
            pendingClicks.toList().also { pendingClicks.clear() }
        }
        pending.forEach { emit(EVENT_CLICK, it) }
    }

    override fun removeListeners(count: Double) = Unit

    // --- Yardımcılar ---

    private fun emit(event: String, payload: Map<String, Any?>) {
        val context = reactApplicationContext
        if (!context.hasActiveReactInstance()) return
        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(event, payload.toWritableMap())
    }

    /** Senkron SDK çağrısını Promise'e bağlar; geçersiz argüman `INVALID_ARGUMENT` olur. */
    private fun settle(promise: Promise, block: () -> Unit) {
        try {
            block()
            promise.resolve(null)
        } catch (e: IllegalArgumentException) {
            promise.reject("INVALID_ARGUMENT", e.message, e)
        } catch (e: Exception) {
            promise.reject("HS_ERROR", e.message, e)
        }
    }

    private fun guarded(promise: Promise, block: () -> Unit) {
        try {
            block()
        } catch (e: Exception) {
            promise.reject(errorCode(e), e.message, e)
        }
    }

    /** SDK geri çağrısını (arka plan iş parçacığı) Promise'e çevirir. */
    private fun <T> reply(promise: Promise, map: (T) -> Any?) = HsCallback<T> { result ->
        result.fold(
            onSuccess = { promise.resolve(map(it)) },
            onFailure = { e -> promise.reject(errorCode(e), e.message, e) },
        )
    }

    private fun errorCode(e: Throwable): String = when (e) {
        is HsApiException -> e.code
        is IllegalStateException -> "NOT_READY"
        is IllegalArgumentException -> "INVALID_ARGUMENT"
        else -> "HS_ERROR"
    }

    private fun logLevel(name: String?): HsLog.Level = when (name) {
        "none" -> HsLog.Level.NONE
        "error" -> HsLog.Level.ERROR
        "info" -> HsLog.Level.INFO
        "debug" -> HsLog.Level.DEBUG
        else -> HsLog.Level.WARN
    }

    companion object {
        const val NAME = "HeroSignal"

        const val EVENT_CLICK = "HeroSignal.notificationClick"
        const val EVENT_WILL_DISPLAY = "HeroSignal.notificationWillDisplay"
        const val EVENT_SUBSCRIPTION = "HeroSignal.pushSubscriptionChange"
        const val EVENT_IN_APP_CLICK = "HeroSignal.inAppClick"
        const val EVENT_IN_APP_LIFECYCLE = "HeroSignal.inAppLifecycle"

        /** JS ön plan dinleyicisi bu sürede yanıt vermezse bildirim gösterilir. */
        private const val JS_RESPONSE_TIMEOUT_MS = 5_000L
        /** `preventDefault()` sonrası `display()` için bekleme süresi (iOS SDK ile aynı). */
        private const val FOREGROUND_HOLD_MS = 25_000L
        private const val MAX_PENDING_CLICKS = 10

        private fun ReadableMap.optString(key: String): String? =
            if (hasKey(key) && getType(key) == ReadableType.String) getString(key)?.takeIf { it.isNotBlank() } else null

        private fun ReadableMap.optBoolean(key: String): Boolean? =
            if (hasKey(key) && getType(key) == ReadableType.Boolean) getBoolean(key) else null

        /** JS katmanı değerleri metne çevirir; yine de sayı/boolean gelirse metne çevrilir. */
        private fun ReadableMap.toStringMap(): Map<String, String> =
            toHashMap().mapNotNull { (key, value) ->
                when (value) {
                    is String -> key to value
                    is Number, is Boolean -> key to value.toString()
                    else -> null
                }
            }.toMap()

        private fun ReadableArray.toStringList(): List<String> =
            (0 until size()).mapNotNull { if (getType(it) == ReadableType.String) getString(it) else null }

        private fun HsNotification.toMap(): Map<String, Any?> = mapOf(
            "title" to title,
            "body" to body,
            "url" to url,
            "imageUrl" to imageUrl,
            "deliveryId" to deliveryId,
            "messageId" to messageId,
            "groupKey" to groupKey,
            "androidNotificationId" to androidNotificationId,
            "actions" to actions.map { mapOf("id" to it.id, "title" to it.title, "url" to it.url) },
            "data" to data,
        )

        private fun HsPushSubscriptionState.toMap(): Map<String, Any?> =
            mapOf("id" to id, "token" to token, "optedIn" to optedIn, "permission" to permission)

        private fun HsInboxItem.toMap(): Map<String, Any?> = mapOf(
            "id" to id, "messageId" to messageId, "title" to title, "body" to body, "url" to url, "imageUrl" to imageUrl,
            "data" to data, "read" to read, "readAt" to readAt, "archivedAt" to archivedAt, "expiresAt" to expiresAt,
            "createdAt" to createdAt,
        )

        private fun HsInboxPage.toMap(): Map<String, Any?> =
            mapOf("items" to items.map { it.toMap() }, "unreadCount" to unreadCount, "nextCursor" to nextCursor, "hasMore" to hasMore)

        /** Kotlin değerlerini RN köprü tiplerine çevirir (Long → Double: JS sayıları 2^53'e kadar tam). */
        internal fun Map<String, Any?>.toWritableMap(): WritableMap {
            val map = Arguments.createMap()
            for ((key, value) in this) putValue(map, key, value)
            return map
        }

        private fun putValue(map: WritableMap, key: String, value: Any?) {
            when (value) {
                null -> map.putNull(key)
                is String -> map.putString(key, value)
                is Boolean -> map.putBoolean(key, value)
                is Int -> map.putInt(key, value)
                is Number -> map.putDouble(key, value.toDouble())
                is Map<*, *> -> map.putMap(key, value.entries.associate { (k, v) -> k.toString() to v }.toWritableMap())
                is Iterable<*> -> map.putArray(key, value.toWritableArray())
                else -> map.putString(key, value.toString())
            }
        }

        private fun Iterable<*>.toWritableArray(): WritableArray {
            val array = Arguments.createArray()
            for (value in this) {
                when (value) {
                    null -> array.pushNull()
                    is String -> array.pushString(value)
                    is Boolean -> array.pushBoolean(value)
                    is Int -> array.pushInt(value)
                    is Number -> array.pushDouble(value.toDouble())
                    is Map<*, *> -> array.pushMap(value.entries.associate { (k, v) -> k.toString() to v }.toWritableMap())
                    is Iterable<*> -> array.pushArray(value.toWritableArray())
                    else -> array.pushString(value.toString())
                }
            }
            return array
        }
    }
}
