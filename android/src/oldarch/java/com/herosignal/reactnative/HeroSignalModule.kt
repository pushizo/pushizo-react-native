package com.herosignal.reactnative

import com.facebook.react.bridge.Dynamic
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableType

/** Eski mimari (bridge) modülü; gövde [HeroSignalModuleImpl]'dedir. Metot kümesi `src/NativeHeroSignal.ts` ile aynıdır. */
class HeroSignalModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val impl = HeroSignalModuleImpl(reactContext)

    override fun getName(): String = HeroSignalModuleImpl.NAME

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
    fun login(externalId: String, identityHash: String?, promise: Promise) {
        impl.login(externalId, identityHash, promise)
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
    fun getExternalId(promise: Promise) {
        impl.getExternalId(promise)
    }

    @ReactMethod
    fun getUserId(promise: Promise) {
        impl.getUserId(promise)
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
}
