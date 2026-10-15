package com.herosignal.reactnative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap

/** Yeni mimari (TurboModule): codegen'in ürettiği [NativeHeroSignalSpec] uygulaması; gövde [HeroSignalModuleImpl]'dedir. */
class HeroSignalModule(reactContext: ReactApplicationContext) : NativeHeroSignalSpec(reactContext) {
    private val impl = HeroSignalModuleImpl(reactContext)

    override fun getName(): String = HeroSignalModuleImpl.NAME

    override fun invalidate() {
        impl.invalidate()
        super.invalidate()
    }

    override fun initialize(appId: String, options: ReadableMap, promise: Promise) {
        impl.initialize(appId, options, promise)
    }

    override fun setConsentGiven(given: Boolean) {
        impl.setConsentGiven(given)
    }

    override fun login(externalId: String, identityHash: String?, jwt: String?, promise: Promise) {
        impl.login(externalId, identityHash, jwt, promise)
    }

    override fun updateUserJwt(jwt: String, promise: Promise) {
        impl.updateUserJwt(jwt, promise)
    }

    override fun logout() {
        impl.logout()
    }

    override fun addTags(tags: ReadableMap, promise: Promise) {
        impl.addTags(tags, promise)
    }

    override fun removeTags(keys: ReadableArray, promise: Promise) {
        impl.removeTags(keys, promise)
    }

    override fun getTags(promise: Promise) {
        impl.getTags(promise)
    }

    override fun addAliases(aliases: ReadableMap, promise: Promise) {
        impl.addAliases(aliases, promise)
    }

    override fun removeAlias(label: String, promise: Promise) {
        impl.removeAlias(label, promise)
    }

    override fun setLanguage(code: String, promise: Promise) {
        impl.setLanguage(code, promise)
    }

    override fun addEmail(email: String, promise: Promise) {
        impl.addEmail(email, promise)
    }

    override fun removeEmail(email: String, promise: Promise) {
        impl.removeEmail(email, promise)
    }

    override fun addSms(phoneNumber: String, promise: Promise) {
        impl.addSms(phoneNumber, promise)
    }

    override fun removeSms(phoneNumber: String, promise: Promise) {
        impl.removeSms(phoneNumber, promise)
    }

    override fun getEmails(promise: Promise) {
        impl.getEmails(promise)
    }

    override fun getSmsNumbers(promise: Promise) {
        impl.getSmsNumbers(promise)
    }

    override fun getExternalId(promise: Promise) {
        impl.getExternalId(promise)
    }

    override fun getUserId(promise: Promise) {
        impl.getUserId(promise)
    }

    override fun getPreferences(promise: Promise) {
        impl.getPreferences(promise)
    }

    override fun setPreferences(preferences: ReadableArray, promise: Promise) {
        impl.setPreferences(preferences, promise)
    }

    override fun getPushSubscriptionState(promise: Promise) {
        impl.getPushSubscriptionState(promise)
    }

    override fun optIn() {
        impl.optIn()
    }

    override fun optOut() {
        impl.optOut()
    }

    override fun getPermission(promise: Promise) {
        impl.getPermission(promise)
    }

    override fun requestPermission(promise: Promise) {
        impl.requestPermission(promise)
    }

    override fun clearAll() {
        impl.clearAll()
    }

    override fun removeNotification(id: String, promise: Promise) {
        impl.removeNotification(id, promise)
    }

    override fun removeGroupedNotifications(group: String, promise: Promise) {
        impl.removeGroupedNotifications(group, promise)
    }

    override fun setForegroundHandlerEnabled(enabled: Boolean) {
        impl.setForegroundHandlerEnabled(enabled)
    }

    override fun displayNotification(notificationId: String) {
        impl.displayNotification(notificationId)
    }

    override fun preventDefault(notificationId: String) {
        impl.preventDefault(notificationId)
    }

    override fun sendEvent(name: String, properties: ReadableMap, value: Double?) {
        impl.sendEvent(name, properties, value)
    }

    override fun addTriggers(triggers: ReadableMap, promise: Promise) {
        impl.addTriggers(triggers, promise)
    }

    override fun removeTriggers(keys: ReadableArray) {
        impl.removeTriggers(keys)
    }

    override fun clearTriggers() {
        impl.clearTriggers()
    }

    override fun getTriggers(promise: Promise) {
        impl.getTriggers(promise)
    }

    override fun setScreen(name: String?) {
        impl.setScreen(name)
    }

    override fun setInAppPaused(paused: Boolean) {
        impl.setInAppPaused(paused)
    }

    override fun getInAppPaused(promise: Promise) {
        impl.getInAppPaused(promise)
    }

    override fun inboxList(limit: Double, cursor: String?, promise: Promise) {
        impl.inboxList(limit, cursor, promise)
    }

    override fun inboxMarkRead(id: String, promise: Promise) {
        impl.inboxMarkRead(id, promise)
    }

    override fun inboxMarkAllRead(promise: Promise) {
        impl.inboxMarkAllRead(promise)
    }

    override fun inboxArchive(id: String, promise: Promise) {
        impl.inboxArchive(id, promise)
    }

    override fun inboxUnreadCount(promise: Promise) {
        impl.inboxUnreadCount(promise)
    }

    override fun setupDefaultLiveActivity(promise: Promise) {
        impl.setupDefaultLiveActivity(promise)
    }

    override fun startDefaultLiveActivity(activityId: String, attributes: ReadableMap, contentState: ReadableMap, promise: Promise) {
        impl.startDefaultLiveActivity(activityId, attributes, contentState, promise)
    }

    override fun setLocationShared(shared: Boolean) {
        impl.setLocationShared(shared)
    }

    override fun isLocationShared(promise: Promise) {
        impl.isLocationShared(promise)
    }

    override fun requestLocationPermission(rationale: String?, promise: Promise) {
        impl.requestLocationPermission(rationale, promise)
    }

    override fun setLogLevel(level: String) {
        impl.setLogLevel(level)
    }

    override fun addListener(eventName: String) {
        impl.addListener(eventName)
    }

    override fun removeListeners(count: Double) {
        // Dinleyici sayısı JS tarafında izlenir; yerelde ek iş gerekmez.
    }
}
