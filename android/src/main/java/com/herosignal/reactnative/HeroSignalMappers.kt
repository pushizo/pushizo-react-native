package com.herosignal.reactnative

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.herosignal.sdk.HeroSignal
import com.herosignal.sdk.HsInboxItem
import com.herosignal.sdk.HsInboxPage
import com.herosignal.sdk.HsLog
import com.herosignal.sdk.HsNotification
import com.herosignal.sdk.HsPushSubscriptionState

/** Yerel SDK modellerinin JS'e gidecek haritaları (alan adları TS `types.ts` ile aynıdır). */
internal fun HsNotification.toMap(): Map<String, Any?> = mapOf(
    "title" to title,
    "body" to body,
    "url" to url,
    "imageUrl" to imageUrl,
    "deliveryId" to deliveryId,
    "messageId" to messageId,
    "data" to data,
)

internal fun HsPushSubscriptionState.toMap(): Map<String, Any?> =
    mapOf("id" to id, "token" to token, "optedIn" to optedIn, "permission" to permission)

internal fun HsInboxItem.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "messageId" to messageId,
    "title" to title,
    "body" to body,
    "url" to url,
    "imageUrl" to imageUrl,
    "data" to data,
    "read" to read,
    "readAt" to readAt,
    "archivedAt" to archivedAt,
    "expiresAt" to expiresAt,
    "createdAt" to createdAt,
)

internal fun HsInboxPage.toMap(): Map<String, Any?> =
    mapOf("items" to items.map { it.toMap() }, "unreadCount" to unreadCount, "nextCursor" to nextCursor, "hasMore" to hasMore)

/** Yalnızca metin değerleri alır (tag, alias, trigger); diğer tipler TS katmanında zaten reddedilir. */
internal fun ReadableMap.toStringMap(): Map<String, String> {
    val out = LinkedHashMap<String, String>()
    val iterator = keySetIterator()
    while (iterator.hasNextKey()) {
        val key = iterator.nextKey()
        if (getType(key) == ReadableType.String) getString(key)?.let { out[key] = it }
    }
    return out
}

internal fun ReadableArray.toStringList(): List<String> =
    (0 until size()).mapNotNull { if (getType(it) == ReadableType.String) getString(it) else null }

internal fun logLevel(name: String?): HsLog.Level = when (name) {
    "none" -> HsLog.Level.NONE
    "error" -> HsLog.Level.ERROR
    "info" -> HsLog.Level.INFO
    "debug" -> HsLog.Level.DEBUG
    else -> HsLog.Level.WARN
}

/** JS `initialize` seçenekleri → yerel `HeroSignal.Options` (verilmeyenler yerel varsayılanı korur). */
internal fun ReadableMap.toOptions(): HeroSignal.Options {
    val defaults = HeroSignal.Options()
    fun str(key: String): String? = if (hasKey(key) && getType(key) == ReadableType.String) getString(key) else null
    fun bool(key: String): Boolean? = if (hasKey(key) && getType(key) == ReadableType.Boolean) getBoolean(key) else null
    return HeroSignal.Options(
        apiUrl = str("apiUrl") ?: defaults.apiUrl,
        requiresPrivacyConsent = bool("requiresPrivacyConsent") ?: defaults.requiresPrivacyConsent,
        logLevel = str("logLevel")?.let { logLevel(it) } ?: defaults.logLevel,
        defaultChannelName = str("defaultChannelName") ?: defaults.defaultChannelName,
        defaultChannelId = str("defaultChannelId") ?: defaults.defaultChannelId,
    )
}
