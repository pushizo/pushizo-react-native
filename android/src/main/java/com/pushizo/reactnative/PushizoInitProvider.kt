package com.pushizo.reactnative

import android.content.ContentProvider
import android.content.ContentValues
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import com.pushizo.sdk.Pushizo
import com.pushizo.sdk.HsLog

/**
 * Erken başlatma: uygulama manifestinde `com.pushizo.reactnative.app_id` meta-data'sı varsa (Expo config plugin
 * `appId` verildiğinde ekler) SDK, `Application.onCreate` öncesinde başlatılır. Böylece JS yüklenmeden gelen bildirim
 * tıklamaları, oturum başlangıcı ve in-app Activity takibi kaçmaz. Meta-data yoksa hiçbir şey yapmaz; JS
 * `Pushizo.initialize` yine tek başına yeterlidir (aynı appId ile ikinci çağrı yerel SDK'da yok sayılır).
 */
class PushizoInitProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        val ctx = context ?: return false
        val meta = runCatching { metaData(ctx.packageManager, ctx.packageName) }.getOrNull() ?: return false
        val appId = meta.getString(META_APP_ID)?.takeIf { it.isNotBlank() } ?: return false
        val defaults = Pushizo.Options()
        val options = Pushizo.Options(
            apiUrl = text(meta, META_API_URL) ?: defaults.apiUrl,
            // Onay bayrağı SDK başlamadan uygulanmalı; aksi halde JS `initialize` gelene kadar onaysız ağ isteği yapılabilir.
            requiresPrivacyConsent = flag(meta, META_REQUIRES_CONSENT) ?: defaults.requiresPrivacyConsent,
            logLevel = text(meta, META_LOG_LEVEL)?.let { logLevel(it) } ?: defaults.logLevel,
            defaultChannelName = text(meta, META_CHANNEL_NAME) ?: defaults.defaultChannelName,
            defaultChannelId = text(meta, META_CHANNEL_ID) ?: defaults.defaultChannelId,
        )
        try {
            PushizoBridge.initialize(ctx, appId, options)
        } catch (e: RuntimeException) {
            // Erken başlatma hatası uygulamayı çökertmemeli; JS initialize yeniden dener.
            HsLog.e("Pushizo erken başlatma başarısız", e)
        }
        return true
    }

    // Manifest meta-data değerleri tipli ayrıştırılır ("123" → Int, "true" → Boolean); hepsi metin olarak okunur.
    @Suppress("DEPRECATION")
    private fun text(meta: Bundle, key: String): String? = meta.get(key)?.toString()?.takeIf { it.isNotBlank() }

    @Suppress("DEPRECATION")
    private fun flag(meta: Bundle, key: String): Boolean? = when (val value = meta.get(key)) {
        is Boolean -> value
        is String -> value.trim().equals("true", ignoreCase = true)
        else -> null
    }

    @Suppress("DEPRECATION")
    private fun metaData(pm: PackageManager, packageName: String): Bundle? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pm.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(PackageManager.GET_META_DATA.toLong())).metaData
        } else {
            pm.getApplicationInfo(packageName, PackageManager.GET_META_DATA).metaData
        }

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0

    companion object {
        const val META_APP_ID = "com.pushizo.reactnative.app_id"
        const val META_API_URL = "com.pushizo.reactnative.api_url"
        const val META_REQUIRES_CONSENT = "com.pushizo.reactnative.requires_privacy_consent"
        const val META_LOG_LEVEL = "com.pushizo.reactnative.log_level"
        const val META_CHANNEL_ID = "com.pushizo.reactnative.default_channel_id"
        const val META_CHANNEL_NAME = "com.pushizo.reactnative.default_channel_name"
    }
}
