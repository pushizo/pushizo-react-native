package com.pushizo.reactnative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap

/** Yeni mimari (TurboModule): codegen'in ürettiği [NativePushizoSpec] uygulaması; gövde [PushizoModuleImpl]'dedir. */
class PushizoModule(reactContext: ReactApplicationContext) : NativePushizoSpec(reactContext) {
    private val impl = PushizoModuleImpl(reactContext)

    override fun getName(): String = PushizoModuleImpl.NAME

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

    override fun contentCardsList(limit: Double, promise: Promise) {
        impl.contentCardsList(limit, promise)
    }

    override fun contentCardEvent(id: String, event: String, promise: Promise) {
        impl.contentCardEvent(id, event, promise)
    }

    override fun chatStart(name: String?, email: String?, language: String?, promise: Promise) {
        impl.chatStart(name, email, language, promise)
    }

    override fun chatGetConfig(language: String?, promise: Promise) {
        impl.chatGetConfig(language, promise)
    }

    override fun chatGetConversation(promise: Promise) {
        impl.chatGetConversation(promise)
    }

    override fun chatGetMessages(afterSeq: Double?, beforeSeq: Double?, limit: Double, promise: Promise) {
        impl.chatGetMessages(afterSeq, beforeSeq, limit, promise)
    }

    override fun chatSendMessage(text: String, optionId: String?, promise: Promise) {
        impl.chatSendMessage(text, optionId, promise)
    }

    override fun chatSendAttachmentData(base64: String, fileName: String, mimeType: String, text: String?, promise: Promise) {
        impl.chatSendAttachmentData(base64, fileName, mimeType, text, promise)
    }

    override fun chatSendAttachmentUri(uri: String, fileName: String, mimeType: String, text: String?, promise: Promise) {
        impl.chatSendAttachmentUri(uri, fileName, mimeType, text, promise)
    }

    override fun chatMarkRead(seq: Double, promise: Promise) {
        impl.chatMarkRead(seq, promise)
    }

    override fun chatRefreshUnreadCount(promise: Promise) {
        impl.chatRefreshUnreadCount(promise)
    }

    override fun chatGetUnreadCount(promise: Promise) {
        impl.chatGetUnreadCount(promise)
    }

    override fun chatLeaveOfflineMessage(email: String, text: String, name: String?, promise: Promise) {
        impl.chatLeaveOfflineMessage(email, text, name, promise)
    }

    override fun chatSetTyping(typing: Boolean) {
        impl.chatSetTyping(typing)
    }

    override fun chatStartListening() {
        impl.chatStartListening()
    }

    override fun chatStopListening() {
        impl.chatStopListening()
    }

    override fun chatAttachmentUrl(attachmentId: String, download: Boolean, promise: Promise) {
        impl.chatAttachmentUrl(attachmentId, download, promise)
    }

    override fun chatGetVisitorId(promise: Promise) {
        impl.chatGetVisitorId(promise)
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

    override fun setGeofencingEnabled(enabled: Boolean) {
        impl.setGeofencingEnabled(enabled)
    }

    override fun isGeofencingEnabled(promise: Promise) {
        impl.isGeofencingEnabled(promise)
    }

    override fun deliveryStatus(promise: Promise) {
        impl.deliveryStatus(promise)
    }

    override fun deliveryShouldShowGuidance(minIntervalDays: Double, promise: Promise) {
        impl.deliveryShouldShowGuidance(minIntervalDays, promise)
    }

    override fun deliveryOpenSettings(setting: String, promise: Promise) {
        impl.deliveryOpenSettings(setting, promise)
    }

    override fun deliveryShowGuidance(setting: String, message: String?, promise: Promise) {
        impl.deliveryShowGuidance(setting, message, promise)
    }

    override fun featureFlagsRefresh(promise: Promise) {
        impl.featureFlagsRefresh(promise)
    }

    override fun featureFlagsIsEnabled(key: String, defaultValue: Boolean, promise: Promise) {
        impl.featureFlagsIsEnabled(key, defaultValue, promise)
    }

    override fun featureFlagsGetValue(key: String, promise: Promise) {
        impl.featureFlagsGetValue(key, promise)
    }

    override fun placementsList(key: String, limit: Double, promise: Promise) {
        impl.placementsList(key, limit, promise)
    }

    override fun placementsReportImpression(messageId: String) {
        impl.placementsReportImpression(messageId)
    }

    override fun placementsReportClick(messageId: String, buttonId: String) {
        impl.placementsReportClick(messageId, buttonId)
    }

    override fun placementsReportDismiss(messageId: String) {
        impl.placementsReportDismiss(messageId)
    }

    override fun isInitialized(promise: Promise) {
        impl.isInitialized(promise)
    }

    override fun loginWithProfile(externalId: String, profile: ReadableMap, identityHash: String?, jwt: String?, promise: Promise) {
        impl.loginWithProfile(externalId, profile, identityHash, jwt, promise)
    }

    override fun setAdsPersonalizationConsent(granted: Boolean, promise: Promise) {
        impl.setAdsPersonalizationConsent(granted, promise)
    }

    override fun getConsents(promise: Promise) {
        impl.getConsents(promise)
    }

    override fun registerAdm(token: String, promise: Promise) {
        impl.registerAdm(token, promise)
    }

    override fun setAdvertisingId(id: String?) {
        impl.setAdvertisingId(id)
    }

    override fun setBadgeCount(count: Double) {
        impl.setBadgeCount(count)
    }

    override fun chatIsListening(promise: Promise) {
        impl.chatIsListening(promise)
    }

    override fun locationPermissionGranted(promise: Promise) {
        impl.locationPermissionGranted(promise)
    }

    override fun locationBackgroundPermissionGranted(promise: Promise) {
        impl.locationBackgroundPermissionGranted(promise)
    }

    override fun requestBackgroundLocationPermission(rationale: String?, promise: Promise) {
        impl.requestBackgroundLocationPermission(rationale, promise)
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
