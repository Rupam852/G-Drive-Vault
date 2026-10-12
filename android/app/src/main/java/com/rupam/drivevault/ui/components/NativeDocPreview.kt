package com.rupam.drivevault.ui.components

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import coil.compose.SubcomposeAsyncImage
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.network.NetworkClient
import com.rupam.drivevault.ui.theme.BluePrimary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream

data class DocTypeMeta(
    val title: String,
    val icon: ImageVector,
    val color: Color,
    val mimeType: String,
    val appSuggestion: String
)

private fun getDocMeta(fileName: String, rawMime: String?): DocTypeMeta {
    val lower = fileName.lowercase()
    return when {
        lower.endsWith(".ppt") || lower.endsWith(".pptx") || lower.endsWith(".pps") || lower.endsWith(".ppsx") ||
                rawMime?.contains("presentation") == true || rawMime?.contains("powerpoint") == true -> {
            DocTypeMeta(
                title = "PowerPoint Presentation",
                icon = Icons.Rounded.Slideshow,
                color = Color(0xFFD24726), // PPT Orange-Red
                mimeType = if (lower.endsWith(".ppt")) "application/vnd.ms-powerpoint" else "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                appSuggestion = "Google Slides, Microsoft PowerPoint, or WPS Office"
            )
        }
        lower.endsWith(".doc") || lower.endsWith(".docx") || lower.endsWith(".rtf") || lower.endsWith(".odt") ||
                rawMime?.contains("word") == true || rawMime?.contains("document") == true -> {
            DocTypeMeta(
                title = "Word Document",
                icon = Icons.Rounded.Description,
                color = Color(0xFF2B579A), // Word Blue
                mimeType = if (lower.endsWith(".doc")) "application/msword" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                appSuggestion = "Google Docs, Microsoft Word, or WPS Office"
            )
        }
        lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv") || lower.endsWith(".ods") ||
                rawMime?.contains("spreadsheet") == true || rawMime?.contains("excel") == true -> {
            DocTypeMeta(
                title = "Excel Spreadsheet",
                icon = Icons.Rounded.TableChart,
                color = Color(0xFF217346), // Excel Green
                mimeType = if (lower.endsWith(".xls")) "application/vnd.ms-excel" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                appSuggestion = "Google Sheets, Microsoft Excel, or WPS Office"
            )
        }
        else -> {
            DocTypeMeta(
                title = "Document File",
                icon = Icons.Rounded.Article,
                color = BluePrimary,
                mimeType = rawMime ?: "application/octet-stream",
                appSuggestion = "Office or Document Viewer"
            )
        }
    }
}

