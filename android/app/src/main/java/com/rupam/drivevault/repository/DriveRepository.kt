package com.rupam.drivevault.repository

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.rupam.drivevault.auth.AuthManager
import com.rupam.drivevault.model.*
import com.rupam.drivevault.network.*
import com.rupam.drivevault.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

class DriveRepository(private val authManager: AuthManager) {
    private val api = NetworkClient.apiService

    init {
        NetworkClient.onTokenRefreshed = { newTokens ->
            authManager.updateTokens(newTokens)
        }
    }

    private var cachedStorageStats: StorageStats? = null
    private var lastBreakdownTime: Long = 0L
    private val BREAKDOWN_TTL_MS = 5 * 60 * 1000L // 5 minutes cache

    companion object {
        // Deployed Cloudflare Worker URL for edge acceleration & zero Render RAM consumption
        var cloudflareWorkerUrl: String? = "https://drivevault-edge-streamer.rupambairagya07.workers.dev"
    }

    fun getStreamUrl(fileId: String, ticket: String): String {
        val cfUrl = cloudflareWorkerUrl
        val tokens = authManager.getTokens()
        val token = tokens?.accessToken
        val refreshToken = tokens?.refreshToken
        return if (!cfUrl.isNullOrBlank() && !token.isNullOrBlank()) {
            val base = "$cfUrl/stream/$fileId?token=$token"
            if (!refreshToken.isNullOrBlank()) "$base&refresh_token=$refreshToken" else base
        } else {
            "https://g-drive-vault.onrender.com/api/drive/download/$fileId?ticket=$ticket&inline=true"
        }
    }

    fun getFastStreamUrl(fileId: String): String {
        val cfUrl = cloudflareWorkerUrl
        val tokens = authManager.getTokens()
        val token = tokens?.accessToken
        val refreshToken = tokens?.refreshToken
        return if (!cfUrl.isNullOrBlank() && !token.isNullOrBlank()) {
            val base = "$cfUrl/stream/$fileId?token=$token"
            if (!refreshToken.isNullOrBlank()) "$base&refresh_token=$refreshToken" else base
        } else {
            "https://g-drive-vault.onrender.com/api/drive/download/$fileId?inline=true"
        }
    }

    fun getRenderDownloadUrl(fileId: String, ticket: String): String {
        return "https://g-drive-vault.onrender.com/api/drive/download/$fileId?ticket=$ticket"
    }

    fun getDirectGoogleDownloadUrl(fileId: String): String? {
        val tokens = authManager.getTokens()
        return if (!tokens?.accessToken.isNullOrBlank()) {
            "https://www.googleapis.com/drive/v3/files/$fileId?alt=media"
        } else null
    }

    fun getCachedStorageStats(): StorageStats? = cachedStorageStats

    fun clearCache(folderId: String? = null) {
        if (folderId != null) {
            folderCache.remove(folderId)
        } else {
            folderCache.clear()
        }
        categoryCache.clear()
        cachedStorageStats = null
        lastBreakdownTime = 0L
    }

    suspend fun getStorageStats(forceRefreshBreakdown: Boolean = false): Result<StorageStats> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val aboutRes = api.getStorageAbout(tokensHeader)
            val about = aboutRes.body()

            val quota = about?.storageQuota
            val used = quota?.usage?.toLongOrNull() ?: 0L
            val total = quota?.limit?.toLongOrNull() ?: (15L * 1024L * 1024L * 1024L)

            // Fast load: Do NOT block initial app launch with the heavy 6,000+ files breakdown scan.
            // Only fetch the full file-by-file breakdown when explicitly requested (e.g. user opens breakdown sheet).
            val shouldFetchBreakdown = forceRefreshBreakdown

