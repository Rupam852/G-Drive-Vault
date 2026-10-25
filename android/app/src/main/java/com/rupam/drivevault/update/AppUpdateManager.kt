package com.rupam.drivevault.update

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.widget.Toast
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.rupam.drivevault.MainActivity
import com.rupam.drivevault.R
import com.rupam.drivevault.auth.AuthManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

data class AppUpdateInfo(
    @SerializedName("status") val status: String = "",
    @SerializedName("version") val version: String = "",
    @SerializedName("description") val description: String = "",
    @SerializedName("file_name") val fileName: String? = null,
    @SerializedName("file_size") val fileSize: Long? = null,
    @SerializedName("download_url") val downloadUrl: String? = null,
    @SerializedName("web_url") val webUrl: String? = null
)

object AppUpdateManager {
    const val PRIMARY_API_URL = "https://api.neofilestransfer.site/api/version/apk_hlszs2p1724nsuo"
    const val FALLBACK_API_URL = "https://g-drive-vault-api.onrender.com/api/app/version"

    const val CHANNEL_ID = "drive_vault_app_updates"
    const val UPDATE_NOTIF_ID = 8888

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO)

    var isChecking by mutableStateOf(false)
        private set

    var isUpdateAvailable by mutableStateOf(false)
        private set

    var updateInfo by mutableStateOf<AppUpdateInfo?>(null)
        private set

    var lastCheckedTime by mutableLongStateOf(0L)
        private set

    var checkError by mutableStateOf<String?>(null)
        private set

    private var lastNotifiedVersion: String? = null

    fun getInstalledVersion(context: Context): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            val name = pInfo.versionName ?: "1.0.1"
            if (name.startsWith("v", ignoreCase = true)) name else "v$name"
        } catch (e: Exception) {
            "v1.0.1"
        }
    }

    fun isNewerVersion(currentVersion: String, remoteVersion: String): Boolean {
        try {
            val cleanCurrent = currentVersion.trim().removePrefix("v").removePrefix("V")
            val cleanRemote = remoteVersion.trim().removePrefix("v").removePrefix("V")

            val currentParts = cleanCurrent.split(".").mapNotNull { it.toIntOrNull() }
            val remoteParts = cleanRemote.split(".").mapNotNull { it.toIntOrNull() }

            val maxLen = maxOf(currentParts.size, remoteParts.size)
            for (i in 0 until maxLen) {
                val curr = currentParts.getOrElse(i) { 0 }
                val rem = remoteParts.getOrElse(i) { 0 }
                if (rem > curr) return true
                if (rem < curr) return false
            }
            return false
        } catch (e: Exception) {
            return false
        }
    }

    private fun ensureNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            if (nm != null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "App Updates",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Notifications when a new version of Drive Vault is available"
                    enableLights(true)
                    enableVibration(true)
                }
                nm.createNotificationChannel(channel)
            }
        }
    }

    fun showUpdateNotification(
        context: Context,
        version: String,
        description: String,
        isTest: Boolean = false
    ) {
        try {
            val authManager = AuthManager(context)
            if (!isTest) {
                if (!authManager.isMasterNotificationEnabled() || !authManager.isUpdateNotificationEnabled()) {
                    return
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val hasPermission = ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
                if (!hasPermission) return
            }

            ensureNotificationChannel(context)

            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("EXTRA_OPEN_UPDATER", true)
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                UPDATE_NOTIF_ID,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val cleanDesc = description.ifBlank { "A new version of Drive Vault is ready. Tap to view and install update." }

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_drivevault)
                .setContentTitle(if (isTest) "🔔 Test Update Alert: Drive Vault $version" else "🚀 Drive Vault $version Update Available!")
                .setContentText(cleanDesc)
                .setStyle(NotificationCompat.BigTextStyle().bigText(cleanDesc))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .addAction(
                    android.R.drawable.stat_sys_download_done,
                    "Update Now",
                    pendingIntent
                )

            try {
                val largeIcon = BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)
                if (largeIcon != null) {
                    builder.setLargeIcon(largeIcon)
                }
            } catch (_: Exception) {}

            nm.notify(UPDATE_NOTIF_ID, builder.build())
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun sendTestNotification(context: Context) {
        val installed = getInstalledVersion(context)
        showUpdateNotification(
            context = context,
            version = "$installed (Preview)",
            description = "Drive Vault notifications are configured and working! You will receive an alert here whenever a new update is released.",
            isTest = true
        )
    }

    fun checkForUpdates(
        context: Context,
        isManual: Boolean = false,
        onComplete: ((Boolean) -> Unit)? = null
    ) {
        if (isChecking) return
        isChecking = true
        checkError = null

        scope.launch {
            var parsedResult: AppUpdateInfo? = null

            // Try primary endpoint first
            try {
                val req = Request.Builder()
                    .url(PRIMARY_API_URL)
                    .header("Accept", "application/json")
                    .get()
                    .build()
                val resp = httpClient.newCall(req).execute()
                if (resp.isSuccessful) {
                    val body = resp.body?.string()
                    if (!body.isNullOrBlank()) {
                        parsedResult = gson.fromJson(body, AppUpdateInfo::class.java)
                    }
                }
                resp.close()
            } catch (_: Exception) {
                // Ignore and try fallback
            }

            // Fallback to our own server if primary failed
            if (parsedResult == null || parsedResult.version.isBlank()) {
                try {
                    val req = Request.Builder()
                        .url(FALLBACK_API_URL)
                        .header("Accept", "application/json")
                        .get()
                        .build()
                    val resp = httpClient.newCall(req).execute()
                    if (resp.isSuccessful) {
                        val body = resp.body?.string()
                        if (!body.isNullOrBlank()) {
                            parsedResult = gson.fromJson(body, AppUpdateInfo::class.java)
                        }
                    }
                    resp.close()
                } catch (_: Exception) {}
            }

            withContext(Dispatchers.Main) {
                isChecking = false
                lastCheckedTime = System.currentTimeMillis()

                if (parsedResult != null && parsedResult.version.isNotBlank()) {
                    val installed = getInstalledVersion(context)
                    val updateAvailable = isNewerVersion(installed, parsedResult.version)

                    updateInfo = parsedResult
                    isUpdateAvailable = updateAvailable

                    if (updateAvailable) {
                        // Send system notification to the phone!
                        if (lastNotifiedVersion != parsedResult.version) {
                            showUpdateNotification(context, parsedResult.version, parsedResult.description)
                            lastNotifiedVersion = parsedResult.version
                        }

                        if (isManual) {
                            Toast.makeText(context, "New update ${parsedResult.version} available!", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        if (isManual) {
                            Toast.makeText(context, "Your app is up to date ($installed)", Toast.LENGTH_SHORT).show()
                        }
                    }
                    onComplete?.invoke(updateAvailable)
                } else {
                    checkError = "Could not reach update server"
                    if (isManual) {
                        Toast.makeText(context, "Could not check for updates right now", Toast.LENGTH_SHORT).show()
                    }
                    onComplete?.invoke(false)
                }
            }
        }
    }

    fun openDownloadUrl(context: Context) {
        val url = updateInfo?.webUrl?.takeIf { it.isNotBlank() } ?: updateInfo?.downloadUrl
        if (!url.isNullOrBlank()) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                context.startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(context, "Could not open download link: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(context, "Download link not available", Toast.LENGTH_SHORT).show()
        }
    }
}
