package com.rupam.drivevault.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
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
    @SerializedName("download_url") val downloadUrl: String? = null
)

object AppUpdateManager {
    const val UPDATE_API_URL = "https://api.neofilestransfer.site/api/version/apk_hlszs2p1724nsuo"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
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

    fun checkForUpdates(
        context: Context,
        isManual: Boolean = false,
        onComplete: ((Boolean) -> Unit)? = null
    ) {
        if (isChecking) return
        isChecking = true
        checkError = null

        scope.launch {
            try {
                val request = Request.Builder()
                    .url(UPDATE_API_URL)
                    .header("Accept", "application/json")
                    .get()
                    .build()

                val response = httpClient.newCall(request).execute()
                if (!response.isSuccessful) {
                    val code = response.code
                    response.close()
                    throw Exception("HTTP $code")
                }

                val bodyStr = response.body?.string() ?: throw Exception("Empty response")
                val parsed = gson.fromJson(bodyStr, AppUpdateInfo::class.java)

                val installed = getInstalledVersion(context)
                val updateAvailable = isNewerVersion(installed, parsed.version)

                withContext(Dispatchers.Main) {
                    updateInfo = parsed
                    isUpdateAvailable = updateAvailable
                    lastCheckedTime = System.currentTimeMillis()
                    isChecking = false

                    if (isManual) {
                        if (updateAvailable) {
                            Toast.makeText(context, "New update ${parsed.version} available!", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(context, "Your app is up to date ($installed)", Toast.LENGTH_SHORT).show()
                        }
                    }
                    onComplete?.invoke(updateAvailable)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    checkError = e.message ?: "Failed to check for updates"
                    isChecking = false
                    if (isManual) {
                        Toast.makeText(context, "Update check failed: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                    onComplete?.invoke(false)
                }
            }
        }
    }

    fun openDownloadUrl(context: Context) {
        val url = updateInfo?.downloadUrl
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
