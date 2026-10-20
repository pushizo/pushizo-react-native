package com.pushizo.reactnative

import android.Manifest
import android.app.AlertDialog
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Base64
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.pushizo.sdk.Pushizo
import com.pushizo.sdk.HsApiException
import com.pushizo.sdk.HsCallback
import com.pushizo.sdk.HsLog
import com.pushizo.sdk.R

/**
 * Yeni (TurboModule) ve eski mimari modüllerinin ortak gövdesi: JS çağrılarını Android SDK'ya (`com.pushizo.sdk`)
 * iletir. Doğrulama hataları `INVALID_ARGUMENT`, başlatılmamış SDK `NOT_READY`, API hataları sunucu hata koduyla reddedilir.
 */
class PushizoModuleImpl(private val context: ReactApplicationContext) {
    private val sink = PushizoBridge.Sink { event, payload ->
        if (context.hasActiveReactInstance()) context.emitDeviceEvent(event, Arguments.makeNativeMap(payload))
    }

    init {
        PushizoBridge.attach(sink)
    }

    fun invalidate() {
        PushizoBridge.detach(sink)
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
                PushizoBridge.initialize(context, appId, resolved)
                promise.resolve(null)
            }
        }
    }

    fun setConsentGiven(given: Boolean) = Pushizo.setConsentGiven(given)

    fun login(externalId: String, identityHash: String?, jwt: String?, promise: Promise) = guard(promise) {
        Pushizo.login(externalId, identityHash, jwt)
        promise.resolve(null)
    }

    fun updateUserJwt(jwt: String, promise: Promise) = guard(promise) {
        Pushizo.updateUserJwt(jwt)
        promise.resolve(null)
    }

    fun logout() = Pushizo.logout()

    // --- Kullanıcı ---

    fun addTags(tags: ReadableMap, promise: Promise) = guard(promise) {
        Pushizo.User.addTags(tags.toStringMap())
        promise.resolve(null)
    }

    fun removeTags(keys: ReadableArray, promise: Promise) = guard(promise) {
        Pushizo.User.removeTags(keys.toStringList())
        promise.resolve(null)
    }

    fun getTags(promise: Promise) = guard(promise) { promise.resolve(Arguments.makeNativeMap(Pushizo.User.getTags())) }

    fun addAliases(aliases: ReadableMap, promise: Promise) = guard(promise) {
        Pushizo.User.addAliases(aliases.toStringMap())
        promise.resolve(null)
    }

    fun removeAlias(label: String, promise: Promise) = guard(promise) {
        Pushizo.User.removeAlias(label)
        promise.resolve(null)
    }

    fun setLanguage(code: String, promise: Promise) = guard(promise) {
        Pushizo.User.setLanguage(code)
        promise.resolve(null)
    }

    fun addEmail(email: String, promise: Promise) = guard(promise) {
        Pushizo.User.addEmail(email)
        promise.resolve(null)
    }

    fun removeEmail(email: String, promise: Promise) = guard(promise) {
        Pushizo.User.removeEmail(email)
        promise.resolve(null)
    }

    fun addSms(phoneNumber: String, promise: Promise) = guard(promise) {
        Pushizo.User.addSms(phoneNumber)
        promise.resolve(null)
    }

    fun removeSms(phoneNumber: String, promise: Promise) = guard(promise) {
        Pushizo.User.removeSms(phoneNumber)
        promise.resolve(null)
    }

    /** Bu cihazda kaydedilmiş e-posta adresleri (yerel kayıt). */
    fun getEmails(promise: Promise) = guard(promise) { promise.resolve(Arguments.makeNativeArray(Pushizo.User.emails)) }

    /** Bu cihazda kaydedilmiş SMS numaraları (E.164, yerel kayıt). */
    fun getSmsNumbers(promise: Promise) = guard(promise) { promise.resolve(Arguments.makeNativeArray(Pushizo.User.smsNumbers)) }

    fun getExternalId(promise: Promise) = promise.resolve(Pushizo.User.externalId)

    fun getUserId(promise: Promise) = promise.resolve(Pushizo.User.id)

    // --- Tercihler (ADR-0019 §4; abonelik yoksa NOT_READY, geçersiz girdi INVALID_ARGUMENT) ---

    fun getPreferences(promise: Promise) =
        Pushizo.User.getPreferences(reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    fun setPreferences(preferences: ReadableArray, promise: Promise) =
        Pushizo.User.setPreferences(preferences.toPreferenceInputs(), reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    // --- Push aboneliği ---

    fun getPushSubscriptionState(promise: Promise) =
        promise.resolve(Arguments.makeNativeMap(Pushizo.User.pushSubscription.state.toMap()))

    fun optIn() = Pushizo.User.pushSubscription.optIn()

    fun optOut() = Pushizo.User.pushSubscription.optOut()

    // --- Bildirimler ---

    fun getPermission(promise: Promise) = promise.resolve(Pushizo.Notifications.permission)

    /**
     * Android 13+ POST_NOTIFICATIONS izni React Native'in [PermissionAwareActivity] akışıyla istenir (sonuç
     * `ReactActivity` üzerinden bu dinleyiciye gelir), ardından SDK'ya [Pushizo.Notifications.onPermissionResult]
     * bildirilir. Önceki sürümlerde izin çalışma zamanında istenemez; mevcut durum döner.
     */
    fun requestPermission(promise: Promise) {
        if (Pushizo.Notifications.permission || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            promise.resolve(Pushizo.Notifications.permission)
            return
        }
        val activity = context.currentActivity as? PermissionAwareActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "İzin istemek için ön planda bir ReactActivity gerekli.")
            return
        }
        val listener = PermissionListener { requestCode, _, _ ->
            if (requestCode != Pushizo.Notifications.PERMISSION_REQUEST_CODE) return@PermissionListener false
            // İzin değiştiyse yerel SDK izin gözlemcisi `permissionChange` olayını gönderir.
            Pushizo.Notifications.onPermissionResult()
            promise.resolve(Pushizo.Notifications.permission)
            true
        }
        UiThreadUtil.runOnUiThread {
            activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), Pushizo.Notifications.PERMISSION_REQUEST_CODE, listener)
        }
    }

    fun clearAll() = Pushizo.Notifications.clearAll()

    /** Tek bildirimi `androidNotificationId` ile kaldırır; JS kimliği metin olarak iletir, Android'de tamsayı olmalıdır. */
    fun removeNotification(id: String, promise: Promise) = guard(promise) {
        val androidNotificationId = requireNotNull(id.trim().toIntOrNull()) { "Android bildirim kimliği tamsayı olmalı: $id" }
        Pushizo.Notifications.removeNotification(androidNotificationId)
        promise.resolve(null)
    }

    /** Aynı grup anahtarına (`android_group`) sahip bildirimleri ve grup özetini kaldırır. */
    fun removeGroupedNotifications(group: String, promise: Promise) = guard(promise) {
        Pushizo.Notifications.removeGroupedNotifications(group)
        promise.resolve(null)
    }

    fun setForegroundHandlerEnabled(enabled: Boolean) {
        PushizoBridge.foregroundHandlerEnabled = enabled
    }

    fun displayNotification(notificationId: String) = PushizoBridge.displayNotification(notificationId)

    fun preventDefault(notificationId: String) = PushizoBridge.preventDefault(notificationId)

    // --- Oturum ---

    fun sendEvent(name: String, properties: ReadableMap, value: Double?) =
        Pushizo.Session.sendEvent(name, properties.toHashMap(), value)

    // --- In-app ---

    fun addTriggers(triggers: ReadableMap, promise: Promise) = guard(promise) {
        Pushizo.InAppMessages.addTriggers(triggers.toStringMap())
        promise.resolve(null)
    }

    fun removeTriggers(keys: ReadableArray) = Pushizo.InAppMessages.removeTriggers(keys.toStringList())

    fun clearTriggers() = Pushizo.InAppMessages.clearTriggers()

    fun getTriggers(promise: Promise) = promise.resolve(Arguments.makeNativeMap(Pushizo.InAppMessages.getTriggers()))

    fun setScreen(name: String?) = Pushizo.InAppMessages.setScreen(name)

    fun setInAppPaused(paused: Boolean) {
        Pushizo.InAppMessages.paused = paused
    }

    fun getInAppPaused(promise: Promise) = promise.resolve(Pushizo.InAppMessages.paused)

    // --- Bildirim kutusu (SDK geri çağrıları arka plan iş parçacığındadır; Promise iş parçacığından bağımsızdır) ---

    fun inboxList(limit: Double, cursor: String?, promise: Promise) =
        Pushizo.Inbox.list(limit.toInt(), cursor, reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    fun inboxMarkRead(id: String, promise: Promise) =
        Pushizo.Inbox.markRead(id, reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    fun inboxMarkAllRead(promise: Promise) = Pushizo.Inbox.markAllRead(reply(promise) { it })

    fun inboxArchive(id: String, promise: Promise) = Pushizo.Inbox.archive(id, reply(promise) { null })

    fun inboxUnreadCount(promise: Promise) = Pushizo.Inbox.unreadCount(reply(promise) { it })

    // --- Live Activities: iOS (ActivityKit) özelliğidir; Android'de sessizce yok sayılmaz, açık hatayla reddedilir ---

    fun setupDefaultLiveActivity(promise: Promise) = rejectLiveActivities(promise)

    @Suppress("UNUSED_PARAMETER")
    fun startDefaultLiveActivity(activityId: String, attributes: ReadableMap, contentState: ReadableMap, promise: Promise) =
        rejectLiveActivities(promise)

    private fun rejectLiveActivities(promise: Promise) = promise.reject(PLATFORM_NOT_SUPPORTED, LIVE_ACTIVITIES_IOS_ONLY)

    // --- Konum (v2 Faz 17b; yalnızca ön plan, arka plan konumu yok) ---

    fun setLocationShared(shared: Boolean) = Pushizo.Location.setShared(shared)

    fun isLocationShared(promise: Promise) = promise.resolve(Pushizo.Location.isShared)

    /**
     * Yerel SDK'nın `Location.requestPermission(activity)` çağrısı sonucu bildirmediğinden akış köprüde yürütülür:
     * açıklama diyaloğu (SDK string kaynakları), ardından React Native'in [PermissionAwareActivity] akışıyla sistem izni
     * ([Pushizo.Location.PERMISSION_REQUEST_CODE]); sonuçta SDK'ya [Pushizo.Location.onPermissionResult] bildirilir.
     * Uygulama manifest'inde konum izni yoksa izin istenemez ve `false` döner.
     */
    fun requestLocationPermission(rationale: String?, promise: Promise) {
        if (Pushizo.Location.permissionGranted) {
            Pushizo.Location.onPermissionResult()
            promise.resolve(true)
            return
        }
        val permissions = declaredLocationPermissions()
        if (permissions.isEmpty()) {
            HsLog.w("konum izni istenemedi: uygulama manifest'inde ACCESS_COARSE_LOCATION/ACCESS_FINE_LOCATION yok")
            promise.resolve(false)
            return
        }
        val activity = context.currentActivity
        if (activity !is PermissionAwareActivity) {
            promise.reject("NO_ACTIVITY", "İzin istemek için ön planda bir ReactActivity gerekli.")
            return
        }
        val listener = PermissionListener { requestCode, _, _ ->
            if (requestCode != Pushizo.Location.PERMISSION_REQUEST_CODE) return@PermissionListener false
            // İzin verildiyse ve paylaşım açıksa yerel SDK konumu hemen gönderir.
            Pushizo.Location.onPermissionResult()
            promise.resolve(Pushizo.Location.permissionGranted)
            true
        }
        UiThreadUtil.runOnUiThread {
            if (activity.isFinishing || activity.isDestroyed) {
                promise.resolve(false)
                return@runOnUiThread
            }
            // "Devam" dışındaki her kapanış (Şimdi değil, geri tuşu, dışına dokunma) reddedilmiş sayılır; Promise bir kez çözülür.
            var proceeding = false
            AlertDialog.Builder(activity)
                .setTitle(R.string.hs_location_rationale_title)
                .setMessage(rationale?.takeIf { it.isNotBlank() } ?: activity.getString(R.string.hs_location_rationale_message))
                .setPositiveButton(R.string.hs_location_rationale_continue) { _, _ ->
                    proceeding = true
                    activity.requestPermissions(permissions, Pushizo.Location.PERMISSION_REQUEST_CODE, listener)
                }
                .setNegativeButton(R.string.hs_location_rationale_not_now, null)
                .setOnDismissListener { if (!proceeding) promise.resolve(false) }
                .show()
        }
    }

    /** Uygulama manifest'inde tanımlı konum izinleri; yalnızca bunlar çalışma zamanında istenebilir. */
    private fun declaredLocationPermissions(): Array<String> = try {
        val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
        val requested = info.requestedPermissions?.toSet().orEmpty()
        LOCATION_PERMISSIONS.filter { it in requested }.toTypedArray()
    } catch (e: PackageManager.NameNotFoundException) {
        HsLog.w("uygulama paket bilgisi okunamadı", e)
        emptyArray()
    }

    // --- Canlı sohbet (ADR-0040) ---

    fun chatStart(name: String?, email: String?, language: String?, promise: Promise) =
        Pushizo.Chat.start(name, email, language, reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    fun chatGetConfig(language: String?, promise: Promise) =
        Pushizo.Chat.getConfig(language, reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    fun chatGetConversation(promise: Promise) = Pushizo.Chat.getConversation(reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    fun chatGetMessages(afterSeq: Double?, beforeSeq: Double?, limit: Double, promise: Promise) =
        Pushizo.Chat.getMessages(afterSeq?.toLong(), beforeSeq?.toLong(), limit.toInt(), reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    fun chatSendMessage(text: String, optionId: String?, promise: Promise) =
        Pushizo.Chat.sendMessage(text, optionId, reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    /** Base64 içerik (JS'te ikili veri yok); geçersiz base64 `INVALID_ARGUMENT`. */
    fun chatSendAttachmentData(base64: String, fileName: String, mimeType: String, text: String?, promise: Promise) = guard(promise) {
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        Pushizo.Chat.sendAttachment(bytes, fileName, mimeType, text, reply(promise) { Arguments.makeNativeMap(it.toMap()) })
    }

    fun chatSendAttachmentUri(uri: String, fileName: String, mimeType: String, text: String?, promise: Promise) = guard(promise) {
        Pushizo.Chat.sendAttachment(Uri.parse(uri), fileName, mimeType, text, reply(promise) { Arguments.makeNativeMap(it.toMap()) })
    }

    fun chatMarkRead(seq: Double, promise: Promise) = Pushizo.Chat.markRead(seq.toLong(), reply(promise) { it })

    fun chatRefreshUnreadCount(promise: Promise) = Pushizo.Chat.refreshUnreadCount(reply(promise) { it })

    fun chatGetUnreadCount(promise: Promise) = promise.resolve(Pushizo.Chat.unreadCount)

    fun chatLeaveOfflineMessage(email: String, text: String, name: String?, promise: Promise) =
        Pushizo.Chat.leaveOfflineMessage(email, text, name, reply(promise) { Arguments.makeNativeMap(it.toMap()) })

    fun chatSetTyping(typing: Boolean) = Pushizo.Chat.setTyping(typing)

    fun chatStartListening() = Pushizo.Chat.startListening()

    fun chatStopListening() = Pushizo.Chat.stopListening()

    fun chatAttachmentUrl(attachmentId: String, download: Boolean, promise: Promise) = guard(promise) {
        promise.resolve(Pushizo.Chat.attachmentUrl(attachmentId, download))
    }

    fun chatGetVisitorId(promise: Promise) = promise.resolve(Pushizo.Chat.visitorId)

    // --- Hata ayıklama ---

    fun setLogLevel(level: String) = Pushizo.Debug.setLogLevel(logLevel(level))

    // --- NativeEventEmitter ---

    fun addListener(eventName: String) = PushizoBridge.onJsListenerAdded(eventName)

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
        const val NAME = "Pushizo"
        const val PLATFORM_NOT_SUPPORTED = "PLATFORM_NOT_SUPPORTED"
        const val LIVE_ACTIVITIES_IOS_ONLY = "Live Activities yalnızca iOS'ta desteklenir"

        /** Ön plan konum izinleri (yerel SDK ile aynı küme); arka plan konumu istenmez. */
        private val LOCATION_PERMISSIONS = listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    }
}