            val categories = if (shouldFetchBreakdown) {
                val breakdownRes = api.getStorageBreakdown(tokensHeader)
                val breakdown = breakdownRes.body()
                lastBreakdownTime = System.currentTimeMillis()
                listOf(
                    CategoryStat(
                        type = FileCategoryType.IMAGE,
                        title = "Images",
                        count = breakdown?.image?.count ?: 0,
                        formattedSize = formatBytes(breakdown?.image?.size ?: 0L),
                        accentColor = CategoryImage,
                        badgeBgColor = CategoryImage
                    ),
                    CategoryStat(
                        type = FileCategoryType.VIDEO,
                        title = "Videos",
                        count = breakdown?.video?.count ?: 0,
                        formattedSize = formatBytes(breakdown?.video?.size ?: 0L),
                        accentColor = CategoryVideo,
                        badgeBgColor = CategoryVideo
                    ),
                    CategoryStat(
                        type = FileCategoryType.DOCUMENT,
                        title = "Documents",
                        count = breakdown?.document?.count ?: 0,
                        formattedSize = formatBytes(breakdown?.document?.size ?: 0L),
                        accentColor = CategoryDocument,
                        badgeBgColor = CategoryDocument
                    ),
                    CategoryStat(
                        type = FileCategoryType.AUDIO,
                        title = "Audio",
                        count = breakdown?.audio?.count ?: 0,
                        formattedSize = formatBytes(breakdown?.audio?.size ?: 0L),
                        accentColor = CategoryAudio,
                        badgeBgColor = CategoryAudio
                    ),
                    CategoryStat(
                        type = FileCategoryType.APK,
                        title = "APKs & Apps",
                        count = breakdown?.apk?.count ?: 0,
                        formattedSize = formatBytes(breakdown?.apk?.size ?: 0L),
                        accentColor = CategoryApk,
                        badgeBgColor = CategoryApk
                    ),
                    CategoryStat(
                        type = FileCategoryType.FOLDER,
                        title = "Folders",
                        count = breakdown?.folder?.count ?: 0,
                        formattedSize = if ((breakdown?.folder?.count ?: 0) > 0) "${breakdown?.folder?.count} Folders" else "Directories",
                        accentColor = CategoryFolder,
                        badgeBgColor = CategoryFolder
                    ),
                    CategoryStat(
                        type = FileCategoryType.ARCHIVE,
                        title = "Archives",
                        count = breakdown?.archive?.count ?: 0,
                        formattedSize = formatBytes(breakdown?.archive?.size ?: 0L),
                        accentColor = CategoryArchive,
                        badgeBgColor = CategoryArchive
                    ),
                    CategoryStat(
                        type = FileCategoryType.OTHER,
                        title = "Other Files",
                        count = breakdown?.other?.count ?: 0,
                        formattedSize = formatBytes(breakdown?.other?.size ?: 0L),
                        accentColor = CategoryOther,
                        badgeBgColor = CategoryOther
                    )
                )
            } else if (cachedStorageStats != null && cachedStorageStats!!.categories.isNotEmpty()) {
                cachedStorageStats!!.categories
            } else {
                // Instant defaults so Home screen categories render in 0 ms!
                listOf(
                    CategoryStat(type = FileCategoryType.IMAGE, title = "Images", count = 0, formattedSize = "Photos", accentColor = CategoryImage, badgeBgColor = CategoryImage),
                    CategoryStat(type = FileCategoryType.VIDEO, title = "Videos", count = 0, formattedSize = "Media", accentColor = CategoryVideo, badgeBgColor = CategoryVideo),
                    CategoryStat(type = FileCategoryType.DOCUMENT, title = "Documents", count = 0, formattedSize = "Docs & PDFs", accentColor = CategoryDocument, badgeBgColor = CategoryDocument),
                    CategoryStat(type = FileCategoryType.AUDIO, title = "Audio", count = 0, formattedSize = "Music", accentColor = CategoryAudio, badgeBgColor = CategoryAudio),
                    CategoryStat(type = FileCategoryType.APK, title = "APKs & Apps", count = 0, formattedSize = "Packages", accentColor = CategoryApk, badgeBgColor = CategoryApk),
                    CategoryStat(type = FileCategoryType.FOLDER, title = "Folders", count = 0, formattedSize = "Directories", accentColor = CategoryFolder, badgeBgColor = CategoryFolder),
                    CategoryStat(type = FileCategoryType.ARCHIVE, title = "Archives", count = 0, formattedSize = "Zip & Rar", accentColor = CategoryArchive, badgeBgColor = CategoryArchive),
                    CategoryStat(type = FileCategoryType.OTHER, title = "Other Files", count = 0, formattedSize = "Files", accentColor = CategoryOther, badgeBgColor = CategoryOther)
                )
            }

