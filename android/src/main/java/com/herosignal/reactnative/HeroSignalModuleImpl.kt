package com.herosignal.reactnative

import android.Manifest
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.herosignal.sdk.HeroSignal
import com.herosignal.sdk.HsApiException
import com.herosignal.sdk.HsCallback

/**
 * Yeni (TurboModule) ve eski mimari modüllerinin ortak gövdesi: JS çağrılarını Android SDK'ya (`com.herosignal.sdk`)
 * iletir. Doğrulama hataları `INVALID_ARGUMENT`, başlatılmamış SDK `NOT_READY`, API hataları sunucu hata koduyla reddedilir.
 */
class HeroSignalModuleImpl(private val context: ReactApplicationContext) {
    private val sink = HeroSignalBridge.Sink { event, payload ->
        if (context.hasActiveReactInstance()) context.emitDeviceEvent(event, Arguments.makeNativeMap(payload))
    }

    init {
        HeroSignalBridge.attach(sink)
    }

    fun invalidate() {
        HeroSignalBridge.detach(sink)
    }

    // --- Başlatma ve gizlilik ---

    /** Yerel SDK ProcessLifecycleOwner'a gözlemci eklediği için başlatma ana iş parçacığında yapılır. */
    fun initialize(appId: String, options: ReadableMap, promise: Promise) {
        if (appId.isBlank()) {
            promise.reject("INVALID_ARGUMENT", "appId gerekli")
            return
        }
        val resolved = options.toOptions()
        UiThreadUtil.runOnUiThread {
            guard(promise) {
                HeroSignalBridge.initialize(context, appId, resolved)
                promise.resolve(null)
            }
        }
    }

    fun setConsentGiven(given: Boolean) = HeroSignal.setConsentGiven(given)

    fun login(externalId: String, identityHash: String?, jwt: String?, promise: Promise) = guard(promise) {
        HeroSignal.login(externalId, identityHash, jwt)
        promise.resolve(null)
    }

    fun updateUserJwt(jwt: String, promise: Promise) = guard(promise) {
        HeroSignal.updateUserJwt(jwt)
        promise.resolve(null)
    }

    fun logout() = HeroSignal.logout()

    // --- Kullanıcı ---

    fun addTags(tags: ReadableMap, promise: Promise) = guard(promise) {
        HeroSignal.User.addTags(tags.toStringMap())
        promise.resolve(null)
    }

    fun removeTags(keys: ReadableArray, promise: Promise) = guard(promise) {
        HeroSignal.User.removeTags(keys.toStringList())
        promise.resolve(null)
    }

    fun getTags(promise: Promise) = guard(promise) { promise.resolve(Arguments.makeNativeMap(HeroSignal.User.getTags())) }

    fun addAliases(aliases: ReadableMap, promise: Promise) = guard(promise) {
        HeroSignal.User.addAliases(aliases.toStringMap())
        promise.resolve(null)
    }

    fun removeAlias(label: String, promise: Promise) = guard(promise) {
        HeroSignal.User.removeAlias(label)
        promise.resolve(null)
    }

    fun setLanguage(code: String, promise: Promise) = guard(promise) {
        HeroSignal.User.setLanguage(code)
        promise.resolve(null)
    }

    fun addEmail(email: String, promise: Promise) = guard(promise) {
        HeroSignal.User.addEmail(email)
        promise.resolve(null)
    }

    fun removeEmail(email: String, promise: Promise) = guard(promise) {
        HeroSignal.User.removeEmail(email)
        promise.resolve(null)
    }

    fun addSms(phoneNumber: String, promise: Promise) = guard(promise) {
        HeroSignal.User.addSms(phoneNumber)
        promise.resolve(null)
    }

    fun removeSms(phoneNumber: String, promise: Promise) = guard(promise) {
        HeroSignal.User.removeSms(phoneNumber)
        promise.resolve(null)
    }

