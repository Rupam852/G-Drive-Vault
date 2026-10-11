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
    }

    fun saveSession(user: AuthUser, tokens: AuthTokens) {
        prefs.edit()
            .putString(KEY_USER, gson.toJson(user))
            .putString(KEY_TOKENS, gson.toJson(tokens))
            .putBoolean(KEY_IS_LOGGED_IN, true)
            .apply()
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
