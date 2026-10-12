package com.rupam.drivevault.model

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * File type categories supported by DriveVault
 */
enum class FileCategoryType {
    IMAGE,
    VIDEO,
    DOCUMENT,
    AUDIO,
    APK,
    FOLDER,
    ARCHIVE,
    OTHER;

    companion object {
        fun fromMimeOrExtension(name: String, mimeType: String?): FileCategoryType {
            val lowerName = name.lowercase()
            val lowerMime = (mimeType ?: "").lowercase()

            return when {
                lowerMime.startsWith("image/") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || lowerName.endsWith(".png") || lowerName.endsWith(".webp") || lowerName.endsWith(".gif") -> IMAGE
                lowerMime.startsWith("video/") || lowerName.endsWith(".mp4") || lowerName.endsWith(".mkv") || lowerName.endsWith(".mov") || lowerName.endsWith(".webm") -> VIDEO
                lowerMime.startsWith("audio/") || lowerMime.contains("opus") || lowerMime.contains("ogg") ||
                lowerName.endsWith(".mp3") || lowerName.endsWith(".wav") || lowerName.endsWith(".m4a") ||
                lowerName.endsWith(".aac") || lowerName.endsWith(".opus") || lowerName.endsWith(".flac") ||
                lowerName.endsWith(".ogg") || lowerName.endsWith(".amr") || lowerName.endsWith(".wma") -> AUDIO
                lowerMime.contains("pdf") || lowerMime.contains("document") || lowerMime.contains("presentation") || lowerMime.contains("spreadsheet") ||
                lowerName.endsWith(".pdf") || lowerName.endsWith(".doc") || lowerName.endsWith(".docx") || lowerName.endsWith(".txt") ||
                lowerName.endsWith(".ppt") || lowerName.endsWith(".pptx") || lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".csv") -> DOCUMENT
                lowerName.endsWith(".apk") || lowerMime.contains("vnd.android.package-archive") -> APK
                lowerMime == "application/vnd.google-apps.folder" || lowerName.endsWith("/") -> FOLDER
                lowerName.endsWith(".zip") || lowerName.endsWith(".rar") || lowerName.endsWith(".7z") || lowerName.endsWith(".tar") || lowerName.endsWith(".gz") -> ARCHIVE
                else -> OTHER
            }
        }
    }
}

/**
 * Drive file data model matching DriveVault backend schema
 */
data class DriveFile(
    val id: String,
    val name: String,
    val type: FileCategoryType,
    val size: String = "",
    val sizeBytes: Long = 0L,
    val date: String = "",
    val timestamp: Long = System.currentTimeMillis(),
    val thumbnail: String? = null,
    val webViewLink: String? = null,
    val starred: Boolean = false,
    val shared: Boolean = false,
    val isHidden: Boolean = false,
    val mimeType: String? = null,
    val parents: List<String> = emptyList()
)

/**
 * Category breakdown item for the Home Screen cards (Box-less clean icons design)
 */
data class CategoryStat(
    val type: FileCategoryType,
    val title: String,
    val count: Int,
    val formattedSize: String,
    val accentColor: Color,
    val badgeBgColor: Color
)

/**
 * Sync state for category count badges (Syncing -> Synced -> Count)
 */
enum class CategorySyncState {
    SYNCING,
    SYNCED,
    IDLE
}

/**
 * Overall storage usage stats
 */
data class StorageStats(
    val usedBytes: Long,
    val totalBytes: Long,
    val categories: List<CategoryStat>
) {
    val usedPercentage: Float
        get() = if (totalBytes > 0) (usedBytes.toFloat() / totalBytes.toFloat()) * 100f else 0f

    val formattedUsed: String
        get() = formatBytes(usedBytes)

    val formattedTotal: String
        get() = formatBytes(totalBytes)

    private fun formatBytes(bytes: Long): String {
        if (bytes <= 0) return "0 B"
        val gb = bytes.toDouble() / (1024.0 * 1024.0 * 1024.0)
        if (gb >= 1.0) return String.format(java.util.Locale.US, "%.2f GB", gb)
        val mb = bytes.toDouble() / (1024.0 * 1024.0)
        if (mb >= 1.0) return String.format(java.util.Locale.US, "%.1f MB", mb)
        val kb = bytes.toDouble() / 1024.0
        return String.format(java.util.Locale.US, "%.0f KB", kb)
    }
}
