package com.rupam.drivevault.auth

import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope

object GoogleAuthHelper {
    // Exact Web Client ID configured for DriveVault OAuth exchange
    const val WEB_CLIENT_ID = "443871816940-j8ifmrgsd4f0s1to4bttjm3uh93ujl2l.apps.googleusercontent.com"

    private fun getSignInOptions(): GoogleSignInOptions {
        return GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestServerAuthCode(WEB_CLIENT_ID)
            .requestEmail()
            .requestProfile()
            .requestScopes(
                Scope("https://www.googleapis.com/auth/drive"),
                Scope("https://www.googleapis.com/auth/userinfo.email"),
                Scope("https://www.googleapis.com/auth/userinfo.profile")
            )
            .build()
    }

    fun getClient(context: Context): GoogleSignInClient {
        return GoogleSignIn.getClient(context, getSignInOptions())
    }

    fun getSignInIntent(context: Context): Intent {
        return getClient(context).signInIntent
    }

    fun parseAuthResult(intent: Intent?): Result<String> {
        if (intent == null) return Result.failure(Exception("No result returned from Google"))
        return try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(intent)
            val account = task.getResult(ApiException::class.java)
            val code = account.serverAuthCode
            if (!code.isNullOrBlank()) {
                Result.success(code)
            } else {
                Result.failure(Exception("Google Sign-In succeeded but serverAuthCode was empty. Verify Web Client ID."))
            }
        } catch (e: ApiException) {
            val msg = when (e.statusCode) {
                10 -> "Developer Error (code 10): SHA-1 signature mismatch in Google Cloud Console. Register SHA-1: A6:44:9D:F7:5B:8C:EC:AC:A0:6C:9A:C6:87:17:08:7C:E6:4D:E8:F8 for package com.rupam.drivevault"
                12500 -> "Sign in failed (code 12500): Check Google Play Services and OAuth configuration."
                12501 -> "Sign in cancelled by user."
                else -> "Google Sign-In error (code ${e.statusCode}): ${e.message}"
            }
            Result.failure(Exception(msg, e))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun signOut(context: Context, onComplete: () -> Unit = {}) {
        getClient(context).signOut().addOnCompleteListener {
            onComplete()
        }
    }

    fun switchAccount(context: Context, onComplete: () -> Unit = {}) {
        val client = getClient(context)
        client.signOut().addOnCompleteListener {
            client.revokeAccess().addOnCompleteListener {
                onComplete()
            }
        }
    }
}
