package com.pushizo.reactnative

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.pushizo.sdk.Pushizo
import com.pushizo.sdk.HsInboxItem
import com.pushizo.sdk.HsInboxPage
import com.pushizo.sdk.HsLog
import com.pushizo.sdk.HsMessageCategory
import com.pushizo.sdk.HsNotification
import com.pushizo.sdk.HsPreference
import com.pushizo.sdk.HsPreferenceInput
import com.pushizo.sdk.HsPreferencesResult
import com.pushizo.sdk.HsPushSubscriptionState

/** Yerel SDK modellerinin JS'e gidecek haritaları (alan adları TS `types.ts` ile aynıdır). */
internal fun HsNotification.toMap(): Map<String, Any?> = mapOf(
    "title" to title,
    "body" to body,
    "url" to url,
    "imageUrl" to imageUrl,
    "deliveryId" to deliveryId,
    "messageId" to messageId,
    "data" to data,
    "androidNotificationId" to androidNotificationId,
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

internal fun HsPreference.toMap(): Map<String, Any?> = mapOf(
    "category" to category,
    "channel" to channel,
    "optedIn" to optedIn,
    "explicit" to explicit,
    "source" to source,
    "updatedAt" to updatedAt,
)

internal fun HsMessageCategory.toMap(): Map<String, Any?> = mapOf(
    "key" to key,
    "name" to name,
    "description" to description,
    "channels" to channels,
    "defaultOptedIn" to defaultOptedIn,
)

internal fun HsPreferencesResult.toMap(): Map<String, Any?> =
    mapOf("preferences" to preferences.map { it.toMap() }, "categories" to categories.map { it.toMap() })

/**
 * JS `setPreferences` girdisi → yerel [HsPreferenceInput] listesi. Kurallar (1-100 kayıt, kategori 1-64, bilinen kanal)
 * yerel SDK'da doğrulanır; tipi bozuk alan boş/varsayılan değere düşer ve orada `INVALID_ARGUMENT` ile reddedilir.
 */
internal fun ReadableArray.toPreferenceInputs(): List<HsPreferenceInput> = (0 until size()).mapNotNull { index ->
    if (getType(index) != ReadableType.Map) return@mapNotNull null
    val map = getMap(index) ?: return@mapNotNull null
    fun type(key: String): ReadableType? = if (map.hasKey(key)) map.getType(key) else null
    HsPreferenceInput(
        category = if (type("category") == ReadableType.String) map.getString("category").orEmpty() else "",
        channel = if (type("channel") == ReadableType.String) map.getString("channel") else null,
        optedIn = type("optedIn") == ReadableType.Boolean && map.getBoolean("optedIn"),
    )
}

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

/** JS `initialize` seçenekleri → yerel `Pushizo.Options` (verilmeyenler yerel varsayılanı korur). */
internal fun ReadableMap.toOptions(): Pushizo.Options {
    val defaults = Pushizo.Options()
    fun str(key: String): String? = if (hasKey(key) && getType(key) == ReadableType.String) getString(key) else null
    fun bool(key: String): Boolean? = if (hasKey(key) && getType(key) == ReadableType.Boolean) getBoolean(key) else null
    return Pushizo.Options(
        apiUrl = str("apiUrl") ?: defaults.apiUrl,
        requiresPrivacyConsent = bool("requiresPrivacyConsent") ?: defaults.requiresPrivacyConsent,
        logLevel = str("logLevel")?.let { logLevel(it) } ?: defaults.logLevel,
        defaultChannelName = str("defaultChannelName") ?: defaults.defaultChannelName,
        defaultChannelId = str("defaultChannelId") ?: defaults.defaultChannelId,
    )
}
