package com.herosignal.reactnative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.turbomodule.core.interfaces.TurboModule

/**
 * Eski mimari (bridge) için spec: yeni mimaride codegen'in `src/NativeHeroSignal.ts`'ten ürettiği
 * `NativeHeroSignalSpec` ile aynı imzalar. `TurboModule` arayüzü sayesinde bridge, `@ReactMethod`
 * işaretli yöntemleri bu üst sınıftan okur. Spec değişirse bu dosya da güncellenmelidir.
 */
abstract class NativeHeroSignalSpec(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), TurboModule {
    @ReactMethod abstract fun initialize(appId: String, options: ReadableMap)
    @ReactMethod abstract fun setConsentRequired(required: Boolean)
    @ReactMethod abstract fun setConsentGiven(given: Boolean)
    @ReactMethod abstract fun login(externalId: String, identityHash: String?)
    @ReactMethod abstract fun logout()
    @ReactMethod abstract fun addTags(tags: ReadableMap)
    @ReactMethod abstract fun removeTags(keys: ReadableArray)
    @ReactMethod abstract fun getTags(promise: Promise)
    @ReactMethod abstract fun addAliases(aliases: ReadableMap)
    @ReactMethod abstract fun removeAlias(label: String)
    @ReactMethod abstract fun setLanguage(code: String)
    @ReactMethod abstract fun addEmail(email: String, promise: Promise)
    @ReactMethod abstract fun removeEmail(email: String, promise: Promise)
    @ReactMethod abstract fun addSms(phoneNumber: String, promise: Promise)
    @ReactMethod abstract fun removeSms(phoneNumber: String, promise: Promise)
    @ReactMethod abstract fun getExternalId(promise: Promise)
    @ReactMethod abstract fun getUserId(promise: Promise)
    @ReactMethod abstract fun getPushSubscriptionState(promise: Promise)
    @ReactMethod abstract fun optIn()
    @ReactMethod abstract fun optOut()
    @ReactMethod abstract fun requestPermission(promise: Promise)
    @ReactMethod abstract fun getPermission(promise: Promise)
    @ReactMethod abstract fun setForegroundHandlerEnabled(enabled: Boolean)
    @ReactMethod abstract fun completeForegroundDisplay(eventId: String, display: Boolean)
    @ReactMethod abstract fun displayNotification(eventId: String)
    @ReactMethod abstract fun clearAll()
    @ReactMethod abstract fun removeNotification(id: String)
    @ReactMethod abstract fun removeGroupedNotifications(group: String)
    @ReactMethod abstract fun sendEvent(name: String, properties: ReadableMap, value: Double, hasValue: Boolean)
    @ReactMethod abstract fun addTriggers(triggers: ReadableMap)
    @ReactMethod abstract fun removeTriggers(keys: ReadableArray)
    @ReactMethod abstract fun clearTriggers()
    @ReactMethod abstract fun getTriggers(promise: Promise)
    @ReactMethod abstract fun setScreen(name: String?)
    @ReactMethod abstract fun setInAppPaused(paused: Boolean)
    @ReactMethod abstract fun getInAppPaused(promise: Promise)
    @ReactMethod abstract fun inboxList(limit: Double, cursor: String?, promise: Promise)
    @ReactMethod abstract fun inboxMarkRead(id: String, promise: Promise)
    @ReactMethod abstract fun inboxMarkAllRead(promise: Promise)
    @ReactMethod abstract fun inboxArchive(id: String, promise: Promise)
    @ReactMethod abstract fun inboxUnreadCount(promise: Promise)
    @ReactMethod abstract fun setLogLevel(level: String)
    @ReactMethod abstract fun addListener(eventName: String)
    @ReactMethod abstract fun removeListeners(count: Double)
}
