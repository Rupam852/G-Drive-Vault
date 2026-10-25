package com.rupam.drivevault.transfer

import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Environment
import android.os.PowerManager
import android.provider.OpenableColumns
import android.provider.Settings
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.setValue
import com.rupam.drivevault.FileTransferService
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.network.NetworkClient
import com.rupam.drivevault.repository.DriveRepository
import com.rupam.drivevault.auth.AuthManager
import com.rupam.drivevault.auth.AuthTokens
import com.rupam.drivevault.network.DriveFileDto
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import okio.*
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.Locale
import java.util.UUID

enum class TransferType {
    UPLOAD,
    DOWNLOAD
}

enum class TransferStatus {
    QUEUED,
    IN_PROGRESS,
    COMPLETED,
    FAILED,
    CANCELLED
}

data class TransferItem(
    val id: String,
    val fileName: String,
    val type: TransferType,
    val totalBytes: Long,
    val transferredBytes: Long = 0L,
    val progress: Float = 0f,
    val speedBps: Long = 0L,
    val status: TransferStatus = TransferStatus.IN_PROGRESS,
    val errorMessage: String? = null,
    val startTime: Long = System.currentTimeMillis()
) {
    val formattedSpeed: String
        get() = when {
            speedBps >= 1024 * 1024 -> String.format(Locale.US, "%.1f MB/s", speedBps.toDouble() / (1024 * 1024))
            speedBps >= 1024 -> String.format(Locale.US, "%.0f KB/s", speedBps.toDouble() / 1024)
            speedBps > 0 -> "$speedBps B/s"
            else -> "--"
        }

    val formattedProgress: String
        get() = "${(progress * 100).toInt()}%"

    val formattedTransferred: String
        get() = formatBytes(transferredBytes)

    val formattedTotal: String
        get() = formatBytes(totalBytes)

    companion object {
        fun formatBytes(bytes: Long): String {
            if (bytes <= 0) return "0 B"
            val units = arrayOf("B", "KB", "MB", "GB", "TB")
            val digitGroups = (Math.log10(bytes.toDouble()) / Math.log10(1024.0)).toInt().coerceIn(0, 4)
            val value = bytes / Math.pow(1024.0, digitGroups.toDouble())
            return String.format(Locale.US, "%.1f %s", value, units[digitGroups])
        }
    }
}

/**
 * Global singleton to orchestrate, monitor, and report live file transfers (Uploads and Downloads)
 * with exact byte counts, animated progress bars, live transfer speeds, and cancellation support.
 */
object TransferManager {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val activeJobs = java.util.concurrent.ConcurrentHashMap<String, Job>()
    private val activeCalls = java.util.concurrent.ConcurrentHashMap<String, Call>()

    // Live state list observable by Jetpack Compose
    val transfers = mutableStateListOf<TransferItem>()

    // Reactive Compose state for instant badge updates
    var activeCountState by mutableIntStateOf(0)
        private set

    val activeCount: Int
        get() = activeCountState

    private var appContext: Context? = null

    private fun recomputeActiveCount() {
        activeCountState = transfers.count { it.status == TransferStatus.IN_PROGRESS || it.status == TransferStatus.QUEUED }
        if (activeCountState == 0) {
            appContext?.let { FileTransferService.stop(it) }
        }
    }

    fun checkAndStopServiceIfNotificationsDisabled(context: Context) {
        val anyActiveCanNotify = transfers.any { item ->
            item.status == TransferStatus.IN_PROGRESS && FileTransferService.isNotificationAllowed(context, item.type == TransferType.UPLOAD)
        }
        if (!anyActiveCanNotify) {
            FileTransferService.stop(context)
        }
    }

    val totalActiveSpeedBps: Long
        get() = transfers.filter { it.status == TransferStatus.IN_PROGRESS }.sumOf { it.speedBps }

    val formattedActiveSpeed: String
        get() {
            val total = totalActiveSpeedBps
            return formatSpeed(total)
        }

    fun formatSpeed(bytesPerSec: Long): String {
        return when {
            bytesPerSec >= 1024 * 1024 -> String.format(Locale.US, "%.1f MB/s", bytesPerSec.toDouble() / (1024 * 1024))
            bytesPerSec >= 1024 -> String.format(Locale.US, "%.0f KB/s", bytesPerSec.toDouble() / 1024)
            bytesPerSec > 0 -> "$bytesPerSec B/s"
            else -> "0 B/s"
        }
    }

    fun isBatteryOptimizationIgnored(context: Context): Boolean {
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        return pm?.isIgnoringBatteryOptimizations(context.packageName) ?: false
    }

