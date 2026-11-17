package com.pushizo.reactnative

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.pushizo.sdk.Pushizo
import com.pushizo.sdk.HsInAppAction
import com.pushizo.sdk.HsInAppBlock
import com.pushizo.sdk.HsInAppCarouselCard
import com.pushizo.sdk.HsInAppDisplay
import com.pushizo.sdk.HsInAppMessage
import com.pushizo.sdk.HsInAppTrigger
import com.pushizo.sdk.HsContentCard
import com.pushizo.sdk.HsContentCardFeed
import com.pushizo.sdk.HsDeliveryStatus
import com.pushizo.sdk.HsInboxItem
import com.pushizo.sdk.HsInboxPage
import com.pushizo.sdk.HsLog
import com.pushizo.sdk.HsMessageCategory
import com.pushizo.sdk.HsNotification
import com.pushizo.sdk.HsPreference
import com.pushizo.sdk.HsPreferenceInput
import com.pushizo.sdk.HsPreferencesResult
import com.pushizo.sdk.HsPushSubscriptionState
import org.json.JSONArray
import org.json.JSONObject

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

/** Teslim durumu (ADR-0092); enum değerleri küçük harfle (`risk`: none/elevated/high, ayarlar: `auto_start` …). */
internal fun HsDeliveryStatus.toMap(): Map<String, Any?> = mapOf(
    "supported" to true,
    "manufacturer" to manufacturer,
    "brand" to brand,
    "vendor" to vendor.id,
    "aggressiveVendor" to vendor.aggressive,
    "rom" to rom,
    "romVersion" to romVersion,
    "notificationsEnabled" to notificationsEnabled,
    "channelBlocked" to channelBlocked,
    "batteryOptimizationExempt" to batteryOptimizationExempt,
    "backgroundRestricted" to backgroundRestricted,
    "standbyBucket" to standbyBucket?.id,
    "powerSaveMode" to powerSaveMode,
    "dataSaverEnabled" to dataSaverEnabled,
    "restricted" to restricted,
    "risk" to risk.name.lowercase(),
    "recommendedSettings" to recommendedSettings.map { it.name.lowercase() },
)

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

internal fun HsContentCard.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "messageId" to messageId,
    "type" to type.wire,
    "title" to title,
    "body" to body,
    "url" to url,
    "imageUrl" to imageUrl,
    "buttonText" to buttonText,
    "data" to data,
    "pinned" to pinned,
    "priority" to priority,
    "viewed" to viewed,
    "clicked" to clicked,
    "expiresAt" to expiresAt,
    "createdAt" to createdAt,
)

internal fun HsContentCardFeed.toMap(): Map<String, Any?> = mapOf("cards" to cards.map { it.toMap() }, "unviewedCount" to unviewedCount)

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

/** `org.json` değeri → köprüye yazılabilir değer (Map, List, metin, sayı, mantıksal); `JSONObject.NULL` null olur. */
internal fun Any?.toBridgeValue(): Any? = when (this) {
    null, JSONObject.NULL -> null
    is JSONObject -> keys().asSequence().associateWith { opt(it).toBridgeValue() }
    is JSONArray -> (0 until length()).map { opt(it).toBridgeValue() }
    is Boolean, is String, is Int, is Double -> this
    is Number -> toDouble()
    else -> toString()
}

internal fun HsInAppTrigger.toMap(): Map<String, Any?> = when (this) {
    is HsInAppTrigger.SessionStart -> mapOf("kind" to "session_start")
    is HsInAppTrigger.SessionDuration -> mapOf("kind" to "session_duration", "seconds" to seconds)
    is HsInAppTrigger.Event -> mapOf("kind" to "event", "name" to name)
    is HsInAppTrigger.Screen -> mapOf("kind" to "screen", "name" to name)
    is HsInAppTrigger.Condition -> mapOf("kind" to "trigger", "key" to key, "op" to op, "value" to value.toBridgeValue())
    is HsInAppTrigger.Unsupported -> mapOf("kind" to "unsupported", "name" to kind)
}

internal fun HsInAppAction.toMap(): Map<String, Any?> = when (this) {
    is HsInAppAction.Dismiss -> mapOf("type" to "dismiss")
    is HsInAppAction.Url -> mapOf("type" to "url", "url" to url)
    is HsInAppAction.Deeplink -> mapOf("type" to "deeplink", "url" to url)
    is HsInAppAction.Tags -> mapOf("type" to "tags", "tags" to tags)
    is HsInAppAction.PushPrompt -> mapOf("type" to "push_prompt")
    is HsInAppAction.Outcome -> mapOf("type" to "outcome", "name" to name, "value" to value)
}

/** Düğme alanları; blok olarak yazılırken `type` eklenir (carousel kart düğmesinde yoktur). */
private fun HsInAppBlock.Button.toButtonMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "text" to text,
    "action" to action.toMap(),
    "backgroundColor" to backgroundColor,
    "textColor" to textColor,
)

internal fun HsInAppCarouselCard.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "title" to title,
    "body" to body,
    "imageUrl" to imageUrl,
    "imageAlt" to imageAlt,
    "button" to button?.toButtonMap(),
)

internal fun HsInAppBlock.toMap(): Map<String, Any?> = when (this) {
    is HsInAppBlock.Image -> mapOf("type" to "image", "url" to url, "alt" to alt)
    is HsInAppBlock.Title -> mapOf("type" to "title", "text" to text)
    is HsInAppBlock.Body -> mapOf("type" to "body", "text" to text)
    is HsInAppBlock.Button -> mapOf("type" to "button") + toButtonMap()
    is HsInAppBlock.Carousel -> mapOf("type" to "carousel", "id" to id, "cards" to cards.map { it.toMap() })
}

internal fun HsInAppDisplay.toMap(): Map<String, Any?> = mapOf(
    "layout" to layout.wire,
    "backgroundColor" to backgroundColor,
    "textColor" to textColor,
    "dismissible" to dismissible,
    "autoDismissSeconds" to autoDismissSeconds,
    "contentType" to contentType.wire,
    "html" to html,
    "htmlHeight" to htmlHeight,
    "blocks" to blocks.map { it.toMap() },
)

/** Gömülü yerleşim mesajı (TS `InAppMessage`); `raw` sunucudaki ham JSON'dur. */
internal fun HsInAppMessage.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "priority" to priority,
    "triggers" to triggers.map { it.toMap() },
    "triggerGroups" to triggerGroups.map { group -> group.map { it.toMap() } },
    "variantId" to variantId,
    "display" to display.toMap(),
    "remainingImpressions" to remainingImpressions,
    "minIntervalSeconds" to minIntervalSeconds,
    "stopAfterInteraction" to stopAfterInteraction,
    "lastImpressionAt" to lastImpressionAt,
    "endAt" to endAt,
    "language" to language,
    "raw" to JSONObject(toJson()).toBridgeValue(),
)

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
