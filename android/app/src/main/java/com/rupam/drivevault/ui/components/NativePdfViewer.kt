package com.rupam.drivevault.ui.components

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.network.NetworkClient
import com.rupam.drivevault.ui.theme.BluePrimary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream

@Composable
fun NativePdfViewer(
    file: DriveFile,
    streamUrl: String?,
    fallbackUrl: String? = null,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val screenWidth = LocalConfiguration.current.screenWidthDp.dp

    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var pageCount by remember { mutableIntStateOf(0) }
    var pfdHolder by remember { mutableStateOf<ParcelFileDescriptor?>(null) }
    var rendererHolder by remember { mutableStateOf<PdfRenderer?>(null) }

    // Page bitmap cache
    val pageBitmaps = remember { mutableStateMapOf<Int, Bitmap>() }
    val listState = rememberLazyListState()

    // Pinch-to-zoom state
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    val transformableState = rememberTransformableState { zoomChange, panChange, _ ->
        scale = (scale * zoomChange).coerceIn(1f, 3.5f)
        if (scale > 1f) {
            val maxOffset = 300f * (scale - 1f)
            offset = Offset(
                x = (offset.x + panChange.x).coerceIn(-maxOffset, maxOffset),
                y = (offset.y + panChange.y).coerceIn(-maxOffset, maxOffset)
            )
        } else {
            offset = Offset.Zero
        }
    }

    // Cleanup on dispose
    DisposableEffect(file.id) {
        onDispose {
            try {
                rendererHolder?.close()
                pfdHolder?.close()
                pageBitmaps.values.forEach { it.recycle() }
                pageBitmaps.clear()
            } catch (_: Exception) {}
        }
    }

    // Download and initialize PDF
    LaunchedEffect(file.id, streamUrl) {
        isLoading = true
        errorMessage = null
        withContext(Dispatchers.IO) {
            try {
                val cacheDir = File(context.cacheDir, "pdf_previews")
                if (!cacheDir.exists()) cacheDir.mkdirs()
                val targetFile = File(cacheDir, "${file.id}.pdf")

                // If not cached or 0 bytes, download from authenticated streamUrl
                if (!targetFile.exists() || targetFile.length() < 100L) {
                    val urlToTry = streamUrl ?: fallbackUrl
                    if (urlToTry.isNullOrBlank()) {
                        throw Exception("No stream URL available")
                    }

                    var success = false
                    val request = Request.Builder().url(urlToTry).get().build()
                    val client = NetworkClient.uploadOkHttpClient
                    val response = client.newCall(request).execute()

                    if (response.isSuccessful && response.body != null) {
                        response.body!!.byteStream().use { input ->
                            FileOutputStream(targetFile).use { output ->
                                input.copyTo(output)
                            }
                        }
                        if (targetFile.length() > 500L) {
                            success = true
                        }
                    }

                    // Try fallback if primary failed
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
                    throw Exception("Failed to download PDF bytes")
                }

                val pfd = ParcelFileDescriptor.open(targetFile, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(pfd)
                withContext(Dispatchers.Main) {
                    pfdHolder = pfd
                    rendererHolder = renderer
                    pageCount = renderer.pageCount
                    isLoading = false
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    errorMessage = e.message ?: "Failed to render PDF"
                    isLoading = false
                }
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A)), // Sleek Dark Slate reader background
        contentAlignment = Alignment.Center
    ) {
        if (isLoading) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                CircularProgressIndicator(
                    color = BluePrimary,
                    strokeWidth = 3.5.dp,
                    modifier = Modifier.size(46.dp)
                )
                Text(
                    text = "Loading PDF document...",
                    color = Color.White.copy(alpha = 0.85f),
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp)
                )
            }
        } else if (errorMessage != null || rendererHolder == null || pageCount == 0) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(28.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.ErrorOutline,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(48.dp)
                )
                Text(
                    text = "Unable to preview PDF directly",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
                Text(
                    text = errorMessage ?: "Document could not be parsed.",
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = 12.5.sp,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
        } else {
            val renderer = rendererHolder!!

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                        translationX = offset.x
                        translationY = offset.y
                    }
                    .transformable(transformableState)
            ) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 76.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    items(pageCount) { pageIndex ->
                        val bitmap = pageBitmaps[pageIndex]

                        // Render page async if not already cached
                        LaunchedEffect(pageIndex) {
                            if (!pageBitmaps.containsKey(pageIndex)) {
                                withContext(Dispatchers.IO) {
                                    try {
                                        synchronized(renderer) {
                                            val page = renderer.openPage(pageIndex)
                                            // Scale up for crisp high DPI rendering
                                            val targetWidth = (page.width * 2.2f).toInt()
                                            val targetHeight = (page.height * 2.2f).toInt()
                                            val bmp = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888)

                                            // Fill with solid white before rendering
                                            val canvas = Canvas(bmp)
                                            canvas.drawColor(android.graphics.Color.WHITE)

                                            page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                                            page.close()
                                            pageBitmaps[pageIndex] = bmp
                                        }
                                    } catch (_: Exception) {}
                                }
                            }
                        }

                        // Document Page Card
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color.White,
                            modifier = Modifier
                                .fillMaxWidth()
                                .shadow(8.dp, shape = RoundedCornerShape(8.dp))
                                .border(1.dp, Color(0xFF334155), RoundedCornerShape(8.dp))
                        ) {
                            if (bitmap != null) {
                                Image(
                                    bitmap = bitmap.asImageBitmap(),
                                    contentDescription = "Page ${pageIndex + 1}",
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(bitmap.width.toFloat() / bitmap.height.toFloat())
                                )
                            } else {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(480.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(
                                        color = BluePrimary,
                                        strokeWidth = 2.5.dp,
                                        modifier = Modifier.size(32.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ── Floating Page Counter Pill ──
            val firstVisiblePage = remember {
                derivedStateOf { listState.firstVisibleItemIndex + 1 }
            }

            Surface(
                shape = RoundedCornerShape(20.dp),
                color = Color.Black.copy(alpha = 0.75f),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.15f)),
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 24.dp)
            ) {
                Text(
                    text = "Page ${firstVisiblePage.value} / $pageCount",
                    color = Color.White,
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp
                    ),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 7.dp)
                )
            }
        }
    }
}
