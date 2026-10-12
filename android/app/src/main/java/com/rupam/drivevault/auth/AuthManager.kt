package com.rupam.drivevault.auth

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson

import com.google.gson.annotations.SerializedName

data class AuthUser(
    val id: String,
    val name: String,
    val email: String,
    val picture: String? = null
)

data class AuthTokens(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("refresh_token") val refreshToken: String? = null,
    @SerializedName("expiry_date") val expiryDate: Long = 0L,
    @SerializedName("scope") val scope: String? = null,
    @SerializedName("token_type") val tokenType: String? = null,
    @SerializedName("id_token") val idToken: String? = null
)

class AuthManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("drive_vault_auth", Context.MODE_PRIVATE)
    private val gson = Gson()

    companion object {
        private const val KEY_USER = "key_user"
        private const val KEY_TOKENS = "key_tokens"
        private const val KEY_IS_LOGGED_IN = "key_is_logged_in"
        private const val KEY_BIOMETRIC_ENABLED = "key_biometric_enabled"
        private const val KEY_HIGH_QUALITY_STREAMING = "key_high_quality_streaming"
        private const val KEY_NOTIF_MASTER_ENABLED = "key_notif_master_enabled"
        private const val KEY_NOTIF_UPLOAD_ENABLED = "key_notif_upload_enabled"
        private const val KEY_NOTIF_DOWNLOAD_ENABLED = "key_notif_download_enabled"
        private const val KEY_BACKGROUND_SPEED_BOOST = "key_background_speed_boost"
        private const val KEY_AUTO_CHECK_UPDATE = "key_auto_check_update"
        private const val KEY_NOTIF_UPDATE_ENABLED = "key_notif_update_enabled"
    }

    fun isUpdateNotificationEnabled(): Boolean {
        return prefs.getBoolean(KEY_NOTIF_UPDATE_ENABLED, true)
    }

    fun setUpdateNotificationEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_NOTIF_UPDATE_ENABLED, enabled).apply()
    }

    fun isBackgroundSpeedBoostEnabled(): Boolean {
        return prefs.getBoolean(KEY_BACKGROUND_SPEED_BOOST, true)
    }

    fun setBackgroundSpeedBoostEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_BACKGROUND_SPEED_BOOST, enabled).apply()
    }

    fun isMasterNotificationEnabled(): Boolean {
        return prefs.getBoolean(KEY_NOTIF_MASTER_ENABLED, true)
    }

    fun setMasterNotificationEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_NOTIF_MASTER_ENABLED, enabled).apply()
    }

    fun isUploadNotificationEnabled(): Boolean {
        return prefs.getBoolean(KEY_NOTIF_UPLOAD_ENABLED, true)
    }

    fun setUploadNotificationEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_NOTIF_UPLOAD_ENABLED, enabled).apply()
    }

    fun isDownloadNotificationEnabled(): Boolean {
        return prefs.getBoolean(KEY_NOTIF_DOWNLOAD_ENABLED, true)
    }

    fun setDownloadNotificationEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_NOTIF_DOWNLOAD_ENABLED, enabled).apply()
    }

    fun isHighQualityStreaming(): Boolean {
        return prefs.getBoolean(KEY_HIGH_QUALITY_STREAMING, true)
    }

    fun setHighQualityStreaming(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_HIGH_QUALITY_STREAMING, enabled).apply()
    }

    fun isBiometricEnabled(): Boolean {
        return prefs.getBoolean(KEY_BIOMETRIC_ENABLED, false)
    }

    fun setBiometricEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_BIOMETRIC_ENABLED, enabled).apply()
    }

    fun isAutoCheckUpdateEnabled(): Boolean {
        return prefs.getBoolean(KEY_AUTO_CHECK_UPDATE, true)
    }

    fun setAutoCheckUpdateEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_AUTO_CHECK_UPDATE, enabled).apply()
    }

    fun saveSession(user: AuthUser, tokens: AuthTokens) {
        prefs.edit()
            .putString(KEY_USER, gson.toJson(user))
            .putString(KEY_TOKENS, gson.toJson(tokens))
            .putBoolean(KEY_IS_LOGGED_IN, true)
            .apply()
    }

    fun updateTokens(newTokens: AuthTokens) {
        val current = getTokens()
        val merged = if (current != null) {
            current.copy(
                accessToken = if (newTokens.accessToken.isNotBlank()) newTokens.accessToken else current.accessToken,
                refreshToken = if (!newTokens.refreshToken.isNullOrBlank()) newTokens.refreshToken else current.refreshToken,
                expiryDate = if (newTokens.expiryDate > 0) newTokens.expiryDate else current.expiryDate
            )
        } else {
            newTokens
        }
        prefs.edit().putString(KEY_TOKENS, gson.toJson(merged)).apply()
    }


    fun getUser(): AuthUser? {
        val json = prefs.getString(KEY_USER, null) ?: return null
        return try {
            gson.fromJson(json, AuthUser::class.java)
        } catch (e: Exception) {
            null
        }
    }

    fun getTokens(): AuthTokens? {
        val json = prefs.getString(KEY_TOKENS, null) ?: return null
        return try {
            gson.fromJson(json, AuthTokens::class.java)
        } catch (e: Exception) {
            null
        }
    }

    fun getAuthorizationHeader(): String? {
        val tokens = getTokens() ?: return null
        return "Bearer ${tokens.accessToken}"
    }

    fun getTokensHeader(): String? {
        val tokens = getTokens() ?: return null
        return gson.toJson(tokens)
    }

    fun isLoggedIn(): Boolean {
        return prefs.getBoolean(KEY_IS_LOGGED_IN, false) && getUser() != null
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }
}