    fun requestIgnoreBatteryOptimization(context: Context) {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            try {
                val fallbackIntent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallbackIntent)
            } catch (ignored: Exception) {}
        }
    }

    /**
     * Start live streaming upload to Drive with byte progress & speed calculation
     */
    fun startUpload(
        context: Context,
        uri: Uri,
        targetFolderId: String?,
        authTokensHeader: String? = null,
        customFileName: String? = null,
        onComplete: (Boolean, String?, com.rupam.drivevault.network.DriveFileDto?) -> Unit = { _, _, _ -> }
    ): String {
        val transferId = UUID.randomUUID().toString()

        var fileName = "upload_${System.currentTimeMillis()}"
        var fileSize = 0L

        try {
            val contentResolver = context.contentResolver
            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (cursor.moveToFirst()) {
                    if (nameIndex >= 0) fileName = cursor.getString(nameIndex) ?: fileName
                    if (sizeIndex >= 0) fileSize = cursor.getLong(sizeIndex)
                }
            }
            if (fileSize <= 0) {
                context.contentResolver.openInputStream(uri)?.use {
                    fileSize = it.available().toLong()
                }
            }
        } catch (e: Exception) {
            fileSize = 0L
        }

        if (!customFileName.isNullOrBlank()) {
            fileName = customFileName.trim()
        }

        val item = TransferItem(
            id = transferId,
            fileName = fileName,
            type = TransferType.UPLOAD,
            totalBytes = fileSize,
            status = TransferStatus.IN_PROGRESS
        )
        transfers.add(0, item)
        appContext = context.applicationContext
        if (FileTransferService.isNotificationAllowed(context, true)) {
            FileTransferService.start(context, true)
        }
        recomputeActiveCount()

        val job = scope.launch {
            try {
                val contentResolver = context.contentResolver
                val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"

                var lastTime = System.currentTimeMillis()
                var lastBytes = 0L

                val requestBody = object : RequestBody() {
                    override fun contentType(): MediaType? = mimeType.toMediaTypeOrNull()

                    override fun contentLength(): Long = if (fileSize > 0) fileSize else -1

                    override fun writeTo(sink: BufferedSink) {
                        val buffer = ByteArray(64 * 1024)
                        var bytesRead: Int
                        var totalWritten = 0L

                        // Open fresh InputStream per writeTo call to avoid 'stream closed' on retries or interceptors
                        val stream = context.contentResolver.openInputStream(uri)
                            ?: throw java.io.IOException("Cannot open input stream for $fileName")

                        stream.use { input ->
                            while (input.read(buffer).also { bytesRead = it } != -1) {
                                if (activeJobs[transferId]?.isActive == false) {
                                    throw java.io.IOException("Cancelled")
                                }
                                sink.write(buffer, 0, bytesRead)
                                sink.flush()
                                totalWritten += bytesRead

                                val now = System.currentTimeMillis()
                                val timeDelta = now - lastTime
                                if (timeDelta >= 300 || (fileSize > 0 && totalWritten == fileSize)) {
                                    val bytesDelta = totalWritten - lastBytes
                                    val speed = if (timeDelta > 0) (bytesDelta * 1000) / timeDelta else 0L
                                    val progress = if (fileSize > 0) totalWritten.toFloat() / fileSize.toFloat() else 0.5f

                                    updateTransfer(transferId) { current ->
                                        current.copy(
                                            transferredBytes = totalWritten,
                                            progress = progress.coerceIn(0f, 1f),
                                            speedBps = speed
                                        )
                                    }

                                    if (FileTransferService.isNotificationAllowed(context, true)) {
                                        val percent = if (fileSize > 0) ((totalWritten * 100) / fileSize).toInt() else 0
                                        val speedText = "${formatSpeed(speed)} • $percent%"
                                        FileTransferService.updateProgress(context, "Uploading: $fileName", percent, speedText, true)
                                    }

                                    lastTime = now
                                    lastBytes = totalWritten
                                }
                            }
                        }
                    }
                }

                val actualFolder = if (targetFolderId?.startsWith("cat_") == true || targetFolderId.isNullOrBlank()) "root" else targetFolderId
                var resolvedFolderId = actualFolder

                // 1. Resolve accessToken directly from AuthManager or authTokensHeader
                val authTokens = try {
                    if (!authTokensHeader.isNullOrBlank()) {
                        com.google.gson.Gson().fromJson(authTokensHeader, AuthTokens::class.java)
                    } else {
                        AuthManager(context).getTokens()
                    }
                } catch (e: Exception) {
                    AuthManager(context).getTokens()
                }

                var accessToken = authTokens?.accessToken

                // If backend /api/drive/upload-init is available, fetch latest fresh accessToken and folderId (<200 bytes)
                try {
                    val initPayload = com.google.gson.JsonObject().apply {
                        addProperty("parentId", actualFolder)
                        addProperty("filename", fileName)
                    }
                    val initReqBuilder = Request.Builder()
                        .url("https://g-drive-vault.onrender.com/api/drive/upload-init")
                        .post(initPayload.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull()))
                    if (!authTokensHeader.isNullOrBlank()) {
                        initReqBuilder.header("x-goog-tokens", authTokensHeader)
                    }
                    val initCall = NetworkClient.okHttpClient.newCall(initReqBuilder.build())
                    val initResp = initCall.execute()
                    if (initResp.isSuccessful) {
                        val initBody = initResp.body?.string()
                        initResp.close()
                        if (!initBody.isNullOrBlank()) {
                            val jsonObj = com.google.gson.JsonParser.parseString(initBody).asJsonObject
                            val serverToken = jsonObj.get("accessToken")?.asString
                            if (!serverToken.isNullOrBlank()) {
                                accessToken = serverToken
                            }
                            val serverFolder = jsonObj.get("targetFolderId")?.asString
                            if (!serverFolder.isNullOrBlank()) {
                                resolvedFolderId = serverFolder
                            }
                        }
                    } else {
                        initResp.close()
                    }
                } catch (ignored: Exception) {
                    // If Render is suspended or network error, fallback to client-side stored accessToken
                }

                if (accessToken.isNullOrBlank()) {
                    throw Exception("Authentication token missing. Please sign in again.")
                }

                // 2. Direct-to-Google Resumable Upload Session Initiation (0 Render bandwidth!)
                val metadata = com.google.gson.JsonObject().apply {
                    addProperty("name", fileName)
                    val parentsArr = com.google.gson.JsonArray().apply { add(resolvedFolderId) }
                    add("parents", parentsArr)
                }

                val sessionReqBuilder = Request.Builder()
                    .url("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable")
                    .post(metadata.toString().toRequestBody("application/json; charset=UTF-8".toMediaTypeOrNull()))
                    .header("Authorization", "Bearer $accessToken")
                    .header("X-Upload-Content-Type", mimeType)

                if (fileSize > 0) {
                    sessionReqBuilder.header("X-Upload-Content-Length", fileSize.toString())
                }

                val sessionCall = NetworkClient.uploadOkHttpClient.newCall(sessionReqBuilder.build())
                activeCalls[transferId] = sessionCall
                val sessionResponse = try {
                    sessionCall.execute()
                } finally {
                    activeCalls.remove(transferId)
                }

                if (!sessionResponse.isSuccessful) {
                    val errCode = sessionResponse.code
                    sessionResponse.close()
                    throw Exception("Google Drive upload initialization failed: HTTP $errCode")
                }

                val uploadSessionUrl = sessionResponse.header("Location")
                sessionResponse.close()

                if (uploadSessionUrl.isNullOrBlank()) {
                    throw Exception("Google Drive did not return a resumable upload URL")
                }

                // 3. Stream binary chunks directly to Google's resumable session URL (0 Render bandwidth!)
                val uploadReqBuilder = Request.Builder()
                    .url(uploadSessionUrl)
                    .put(requestBody)

                if (fileSize > 0) {
                    uploadReqBuilder.header("Content-Length", fileSize.toString())
                    uploadReqBuilder.header("Content-Range", "bytes 0-${fileSize - 1}/$fileSize")
                }

                val uploadCall = NetworkClient.uploadOkHttpClient.newCall(uploadReqBuilder.build())
                activeCalls[transferId] = uploadCall
                val response = try {
                    uploadCall.execute()
                } finally {
                    activeCalls.remove(transferId)
                }

                if (response.isSuccessful) {
                    val rawBody = response.body?.string()
                    response.close()
                    val uploadedDto = try {
                        if (!rawBody.isNullOrBlank()) {
                            val gObj = com.google.gson.JsonParser.parseString(rawBody).asJsonObject
                            DriveFileDto(
                                id = gObj.get("id")?.asString ?: "",
                                name = gObj.get("name")?.asString ?: fileName,
                                mimeType = gObj.get("mimeType")?.asString ?: mimeType,
                                size = if (fileSize > 0) fileSize.toString() else null,
                                sizeBytes = if (fileSize > 0) fileSize else null,
                                modifiedTime = null,
                                createdTime = null,
                                thumbnailLink = null,
                                webViewLink = null,
                                starred = false,
                                shared = false,
                                isHidden = false,
                                parents = listOf(resolvedFolderId)
                            )
                        } else null
                    } catch (e: Exception) {
                        null
                    }
                    updateTransfer(transferId) { current ->
                        current.copy(
                            transferredBytes = if (fileSize > 0) fileSize else current.transferredBytes,
                            progress = 1f,
                            speedBps = 0L,
                            status = TransferStatus.COMPLETED
                        )
                    }
                    if (FileTransferService.isNotificationAllowed(context, true)) {
                        FileTransferService.showCompletion(context, "Upload Complete", "$fileName uploaded to DriveVault", true)
                    }
                    withContext(Dispatchers.Main) { onComplete(true, null, uploadedDto) }
                } else {
                    val code = response.code
                    response.close()
                    val err = "Upload failed: Google HTTP $code"
                    updateTransfer(transferId) { current ->
                        current.copy(status = TransferStatus.FAILED, errorMessage = err, speedBps = 0L)
                    }
                    withContext(Dispatchers.Main) { onComplete(false, err, null) }
                }
            } catch (e: CancellationException) {
                updateTransfer(transferId) { current ->
                    current.copy(status = TransferStatus.CANCELLED, speedBps = 0L)
                }
                withContext(Dispatchers.Main) { onComplete(false, "Cancelled", null) }
            } catch (e: Exception) {
                updateTransfer(transferId) { current ->
                    current.copy(status = TransferStatus.FAILED, errorMessage = e.message, speedBps = 0L)
                }
                withContext(Dispatchers.Main) { onComplete(false, e.message, null) }
            } finally {
                activeJobs.remove(transferId)
                recomputeActiveCount()
            }
        }

        activeJobs[transferId] = job
        return transferId
    }

    /**
     * Start live streaming download with byte progress, speed calculation, and fallback support
     */
    fun startDownload(
        context: Context,
        file: DriveFile,
        streamUrl: String,
        fallbackUrl: String? = null,
        onComplete: (Boolean, String?) -> Unit = { _, _ -> }
    ): String {
        val transferId = UUID.randomUUID().toString()

        val isFolder = file.type == com.rupam.drivevault.model.FileCategoryType.FOLDER
        val resolvedFileName = if (isFolder && !file.name.endsWith(".zip", ignoreCase = true)) {
            "${file.name}.zip"
        } else {
            file.name
        }

        val item = TransferItem(
            id = transferId,
            fileName = resolvedFileName,
            type = TransferType.DOWNLOAD,
            totalBytes = file.sizeBytes,
            status = TransferStatus.IN_PROGRESS
        )
        transfers.add(0, item)
        appContext = context.applicationContext
        if (FileTransferService.isNotificationAllowed(context, false)) {
            FileTransferService.start(context, false)
        }
        recomputeActiveCount()

        val job = scope.launch {
            try {
                val client = NetworkClient.uploadOkHttpClient

                var currentUrl = streamUrl
                val reqBuilder = Request.Builder().url(currentUrl).get()
                if (currentUrl.contains("googleapis.com")) {
                    val token = AuthManager(context).getTokens()?.accessToken
                    if (!token.isNullOrBlank()) {
                        reqBuilder.header("Authorization", "Bearer $token")
                    }
                }
                var request = reqBuilder.build()
                var call = client.newCall(request)
                activeCalls[transferId] = call
                var response = call.execute()

                // If primary URL failed (e.g. Cloudflare Worker 401 expired token) and fallbackUrl exists, retry seamlessly
                if (!response.isSuccessful && !fallbackUrl.isNullOrBlank() && currentUrl != fallbackUrl) {
                    response.close()
                    currentUrl = fallbackUrl
                    val fallbackReq = Request.Builder().url(currentUrl).get()
                    if (currentUrl.contains("googleapis.com")) {
                        val token = AuthManager(context).getTokens()?.accessToken
                        if (!token.isNullOrBlank()) {
                            fallbackReq.header("Authorization", "Bearer $token")
                        }
                    }
                    request = fallbackReq.build()
                    call = client.newCall(request)
                    activeCalls[transferId] = call
                    response = call.execute()
                }

                if (!response.isSuccessful) {
                    val code = response.code
                    response.close()
                    throw Exception("Download error: HTTP $code")
                }

                val body = response.body ?: throw Exception("Empty response body")
                val totalLength = if (body.contentLength() > 0) body.contentLength() else file.sizeBytes

                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) downloadsDir.mkdirs()

                var targetFile = File(downloadsDir, resolvedFileName)
                var count = 1
                while (targetFile.exists()) {
                    val baseName = resolvedFileName.substringBeforeLast(".")
                    val extension = if (resolvedFileName.contains(".")) ".${resolvedFileName.substringAfterLast(".")}" else ""
                    targetFile = File(downloadsDir, "$baseName ($count)$extension")
                    count++
                }

                val inputStream = body.byteStream()
                val outputStream = FileOutputStream(targetFile)

                val buffer = ByteArray(64 * 1024)
                var bytesRead: Int
                var totalDownloaded = 0L
                var lastTime = System.currentTimeMillis()
                var lastBytes = 0L

                inputStream.use { input ->
                    outputStream.use { output ->
                        while (input.read(buffer).also { bytesRead = it } != -1) {
                            if (activeJobs[transferId]?.isActive == false) {
                                throw CancellationException("Cancelled")
                            }
                            output.write(buffer, 0, bytesRead)
                            totalDownloaded += bytesRead

                            val now = System.currentTimeMillis()
                            val timeDelta = now - lastTime
                            if (timeDelta >= 300 || (totalLength > 0 && totalDownloaded == totalLength)) {
                                val bytesDelta = totalDownloaded - lastBytes
                                val speed = if (timeDelta > 0) (bytesDelta * 1000) / timeDelta else 0L
                                val progress = if (totalLength > 0) totalDownloaded.toFloat() / totalLength.toFloat() else 0.5f

                                updateTransfer(transferId) { current ->
                                    current.copy(
                                        totalBytes = totalLength,
                                        transferredBytes = totalDownloaded,
                                        progress = progress.coerceIn(0f, 1f),
                                        speedBps = speed
                                    )
                                }

                                if (FileTransferService.isNotificationAllowed(context, false)) {
                                    val percent = if (totalLength > 0) ((totalDownloaded * 100) / totalLength).toInt() else 0
                                    val speedText = "${formatSpeed(speed)} • $percent%"
                                    FileTransferService.updateProgress(context, "Downloading: $resolvedFileName", percent, speedText, false)
                                }

                                lastTime = now
                                lastBytes = totalDownloaded
                            }
                        }
                        output.flush()
                    }
                }

                // Notify Android Media Scanner so file immediately shows in Gallery / Files
                val mediaMime = if (isFolder) "application/zip" else (file.mimeType ?: "*/*")
                MediaScannerConnection.scanFile(
                    context,
                    arrayOf(targetFile.absolutePath),
                    arrayOf(mediaMime),
                    null
                )

                updateTransfer(transferId) { current ->
                    current.copy(
                        transferredBytes = totalDownloaded,
                        progress = 1f,
                        speedBps = 0L,
                        status = TransferStatus.COMPLETED
                    )
                }
                if (FileTransferService.isNotificationAllowed(context, false)) {
                    FileTransferService.showCompletion(context, "Download Complete", "$resolvedFileName saved to Downloads", false)
                }
                withContext(Dispatchers.Main) { onComplete(true, null) }
            } catch (e: CancellationException) {
                updateTransfer(transferId) { current ->
                    current.copy(status = TransferStatus.CANCELLED, speedBps = 0L)
                }
                withContext(Dispatchers.Main) { onComplete(false, "Cancelled") }
            } catch (e: Exception) {
                updateTransfer(transferId) { current ->
                    current.copy(status = TransferStatus.FAILED, errorMessage = e.message, speedBps = 0L)
                }
                withContext(Dispatchers.Main) { onComplete(false, e.message) }
            } finally {
                activeCalls.remove(transferId)
                activeJobs.remove(transferId)
                recomputeActiveCount()
            }
        }

        activeJobs[transferId] = job
        return transferId
    }

    fun cancelTransfer(id: String) {
        try {
            activeCalls[id]?.cancel()
            activeCalls.remove(id)
        } catch (ignored: Exception) {}

        try {
            activeJobs[id]?.cancel()
            activeJobs.remove(id)
        } catch (ignored: Exception) {}

        updateTransfer(id) { it.copy(status = TransferStatus.CANCELLED, speedBps = 0L) }
        recomputeActiveCount()
    }

    fun clearCompleted() {
        transfers.removeAll { it.status == TransferStatus.COMPLETED || it.status == TransferStatus.CANCELLED || it.status == TransferStatus.FAILED }
        recomputeActiveCount()
    }

    private fun updateTransfer(id: String, update: (TransferItem) -> TransferItem) {
        try {
            val index = transfers.indexOfFirst { it.id == id }
            if (index != -1) {
                transfers[index] = update(transfers[index])
            }
        } catch (ignored: Exception) {}
    }
}