            val stats = StorageStats(usedBytes = used, totalBytes = total, categories = categories)
            cachedStorageStats = stats
            Result.success(stats)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private val folderCache = java.util.concurrent.ConcurrentHashMap<String, List<DriveFile>>()
    private val categoryCache = java.util.concurrent.ConcurrentHashMap<String, List<DriveFile>>()

    fun getCachedFiles(folderId: String? = null): List<DriveFile>? {
        return folderCache[folderId ?: "root"]
    }

    fun getCachedCategoryFiles(filter: String): List<DriveFile>? {
        return categoryCache[filter]
    }

    fun mapDtoToDriveFile(dto: com.rupam.drivevault.network.DriveFileDto): DriveFile {
        val isFolder = dto.mimeType == "application/vnd.google-apps.folder" || dto.name.endsWith("/")
        val parsedBytes = dto.size?.toLongOrNull() ?: dto.sizeBytes ?: 0L
        val displaySize = if (isFolder) "Folder" else formatBytes(parsedBytes)
        val displayDate = formatDate(dto.modifiedTime ?: dto.createdTime)
        val parsedTimestamp = parseTimestamp(dto.modifiedTime ?: dto.createdTime)

        return DriveFile(
            id = dto.id,
            name = dto.name,
            type = FileCategoryType.fromMimeOrExtension(dto.name, dto.mimeType),
            size = displaySize,
            sizeBytes = parsedBytes,
            date = displayDate,
            timestamp = parsedTimestamp,
            thumbnail = dto.thumbnailLink,
            webViewLink = dto.webViewLink,
            starred = dto.starred ?: false,
            shared = dto.shared ?: false,
            isHidden = dto.isHidden ?: false,
            mimeType = dto.mimeType,
            parents = dto.parents ?: emptyList()
        )
    }


