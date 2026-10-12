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
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
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
        FileTransferService.start(context)
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

                                    val percent = if (fileSize > 0) ((totalWritten * 100) / fileSize).toInt() else 0
                                    val speedText = "${formatSpeed(speed)} • $percent%"
                                    FileTransferService.updateProgress(context, "Uploading: $fileName", percent, speedText, true)

                                    lastTime = now
                                    lastBytes = totalWritten
                                }
                            }
                        }
                    }
                }

                val actualFolder = if (targetFolderId?.startsWith("cat_") == true) "root" else (targetFolderId ?: "root")

                val multipart = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("file", fileName, requestBody)
                    .addFormDataPart("parentId", actualFolder)
                    .addFormDataPart("relativePath", "")
                    .build()

                val reqBuilder = Request.Builder()
                    .url("https://g-drive-vault.onrender.com/api/drive/upload")
                    .post(multipart)
                if (!authTokensHeader.isNullOrBlank()) {
                    reqBuilder.header("x-goog-tokens", authTokensHeader)
                }
                val request = reqBuilder.build()

                val client = NetworkClient.uploadOkHttpClient
                val call = client.newCall(request)
                activeCalls[transferId] = call
                val response = try {
                    call.execute()
                } finally {
                    activeCalls.remove(transferId)
                }

                if (response.isSuccessful) {
                    val rawBody = response.body?.string()
                    response.close()
                    val uploadedDto = try {
                        if (!rawBody.isNullOrBlank()) {
                            com.google.gson.Gson().fromJson(rawBody, com.rupam.drivevault.network.DriveFileDto::class.java)
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
                    FileTransferService.showCompletion(context, "Upload Complete", "$fileName uploaded to DriveVault", true)
                    withContext(Dispatchers.Main) { onComplete(true, null, uploadedDto) }
                } else {
                    val code = response.code
                    response.close()
                    val err = "Upload failed: HTTP $code"
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

        val item = TransferItem(
            id = transferId,
            fileName = file.name,
            type = TransferType.DOWNLOAD,
            totalBytes = file.sizeBytes,
            status = TransferStatus.IN_PROGRESS
        )
        transfers.add(0, item)
        appContext = context.applicationContext
        FileTransferService.start(context)
        recomputeActiveCount()

        val job = scope.launch {
            try {
                val client = NetworkClient.uploadOkHttpClient

                var currentUrl = streamUrl
                var request = Request.Builder().url(currentUrl).get().build()
                var call = client.newCall(request)
                activeCalls[transferId] = call
                var response = call.execute()

                // If primary URL failed (e.g. Cloudflare Worker 401 expired token) and fallbackUrl exists, retry seamlessly
                if (!response.isSuccessful && !fallbackUrl.isNullOrBlank() && currentUrl != fallbackUrl) {
                    response.close()
                    currentUrl = fallbackUrl
                    request = Request.Builder().url(currentUrl).get().build()
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

                var targetFile = File(downloadsDir, file.name)
                var count = 1
                while (targetFile.exists()) {
                    val baseName = file.name.substringBeforeLast(".")
                    val extension = if (file.name.contains(".")) ".${file.name.substringAfterLast(".")}" else ""
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

                                val percent = if (totalLength > 0) ((totalDownloaded * 100) / totalLength).toInt() else 0
                                val speedText = "${formatSpeed(speed)} • $percent%"
                                FileTransferService.updateProgress(context, "Downloading: ${file.name}", percent, speedText, false)

                                lastTime = now
                                lastBytes = totalDownloaded
                            }
                        }
                        output.flush()
                    }
                }

                // Notify Android Media Scanner so file immediately shows in Gallery / Files
                MediaScannerConnection.scanFile(
                    context,
                    arrayOf(targetFile.absolutePath),
                    arrayOf(file.mimeType ?: "*/*"),
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
                FileTransferService.showCompletion(context, "Download Complete", "${file.name} saved to Downloads", false)
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