@Composable
fun NativeDocPreview(
    file: DriveFile,
    streamUrl: String?,
    fallbackUrl: String? = null,
    onDownload: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val meta = remember(file.name, file.mimeType) { getDocMeta(file.name, file.mimeType) }

    var isPreparing by remember { mutableStateOf(true) }
    var cachedFileHolder by remember { mutableStateOf<File?>(null) }
    var downloadProgress by remember { mutableFloatStateOf(0f) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun openInExternalApp(targetFile: File) {
        try {
            val contentUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                targetFile
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, meta.mimeType)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(Intent.createChooser(intent, "Open with..."))
        } catch (e: Exception) {
            Toast.makeText(context, "Could not open document: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    fun shareCachedFile(targetFile: File) {
        try {
            val contentUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                targetFile
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = meta.mimeType
                putExtra(Intent.EXTRA_STREAM, contentUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "Share presentation via..."))
        } catch (e: Exception) {
            Toast.makeText(context, "Sharing failed: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    LaunchedEffect(file.id, streamUrl) {
        isPreparing = true
        errorMessage = null
        withContext(Dispatchers.IO) {
            try {
                val cacheDir = File(context.cacheDir, "doc_previews")
                if (!cacheDir.exists()) cacheDir.mkdirs()

                val safeExt = file.name.substringAfterLast('.', "")
                val cleanName = if (safeExt.isNotEmpty()) "${file.id}.$safeExt" else "${file.id}.dat"
                val targetFile = File(cacheDir, cleanName)

                if (!targetFile.exists() || targetFile.length() < 100L) {
                    val urlToTry = streamUrl ?: fallbackUrl
                    if (urlToTry.isNullOrBlank()) {
                        throw Exception("No stream URL available for file")
                    }

                    var success = false
                    val request = Request.Builder().url(urlToTry).get().build()
                    val client = NetworkClient.uploadOkHttpClient
                    val response = client.newCall(request).execute()

                    if (response.isSuccessful && response.body != null) {
                        val body = response.body!!
                        val totalLen = body.contentLength()
                        body.byteStream().use { input ->
                            FileOutputStream(targetFile).use { output ->
                                val buffer = ByteArray(8192)
                                var bytesRead: Int
                                var totalRead = 0L
                                while (input.read(buffer).also { bytesRead = it } != -1) {
                                    output.write(buffer, 0, bytesRead)
                                    totalRead += bytesRead
                                    if (totalLen > 0) {
                                        downloadProgress = (totalRead.toFloat() / totalLen.toFloat()).coerceIn(0f, 1f)
                                    }
                                }
                            }
                        }
                        if (targetFile.length() > 500L) {
                            success = true
                        }
                    }

                    if (!success && !fallbackUrl.isNullOrBlank() && fallbackUrl != urlToTry) {
                        val fbReq = Request.Builder().url(fallbackUrl).get().build()
                        val fbResp = client.newCall(fbReq).execute()
                        if (fbResp.isSuccessful && fbResp.body != null) {
                            fbResp.body!!.byteStream().use { input ->
                                FileOutputStream(targetFile).use { output ->
                                    input.copyTo(output)
                                }
                            }
                        }
                    }
                }

                if (!targetFile.exists() || targetFile.length() < 100L) {
                    throw Exception("Failed to load document content")
                }

                withContext(Dispatchers.Main) {
                    cachedFileHolder = targetFile
                    isPreparing = false
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    errorMessage = e.message ?: "Failed to load document"
                    isPreparing = false
                }
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
            .padding(horizontal = 24.dp),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
            shadowElevation = 8.dp,
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // ── Thumbnail or Stylized Icon ──
                if (!file.thumbnail.isNullOrBlank()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.Black.copy(alpha = 0.05f)),
                        contentAlignment = Alignment.Center
                    ) {
                        SubcomposeAsyncImage(
                            model = file.thumbnail,
                            contentDescription = file.name,
                            contentScale = ContentScale.Fit,
                            loading = {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(32.dp),
                                    strokeWidth = 2.dp,
                                    color = meta.color
                                )
                            },
                            error = {
                                Box(
                                    modifier = Modifier
                                        .size(76.dp)
                                        .clip(CircleShape)
                                        .background(meta.color.copy(alpha = 0.12f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = meta.icon,
                                        contentDescription = null,
                                        tint = meta.color,
                                        modifier = Modifier.size(40.dp)
                                    )
                                }
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    Spacer(modifier = Modifier.height(18.dp))
                } else {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(
                                Brush.linearGradient(
                                    listOf(
                                        meta.color.copy(alpha = 0.18f),
                                        meta.color.copy(alpha = 0.08f)
                                    )
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = meta.icon,
                            contentDescription = null,
                            tint = meta.color,
                            modifier = Modifier.size(44.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(18.dp))
                }

                // ── Category Pill Badge ──
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = meta.color.copy(alpha = 0.12f)
                ) {
                    Text(
                        text = meta.title.uppercase(),
                        color = meta.color,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // ── File Name & Size ──
                Text(
                    text = file.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "${file.size} • No Google sign-in required",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(20.dp))

                // ── Loading / Ready States ──
                if (isPreparing) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(vertical = 12.dp)
                    ) {
                        CircularProgressIndicator(
                            color = meta.color,
                            strokeWidth = 3.dp,
                            modifier = Modifier.size(36.dp)
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = if (downloadProgress > 0f) "Loading presentation ${(downloadProgress * 100).toInt()}%..." else "Preparing presentation...",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.Medium
                        )
                    }
                } else if (errorMessage != null) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.2f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.ErrorOutline,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = errorMessage ?: "Could not load document",
                                color = MaterialTheme.colorScheme.error,
                                fontSize = 12.sp
                            )
                        }
                    }
                } else if (cachedFileHolder != null) {
                    val targetFile = cachedFileHolder!!

                    // 1. Primary Action: Open with PowerPoint / Slides / Office
                    Button(
                        onClick = { openInExternalApp(targetFile) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = meta.color,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.OpenInNew,
                            contentDescription = null,
                            modifier = Modifier.size(19.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Open in ${if (meta.title.contains("PowerPoint")) "PowerPoint / Slides" else "Office App"}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // 2. Secondary Row: Download to Device & Share
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = onDownload,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(46.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Download,
                                contentDescription = null,
                                modifier = Modifier.size(17.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(text = "Download", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }

                        OutlinedButton(
                            onClick = { shareCachedFile(targetFile) },
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(46.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Share,
                                contentDescription = null,
                                modifier = Modifier.size(17.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(text = "Share", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}
