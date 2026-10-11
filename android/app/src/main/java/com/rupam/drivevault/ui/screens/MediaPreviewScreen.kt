package com.rupam.drivevault.ui.screens

import android.annotation.SuppressLint
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.annotation.OptIn
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.model.FileCategoryType
import com.rupam.drivevault.ui.components.getCategoryIcon
import androidx.activity.compose.BackHandler
import androidx.compose.ui.layout.ContentScale
import com.rupam.drivevault.ui.theme.BluePrimary

@SuppressLint("SetJavaScriptEnabled")
@OptIn(UnstableApi::class)
@Composable
fun MediaPreviewScreen(
    file: DriveFile,
    streamUrl: String?,
    fallbackUrl: String? = null,
    onClose: () -> Unit,
    onDownload: () -> Unit,
    onShare: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier
) {
    BackHandler { onClose() }

    val context = LocalContext.current
    var activeUrl by remember(streamUrl) { mutableStateOf(streamUrl) }
    var triedFallback by remember(streamUrl) { mutableStateOf(false) }
    var exoPlayer by remember { mutableStateOf<ExoPlayer?>(null) }
    var playerError by remember { mutableStateOf<String?>(null) }

    DisposableEffect(activeUrl) {
        val url = activeUrl
        if (!url.isNullOrBlank() && (file.type == FileCategoryType.VIDEO || file.type == FileCategoryType.AUDIO)) {
            val player = ExoPlayer.Builder(context).build().apply {
                addListener(object : androidx.media3.common.Player.Listener {
                    override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                        if (!triedFallback && !fallbackUrl.isNullOrBlank() && fallbackUrl != url) {
                            triedFallback = true
                            activeUrl = fallbackUrl
                        } else {
                            playerError = error.message ?: "Failed to stream media"
                        }
                    }
                })
                setMediaItem(MediaItem.fromUri(url))
                prepare()
                playWhenReady = true
            }
            exoPlayer = player
        }

        onDispose {
            exoPlayer?.release()
            exoPlayer = null
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // ── Main Content Area ──
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            when (file.type) {
                FileCategoryType.VIDEO, FileCategoryType.AUDIO -> {
                    if (playerError != null) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                            modifier = Modifier.padding(24.dp)
                        ) {
                            Icon(Icons.Rounded.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(48.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(playerError ?: "Cannot stream file", color = Color.White, textAlign = TextAlign.Center)
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = onDownload) {
                                Text("Download to Play Locally")
                            }
                        }
                    } else if (exoPlayer != null) {
                        AndroidView(
                            factory = { ctx ->
                                PlayerView(ctx).apply {
                                    player = exoPlayer
                                    layoutParams = FrameLayout.LayoutParams(
                                        ViewGroup.LayoutParams.MATCH_PARENT,
                                        ViewGroup.LayoutParams.MATCH_PARENT
                                    )
                                    useController = true
                                }
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        CircularProgressIndicator(color = BluePrimary)
                    }
                }

                FileCategoryType.IMAGE -> {
                    val imageModel = remember(activeUrl, file.thumbnail) {
                        if (!activeUrl.isNullOrBlank()) activeUrl
                        else if (!file.thumbnail.isNullOrBlank()) file.thumbnail
                        else "https://drive.google.com/thumbnail?id=${file.id}&sz=w1600"
                    }
                    AsyncImage(
                        model = imageModel,
                        contentDescription = file.name,
                        contentScale = ContentScale.Fit,
                        onError = {
                            if (!triedFallback && !fallbackUrl.isNullOrBlank()) {
                                triedFallback = true
                                activeUrl = fallbackUrl
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .fillMaxHeight(0.85f)
                    )
                }

                FileCategoryType.DOCUMENT -> {
                    var isDocLoading by remember { mutableStateOf(true) }
                    Box(modifier = Modifier.fillMaxSize()) {
                        AndroidView(
                            factory = { ctx ->
                                WebView(ctx).apply {
                                    layoutParams = ViewGroup.LayoutParams(
                                        ViewGroup.LayoutParams.MATCH_PARENT,
                                        ViewGroup.LayoutParams.MATCH_PARENT
                                    )
                                    settings.javaScriptEnabled = true
                                    settings.domStorageEnabled = true
                                    settings.loadWithOverviewMode = true
                                    settings.useWideViewPort = true
                                    settings.builtInZoomControls = true
                                    settings.displayZoomControls = false
                                    webViewClient = object : WebViewClient() {
                                        override fun onPageFinished(view: WebView?, url: String?) {
                                            isDocLoading = false
                                        }
                                    }
                                    val previewUrl = "https://drive.google.com/file/d/${file.id}/preview"
                                    loadUrl(previewUrl)
                                }
                            },
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(top = 80.dp)
                        )
                        if (isDocLoading) {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(color = BluePrimary)
                            }
                        }
                    }
                }

                else -> {
                    // Document / APK / Archive Details Card
                    Surface(
                        shape = RoundedCornerShape(24.dp),
                        color = MaterialTheme.colorScheme.surface,
                        modifier = Modifier
                            .padding(24.dp)
                            .fillMaxWidth()
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(28.dp)
                        ) {
                            Icon(
                                imageVector = getCategoryIcon(file.type),
                                contentDescription = null,
                                tint = BluePrimary,
                                modifier = Modifier.size(56.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = file.name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "${file.size} • ${file.mimeType ?: "Unknown format"}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            Spacer(modifier = Modifier.height(24.dp))

                            Button(
                                onClick = onDownload,
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = BluePrimary),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Rounded.Download, contentDescription = null, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Download to Device")
                            }
                        }
                    }
                }
            }
        }

        // ── Top Navigation Overlay ──
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 36.dp)
                .align(Alignment.TopCenter),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = CircleShape,
                color = Color.Black.copy(alpha = 0.6f),
                onClick = onClose
            ) {
                Icon(
                    imageVector = Icons.Rounded.Close,
                    contentDescription = "Close",
                    tint = Color.White,
                    modifier = Modifier.padding(10.dp)
                )
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 12.dp)
            ) {
                Text(
                    text = file.name,
                    style = MaterialTheme.typography.titleSmall,
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1
                )
                val isCloudflare = streamUrl?.contains("workers.dev") == true || streamUrl?.contains("cloudflare") == true
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = if (isCloudflare) Color(0xFF10B981).copy(alpha = 0.25f) else Color(0xFF3B82F6).copy(alpha = 0.25f),
                    modifier = Modifier.padding(top = 2.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Icon(
                            imageVector = if (isCloudflare) Icons.Rounded.Bolt else Icons.Rounded.Cloud,
                            contentDescription = null,
                            tint = if (isCloudflare) Color(0xFF34D399) else Color(0xFF60A5FA),
                            modifier = Modifier.size(11.dp)
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text(
                            text = if (isCloudflare) "Cloudflare Edge CDN" else "Render Standard Server",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isCloudflare) Color(0xFF34D399) else Color(0xFF60A5FA)
                        )
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(
                    shape = CircleShape,
                    color = Color.Black.copy(alpha = 0.6f),
                    onClick = onDownload
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Download,
                        contentDescription = "Download",
                        tint = Color.White,
                        modifier = Modifier.padding(10.dp)
                    )
                }
                Surface(
                    shape = CircleShape,
                    color = Color.Black.copy(alpha = 0.6f),
                    onClick = onShare
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Share,
                        contentDescription = "Share",
                        tint = Color.White,
                        modifier = Modifier.padding(10.dp)
                    )
                }
            }
        }
    }
}