    suspend fun getFiles(folderId: String? = null, filter: String? = null): Result<List<DriveFile>> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val response = api.getFiles(tokensHeader, folderId, filter)
            if (response.isSuccessful) {
                val dtoList = response.body() ?: emptyList()
                val files = dtoList.map { mapDtoToDriveFile(it) }
                if (filter == null) {
                    folderCache[folderId ?: "root"] = files
                } else {
                    categoryCache[filter] = files
                }
                Result.success(files)
            } else {
                Result.failure(Exception("Failed to fetch files: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createFolder(name: String, parentId: String? = null): Result<DriveFile> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val res = api.createFolder(tokensHeader, CreateFolderRequest(name, parentId))
            if (res.isSuccessful && res.body() != null) {
                val dto = res.body()!!
                Result.success(
                    DriveFile(
                        id = dto.id,
                        name = dto.name,
                        type = FileCategoryType.FOLDER,
                        mimeType = dto.mimeType
                    )
                )
            } else {
                Result.failure(Exception("Folder creation failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun exchangeNativeAuth(authCode: String): Result<NativeAuthResponse> = withContext(Dispatchers.IO) {
        try {
            val res = api.exchangeNativeAuth(NativeAuthRequest(code = authCode))
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!)
            } else {
                val errBody = res.errorBody()?.string()
                Result.failure(Exception("Native auth exchange failed (${res.code()}): $errBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun renameFile(fileId: String, newName: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val res = api.renameFile(fileId, tokensHeader, RenameFileRequest(newName))
            if (res.isSuccessful) Result.success(Unit) else Result.failure(Exception("Rename failed"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun starFile(fileId: String, starred: Boolean): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val res = api.starFile(fileId, tokensHeader, StarFileRequest(starred))
            if (res.isSuccessful) Result.success(Unit) else Result.failure(Exception("Star failed"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun trashFile(fileId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val res = api.trashFile(fileId, tokensHeader)
            if (res.isSuccessful) Result.success(Unit) else Result.failure(Exception("Delete failed"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun trashFiles(fileIds: List<String>): Result<Int> = withContext(Dispatchers.IO) {
        var count = 0
        val tokensHeader = authManager.getTokensHeader()
        for (id in fileIds) {
            try {
                val res = api.trashFile(id, tokensHeader)
                if (res.isSuccessful) count++
            } catch (e: Exception) {
                // continue with next
            }
        }
        folderCache.clear()
        categoryCache.clear()
        Result.success(count)
    }

    suspend fun moveFile(fileId: String, newParentId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val target = if (newParentId.startsWith("cat_")) "root" else newParentId
            val res = api.moveFile(fileId, tokensHeader, com.rupam.drivevault.network.MoveFileRequest(target))
            if (res.isSuccessful) {
                folderCache.clear()
                categoryCache.clear()
                Result.success(Unit)
            } else {
                Result.failure(Exception("Move failed: ${res.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun moveFiles(fileIds: List<String>, newParentId: String): Result<Int> = withContext(Dispatchers.IO) {
        var count = 0
        val tokensHeader = authManager.getTokensHeader()
        val target = if (newParentId.startsWith("cat_")) "root" else newParentId
        for (id in fileIds) {
            try {
                val res = api.moveFile(id, tokensHeader, com.rupam.drivevault.network.MoveFileRequest(target))
                if (res.isSuccessful) count++
            } catch (e: Exception) {
                // continue with next
            }
        }
        folderCache.clear()
        categoryCache.clear()
        Result.success(count)
    }

    suspend fun getTrashFiles(): Result<List<DriveFile>> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val res = api.getTrashFiles(tokensHeader)
            if (res.isSuccessful) {
                val dtoList = res.body() ?: emptyList()
                val files = dtoList.map { dto ->
                    val isFolder = dto.mimeType == "application/vnd.google-apps.folder" || dto.name.endsWith("/")
                    val parsedBytes = dto.size?.toLongOrNull() ?: dto.sizeBytes ?: 0L
                    val displaySize = if (isFolder) "Folder" else formatBytes(parsedBytes)
                    val displayDate = formatDate(dto.modifiedTime ?: dto.createdTime)
                    DriveFile(
                        id = dto.id,
                        name = dto.name,
                        type = FileCategoryType.fromMimeOrExtension(dto.name, dto.mimeType),
                        size = displaySize,
                        sizeBytes = parsedBytes,
                        date = displayDate,
                        thumbnail = dto.thumbnailLink,
                        webViewLink = dto.webViewLink,
                        mimeType = dto.mimeType
                    )
                }
                Result.success(files)
            } else {
                Result.failure(Exception("Failed to load trash: ${res.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun restoreFile(fileId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val res = api.restoreFile(fileId, tokensHeader)
            if (res.isSuccessful) Result.success(Unit) else Result.failure(Exception("Restore failed"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deletePermanently(fileId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val res = api.deletePermanently(fileId, tokensHeader)
            if (res.isSuccessful) Result.success(Unit) else Result.failure(Exception("Permanent delete failed"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDownloadTicket(): Result<String> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val tokens = authManager.getTokens() ?: return@withContext Result.failure(Exception("Not authenticated"))
            val res = api.createDownloadTicket(tokensHeader, TicketRequest(tokens = tokens))
            if (res.isSuccessful && res.body() != null) {
                Result.success(res.body()!!.ticketId)
            } else {
                Result.failure(Exception("Ticket creation failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadFile(context: Context, uri: Uri, targetFolderId: String? = null): Result<DriveFile> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val contentResolver = context.contentResolver

            var filename = "upload_${System.currentTimeMillis()}"
            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (cursor.moveToFirst() && nameIndex >= 0) {
                    filename = cursor.getString(nameIndex)
                }
            }

            val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
            val inputStream = contentResolver.openInputStream(uri) ?: return@withContext Result.failure(Exception("Cannot open file stream"))
            val bytes = inputStream.readBytes()
            inputStream.close()

            val requestFile = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
            val body = MultipartBody.Part.createFormData("file", filename, requestFile)
            val parentBody = (targetFolderId ?: "root").toRequestBody("text/plain".toMediaTypeOrNull())
            val relBody = "".toRequestBody("text/plain".toMediaTypeOrNull())

            val res = api.uploadFile(tokensHeader, body, parentBody, relBody)
            if (res.isSuccessful && res.body() != null) {
                val dto = res.body()!!
                val isFolder = dto.mimeType == "application/vnd.google-apps.folder" || dto.name.endsWith("/")
                val parsedBytes = dto.size?.toLongOrNull() ?: dto.sizeBytes ?: 0L
                val displaySize = if (isFolder) "Folder" else formatBytes(parsedBytes)
                val displayDate = formatDate(dto.modifiedTime ?: dto.createdTime)

                Result.success(
                    DriveFile(
                        id = dto.id,
                        name = dto.name,
                        type = FileCategoryType.fromMimeOrExtension(dto.name, dto.mimeType),
                        size = displaySize,
                        sizeBytes = parsedBytes,
                        date = displayDate,
                        thumbnail = dto.thumbnailLink,
                        webViewLink = dto.webViewLink,
                        starred = dto.starred ?: false,
                        shared = dto.shared ?: false,
                        isHidden = dto.isHidden ?: false,
                        mimeType = dto.mimeType,
                        parents = dto.parents ?: emptyList()
                    )
                )
            } else {
                Result.failure(Exception("Upload failed: ${res.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun isFilePublic(fileId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val response = api.getPermissions(fileId, tokensHeader)
            if (response.isSuccessful) {
                val perms = response.body() ?: emptyList()
                val isPublic = perms.any { it.type == "anyone" }
                Result.success(isPublic)
            } else {
                Result.failure(Exception("Permission check failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun setFilePublic(fileId: String, makePublic: Boolean): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val tokensHeader = authManager.getTokensHeader()
            val role = if (makePublic) "reader" else "restricted"
            val response = api.setAnyonePermission(fileId, tokensHeader, PermissionsAnyoneRequest(role))
            if (response.isSuccessful) {
                folderCache.clear()
                categoryCache.clear()
                Result.success(makePublic)
            } else {
                val errBody = try { response.errorBody()?.string() } catch (_: Exception) { null }
                Result.failure(Exception("Failed to update access: ${response.code()} ${errBody ?: ""}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }


    private fun formatDate(isoString: String?): String {
        if (isoString.isNullOrBlank()) return ""
        return try {
            val cleanIso = if (isoString.contains(".")) {
                isoString.substringBefore(".")
            } else {
                isoString.removeSuffix("Z")
            }
            val parser = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }
            val date = parser.parse(cleanIso)
            val formatter = java.text.SimpleDateFormat("dd MMM yyyy", java.util.Locale.getDefault())
            if (date != null) formatter.format(date) else isoString.take(10)
        } catch (e: Exception) {
            isoString.take(10)
        }
    }

    private fun parseTimestamp(isoString: String?): Long {
        if (isoString.isNullOrBlank()) return 0L
        return try {
            val cleanIso = if (isoString.contains(".")) {
                isoString.substringBefore(".")
            } else {
                isoString.removeSuffix("Z")
            }
            val parser = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }
            parser.parse(cleanIso)?.time ?: 0L
        } catch (_: Exception) {
            0L
        }
    }


    private fun formatBytes(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val units = arrayOf("B", "KB", "MB", "GB", "TB")
        val digitGroups = (Math.log10(bytes.toDouble()) / Math.log10(1024.0)).toInt()
        val value = bytes / Math.pow(1024.0, digitGroups.toDouble())
        return String.format(java.util.Locale.US, "%.1f %s", value, units[digitGroups])
    }
}
