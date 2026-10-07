package com.herosignal.reactnative

import android.content.ContentProvider
import android.content.ContentValues
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import com.herosignal.sdk.HeroSignal
import com.herosignal.sdk.HsLog

/**
 * Erken başlatma: uygulama manifestinde `com.herosignal.reactnative.app_id` meta-data'sı varsa (Expo config plugin
 * `appId` verildiğinde ekler) SDK, `Application.onCreate` öncesinde başlatılır. Böylece JS yüklenmeden gelen bildirim
 * tıklamaları, oturum başlangıcı ve in-app Activity takibi kaçmaz. Meta-data yoksa hiçbir şey yapmaz; JS
 * `HeroSignal.initialize` yine tek başına yeterlidir (aynı appId ile ikinci çağrı yerel SDK'da yok sayılır).
 */
class HeroSignalInitProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        val ctx = context ?: return false
        val meta = runCatching { metaData(ctx.packageManager, ctx.packageName) }.getOrNull() ?: return false
        val appId = meta.getString(META_APP_ID)?.takeIf { it.isNotBlank() } ?: return false
        val defaults = HeroSignal.Options()
        val options = HeroSignal.Options(
            apiUrl = meta.getString(META_API_URL)?.takeIf { it.isNotBlank() } ?: defaults.apiUrl,
            requiresPrivacyConsent = meta.getBoolean(META_REQUIRES_CONSENT, defaults.requiresPrivacyConsent),
            logLevel = meta.getString(META_LOG_LEVEL)?.let { logLevel(it) } ?: defaults.logLevel,
            defaultChannelName = defaults.defaultChannelName,
            defaultChannelId = defaults.defaultChannelId,
        )
        try {
            HeroSignalBridge.initialize(ctx, appId, options)
        } catch (e: RuntimeException) {
            // Erken başlatma hatası uygulamayı çökertmemeli; JS initialize yeniden dener.
            HsLog.e("HeroSignal erken başlatma başarısız", e)
        }
        return true
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
        const val META_APP_ID = "com.herosignal.reactnative.app_id"
        const val META_API_URL = "com.herosignal.reactnative.api_url"
        const val META_REQUIRES_CONSENT = "com.herosignal.reactnative.requires_privacy_consent"
        const val META_LOG_LEVEL = "com.herosignal.reactnative.log_level"
    }
}
