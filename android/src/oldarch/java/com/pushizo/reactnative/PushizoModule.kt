package com.pushizo.reactnative

import com.facebook.react.bridge.Dynamic
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableType

/** Eski mimari (bridge) modülü; gövde [PushizoModuleImpl]'dedir. Metot kümesi `src/NativePushizo.ts` ile aynıdır. */
class PushizoModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val impl = PushizoModuleImpl(reactContext)

    override fun getName(): String = PushizoModuleImpl.NAME

    override fun invalidate() {
        impl.invalidate()
        super.invalidate()
    }

    @ReactMethod
    fun initialize(appId: String, options: ReadableMap, promise: Promise) {
        impl.initialize(appId, options, promise)
    }

    @ReactMethod
    fun setConsentGiven(given: Boolean) {
        impl.setConsentGiven(given)
    }

    @ReactMethod
    fun login(externalId: String, identityHash: String?, jwt: String?, promise: Promise) {
        impl.login(externalId, identityHash, jwt, promise)
    }

    @ReactMethod
    fun updateUserJwt(jwt: String, promise: Promise) {
        impl.updateUserJwt(jwt, promise)
    }

    @ReactMethod
    fun logout() {
        impl.logout()
    }

    @ReactMethod
    fun addTags(tags: ReadableMap, promise: Promise) {
        impl.addTags(tags, promise)
    }

    @ReactMethod
    fun removeTags(keys: ReadableArray, promise: Promise) {
        impl.removeTags(keys, promise)
    }

    @ReactMethod
    fun getTags(promise: Promise) {
        impl.getTags(promise)
    }

    @ReactMethod
    fun addAliases(aliases: ReadableMap, promise: Promise) {
        impl.addAliases(aliases, promise)
    }

    @ReactMethod
    fun removeAlias(label: String, promise: Promise) {
        impl.removeAlias(label, promise)
    }

    @ReactMethod
    fun setLanguage(code: String, promise: Promise) {
        impl.setLanguage(code, promise)
    }

    @ReactMethod
    fun addEmail(email: String, promise: Promise) {
        impl.addEmail(email, promise)
    }

    @ReactMethod
    fun removeEmail(email: String, promise: Promise) {
        impl.removeEmail(email, promise)
    }

    @ReactMethod
    fun addSms(phoneNumber: String, promise: Promise) {
        impl.addSms(phoneNumber, promise)
    }

    @ReactMethod
    fun removeSms(phoneNumber: String, promise: Promise) {
        impl.removeSms(phoneNumber, promise)
    }

    @ReactMethod
    fun getEmails(promise: Promise) {
        impl.getEmails(promise)
    }

    @ReactMethod
    fun getSmsNumbers(promise: Promise) {
        impl.getSmsNumbers(promise)
    }

    @ReactMethod
    fun getExternalId(promise: Promise) {
        impl.getExternalId(promise)
    }

    @ReactMethod
    fun getUserId(promise: Promise) {
        impl.getUserId(promise)
    }

    @ReactMethod
    fun getPreferences(promise: Promise) {
        impl.getPreferences(promise)
    }

    @ReactMethod
    fun setPreferences(preferences: ReadableArray, promise: Promise) {
        impl.setPreferences(preferences, promise)
    }

    @ReactMethod
    fun getPushSubscriptionState(promise: Promise) {
        impl.getPushSubscriptionState(promise)
    }

    @ReactMethod
    fun optIn() {
        impl.optIn()
    }

    @ReactMethod
    fun optOut() {
        impl.optOut()
    }

    @ReactMethod
    fun getPermission(promise: Promise) {
        impl.getPermission(promise)
    }

    @ReactMethod
    fun requestPermission(promise: Promise) {
        impl.requestPermission(promise)
    }

    @ReactMethod
    fun clearAll() {
        impl.clearAll()
    }

    @ReactMethod
    fun removeNotification(id: String, promise: Promise) {
        impl.removeNotification(id, promise)
    }

    @ReactMethod
    fun removeGroupedNotifications(group: String, promise: Promise) {
        impl.removeGroupedNotifications(group, promise)
    }

    @ReactMethod
    fun setForegroundHandlerEnabled(enabled: Boolean) {
        impl.setForegroundHandlerEnabled(enabled)
    }

    @ReactMethod
    fun displayNotification(notificationId: String) {
        impl.displayNotification(notificationId)
    }

    @ReactMethod
    fun preventDefault(notificationId: String) {
        impl.preventDefault(notificationId)
    }

    /** Eski köprü boş geçilebilir sayıyı `Dynamic` olarak verir. */
    @ReactMethod
    fun sendEvent(name: String, properties: ReadableMap, value: Dynamic) {
        impl.sendEvent(name, properties, if (value.isNull || value.type != ReadableType.Number) null else value.asDouble())
    }

    @ReactMethod
    fun addTriggers(triggers: ReadableMap, promise: Promise) {
        impl.addTriggers(triggers, promise)
    }

    @ReactMethod
    fun removeTriggers(keys: ReadableArray) {
        impl.removeTriggers(keys)
    }

    @ReactMethod
    fun clearTriggers() {
        impl.clearTriggers()
    }

    @ReactMethod
    fun getTriggers(promise: Promise) {
        impl.getTriggers(promise)
    }

    @ReactMethod
    fun setScreen(name: String?) {
        impl.setScreen(name)
    }

    @ReactMethod
    fun setInAppPaused(paused: Boolean) {
        impl.setInAppPaused(paused)
    }

    @ReactMethod
    fun getInAppPaused(promise: Promise) {
        impl.getInAppPaused(promise)
    }

    @ReactMethod
    fun inboxList(limit: Double, cursor: String?, promise: Promise) {
        impl.inboxList(limit, cursor, promise)
    }

    @ReactMethod
    fun inboxMarkRead(id: String, promise: Promise) {
        impl.inboxMarkRead(id, promise)
    }

    @ReactMethod
    fun inboxMarkAllRead(promise: Promise) {
        impl.inboxMarkAllRead(promise)
    }

    @ReactMethod
    fun inboxArchive(id: String, promise: Promise) {
        impl.inboxArchive(id, promise)
    }

    @ReactMethod
    fun inboxUnreadCount(promise: Promise) {
        impl.inboxUnreadCount(promise)
    }

    @ReactMethod
    fun chatStart(name: String?, email: String?, language: String?, promise: Promise) {
        impl.chatStart(name, email, language, promise)
    }

    @ReactMethod
    fun chatGetConfig(language: String?, promise: Promise) {
        impl.chatGetConfig(language, promise)
    }

    @ReactMethod
    fun chatGetConversation(promise: Promise) {
        impl.chatGetConversation(promise)
    }

    @ReactMethod
    fun chatGetMessages(afterSeq: Dynamic, beforeSeq: Dynamic, limit: Double, promise: Promise) {
        impl.chatGetMessages(afterSeq.numberOrNull(), beforeSeq.numberOrNull(), limit, promise)
    }

    @ReactMethod
    fun chatSendMessage(text: String, optionId: String?, promise: Promise) {
        impl.chatSendMessage(text, optionId, promise)
    }

    @ReactMethod
    fun chatSendAttachmentData(base64: String, fileName: String, mimeType: String, text: String?, promise: Promise) {
        impl.chatSendAttachmentData(base64, fileName, mimeType, text, promise)
    }

    @ReactMethod
    fun chatSendAttachmentUri(uri: String, fileName: String, mimeType: String, text: String?, promise: Promise) {
        impl.chatSendAttachmentUri(uri, fileName, mimeType, text, promise)
    }

    @ReactMethod
    fun chatMarkRead(seq: Double, promise: Promise) {
        impl.chatMarkRead(seq, promise)
    }

    @ReactMethod
    fun chatRefreshUnreadCount(promise: Promise) {
        impl.chatRefreshUnreadCount(promise)
    }

    @ReactMethod
    fun chatGetUnreadCount(promise: Promise) {
        impl.chatGetUnreadCount(promise)
    }

    @ReactMethod
    fun chatLeaveOfflineMessage(email: String, text: String, name: String?, promise: Promise) {
        impl.chatLeaveOfflineMessage(email, text, name, promise)
    }

    @ReactMethod
    fun chatSetTyping(typing: Boolean) {
        impl.chatSetTyping(typing)
    }

    @ReactMethod
    fun chatStartListening() {
        impl.chatStartListening()
    }

    @ReactMethod
    fun chatStopListening() {
        impl.chatStopListening()
    }

    @ReactMethod
    fun chatAttachmentUrl(attachmentId: String, download: Boolean, promise: Promise) {
        impl.chatAttachmentUrl(attachmentId, download, promise)
    }

    @ReactMethod
    fun chatGetVisitorId(promise: Promise) {
        impl.chatGetVisitorId(promise)
    }

    @ReactMethod
    fun setupDefaultLiveActivity(promise: Promise) {
        impl.setupDefaultLiveActivity(promise)
    }

    @ReactMethod
    fun startDefaultLiveActivity(activityId: String, attributes: ReadableMap, contentState: ReadableMap, promise: Promise) {
        impl.startDefaultLiveActivity(activityId, attributes, contentState, promise)
    }

    @ReactMethod
    fun setLocationShared(shared: Boolean) {
        impl.setLocationShared(shared)
    }

    @ReactMethod
    fun isLocationShared(promise: Promise) {
        impl.isLocationShared(promise)
    }

    @ReactMethod
    fun requestLocationPermission(rationale: String?, promise: Promise) {
        impl.requestLocationPermission(rationale, promise)
    }

    @ReactMethod
    fun setLogLevel(level: String) {
        impl.setLogLevel(level)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        impl.addListener(eventName)
    }

    @ReactMethod
    fun removeListeners(count: Double) {
        // Dinleyici sayısı JS tarafında izlenir; yerelde ek iş gerekmez.
    }

    /** Eski mimaride `number | null` argümanı `Dynamic` olarak gelir. */
    private fun Dynamic.numberOrNull(): Double? = if (isNull || type != ReadableType.Number) null else asDouble()
}