    /** Bu cihazda kaydedilmiş e-posta adresleri (yerel kayıt). */
    fun getEmails(promise: Promise) = guard(promise) { promise.resolve(Arguments.makeNativeArray(HeroSignal.User.emails)) }

    /** Bu cihazda kaydedilmiş SMS numaraları (E.164, yerel kayıt). */
    fun getSmsNumbers(promise: Promise) = guard(promise) { promise.resolve(Arguments.makeNativeArray(HeroSignal.User.smsNumbers)) }

    fun getExternalId(promise: Promise) = promise.resolve(HeroSignal.User.externalId)

    fun getUserId(promise: Promise) = promise.resolve(HeroSignal.User.id)

    // --- Tercihler (ADR-0019 §4; abonelik yoksa NOT_READY, geçersiz girdi INVALID_ARGUMENT) ---

    fun getPreferences(promise: Promise) =
        HeroSignal.User.getPreferences(reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    fun setPreferences(preferences: ReadableArray, promise: Promise) =
        HeroSignal.User.setPreferences(preferences.toPreferenceInputs(), reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    // --- Push aboneliği ---

    fun getPushSubscriptionState(promise: Promise) =
        promise.resolve(Arguments.makeNativeMap(HeroSignal.User.pushSubscription.state.toMap()))

    fun optIn() = HeroSignal.User.pushSubscription.optIn()

    fun optOut() = HeroSignal.User.pushSubscription.optOut()

    // --- Bildirimler ---

    fun getPermission(promise: Promise) = promise.resolve(HeroSignal.Notifications.permission)

    /**
     * Android 13+ POST_NOTIFICATIONS izni React Native'in [PermissionAwareActivity] akışıyla istenir (sonuç
     * `ReactActivity` üzerinden bu dinleyiciye gelir), ardından SDK'ya [HeroSignal.Notifications.onPermissionResult]
     * bildirilir. Önceki sürümlerde izin çalışma zamanında istenemez; mevcut durum döner.
     */
    fun requestPermission(promise: Promise) {
        if (HeroSignal.Notifications.permission || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            promise.resolve(HeroSignal.Notifications.permission)
            return
        }
        val activity = context.currentActivity as? PermissionAwareActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "İzin istemek için ön planda bir ReactActivity gerekli.")
            return
        }
        val listener = PermissionListener { requestCode, _, _ ->
            if (requestCode != HeroSignal.Notifications.PERMISSION_REQUEST_CODE) return@PermissionListener false
            // İzin değiştiyse yerel SDK izin gözlemcisi `permissionChange` olayını gönderir.
            HeroSignal.Notifications.onPermissionResult()
            promise.resolve(HeroSignal.Notifications.permission)
            true
        }
        UiThreadUtil.runOnUiThread {
            activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), HeroSignal.Notifications.PERMISSION_REQUEST_CODE, listener)
        }
    }

    fun clearAll() = HeroSignal.Notifications.clearAll()

    /** Tek bildirimi `androidNotificationId` ile kaldırır; JS kimliği metin olarak iletir, Android'de tamsayı olmalıdır. */
    fun removeNotification(id: String, promise: Promise) = guard(promise) {
        val androidNotificationId = requireNotNull(id.trim().toIntOrNull()) { "Android bildirim kimliği tamsayı olmalı: $id" }
        HeroSignal.Notifications.removeNotification(androidNotificationId)
        promise.resolve(null)
    }

    /** Aynı grup anahtarına (`android_group`) sahip bildirimleri ve grup özetini kaldırır. */
    fun removeGroupedNotifications(group: String, promise: Promise) = guard(promise) {
        HeroSignal.Notifications.removeGroupedNotifications(group)
        promise.resolve(null)
    }

    fun setForegroundHandlerEnabled(enabled: Boolean) {
        HeroSignalBridge.foregroundHandlerEnabled = enabled
    }

    fun displayNotification(notificationId: String) = HeroSignalBridge.displayNotification(notificationId)

    fun preventDefault(notificationId: String) = HeroSignalBridge.preventDefault(notificationId)

    // --- Oturum ---

    fun sendEvent(name: String, properties: ReadableMap, value: Double?) =
        HeroSignal.Session.sendEvent(name, properties.toHashMap(), value)

    // --- In-app ---

    fun addTriggers(triggers: ReadableMap, promise: Promise) = guard(promise) {
        HeroSignal.InAppMessages.addTriggers(triggers.toStringMap())
        promise.resolve(null)
    }

    fun removeTriggers(keys: ReadableArray) = HeroSignal.InAppMessages.removeTriggers(keys.toStringList())

    fun clearTriggers() = HeroSignal.InAppMessages.clearTriggers()

    fun getTriggers(promise: Promise) = promise.resolve(Arguments.makeNativeMap(HeroSignal.InAppMessages.getTriggers()))

    fun setScreen(name: String?) = HeroSignal.InAppMessages.setScreen(name)

    fun setInAppPaused(paused: Boolean) {
        HeroSignal.InAppMessages.paused = paused
    }

    fun getInAppPaused(promise: Promise) = promise.resolve(HeroSignal.InAppMessages.paused)

    // --- Bildirim kutusu (SDK geri çağrıları arka plan iş parçacığındadır; Promise iş parçacığından bağımsızdır) ---

    fun inboxList(limit: Double, cursor: String?, promise: Promise) =
        HeroSignal.Inbox.list(limit.toInt(), cursor, reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    fun inboxMarkRead(id: String, promise: Promise) =
        HeroSignal.Inbox.markRead(id, reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    fun inboxMarkAllRead(promise: Promise) = HeroSignal.Inbox.markAllRead(reply(promise) { it })

    fun inboxArchive(id: String, promise: Promise) = HeroSignal.Inbox.archive(id, reply(promise) { null })

    fun inboxUnreadCount(promise: Promise) = HeroSignal.Inbox.unreadCount(reply(promise) { it })

    // --- Live Activities: iOS (ActivityKit) özelliğidir; Android'de sessizce yok sayılmaz, açık hatayla reddedilir ---

    fun setupDefaultLiveActivity(promise: Promise) = rejectLiveActivities(promise)

    @Suppress("UNUSED_PARAMETER")
    fun startDefaultLiveActivity(activityId: String, attributes: ReadableMap, contentState: ReadableMap, promise: Promise) =
        rejectLiveActivities(promise)

    private fun rejectLiveActivities(promise: Promise) = promise.reject(PLATFORM_NOT_SUPPORTED, LIVE_ACTIVITIES_IOS_ONLY)

    // --- Hata ayıklama ---

    fun setLogLevel(level: String) = HeroSignal.Debug.setLogLevel(logLevel(level))

    // --- NativeEventEmitter ---

    fun addListener(eventName: String) = HeroSignalBridge.onJsListenerAdded(eventName)

    // --- Yardımcılar ---

    private inline fun guard(promise: Promise, block: () -> Unit) {
        try {
            block()
        } catch (e: Exception) {
            reject(promise, e)
        }
    }

    private fun <T> reply(promise: Promise, map: (T) -> Any?) = HsCallback<T> { result ->
        result.fold(onSuccess = { promise.resolve(map(it)) }, onFailure = { reject(promise, it) })
    }

    private fun reject(promise: Promise, error: Throwable) {
        val code = when (error) {
            is HsApiException -> error.code
            is IllegalArgumentException -> "INVALID_ARGUMENT"
            is IllegalStateException -> "NOT_READY"
            else -> "HS_ERROR"
        }
        promise.reject(code, error.message ?: code, error)
    }

    companion object {
        const val NAME = "HeroSignal"
        const val PLATFORM_NOT_SUPPORTED = "PLATFORM_NOT_SUPPORTED"
        const val LIVE_ACTIVITIES_IOS_ONLY = "Live Activities yalnızca iOS'ta desteklenir"
    }
}
