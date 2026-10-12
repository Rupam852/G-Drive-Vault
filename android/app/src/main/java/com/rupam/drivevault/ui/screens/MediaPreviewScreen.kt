package com.rupam.drivevault.ui.screens

import android.annotation.SuppressLint
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.animation.core.*
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.SubcomposeAsyncImage
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.model.FileCategoryType
import com.rupam.drivevault.ui.components.getCategoryIcon
import com.rupam.drivevault.ui.theme.BluePrimary
import kotlinx.coroutines.delay

private fun formatDuration(ms: Long): String {
    if (ms <= 0L) return "00:00"
    val totalSeconds = ms / 1000
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return String.format(java.util.Locale.US, "%02d:%02d", minutes, seconds)
}

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
    var activeUrl by remember(file.id) { mutableStateOf(streamUrl) }
    var triedFallback by remember(file.id) { mutableStateOf(false) }
    var exoPlayer by remember { mutableStateOf<ExoPlayer?>(null) }
    var playerError by remember { mutableStateOf<String?>(null) }

    var isBuffering by remember { mutableStateOf(true) }
    var isPlaying by remember { mutableStateOf(false) }
    var currentPositionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }

    // Live Playback Tracker Coroutine
    LaunchedEffect(exoPlayer, isPlaying) {
        while (true) {
            exoPlayer?.let { player ->
                currentPositionMs = player.currentPosition
                val dur = player.duration
                if (dur > 0L) durationMs = dur
                isPlaying = player.isPlaying
            }
            delay(300L)
        }
    }

    DisposableEffect(activeUrl) {
        val url = activeUrl
        if (!url.isNullOrBlank() && (file.type == FileCategoryType.VIDEO || file.type == FileCategoryType.AUDIO)) {
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build()

            val player = ExoPlayer.Builder(context).build().apply {
                setAudioAttributes(audioAttributes, true)
                addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        isBuffering = playbackState == Player.STATE_BUFFERING
                        if (playbackState == Player.STATE_READY) {
                            if (duration > 0L) durationMs = duration
                            isBuffering = false
                        }
                    }

                    override fun onIsPlayingChanged(playing: Boolean) {
                        isPlaying = playing
                        if (playing) isBuffering = false
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        if (!triedFallback && !fallbackUrl.isNullOrBlank() && fallbackUrl != url) {
                            triedFallback = true
                            activeUrl = fallbackUrl
                        } else {
                            playerError = error.message ?: "Failed to stream media"
                            isBuffering = false
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
                // ── DEDICATED PREMIUM AUDIO PLAYER ──
                FileCategoryType.AUDIO -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(
                                        Color(0xFF1E1035),
                                        Color(0xFF0F0B1E),
                                        Color(0xFF050508)
                                    )
                                )
                            )
                            .padding(horizontal = 24.dp, vertical = 20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (playerError != null) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                                modifier = Modifier.padding(24.dp)
                            ) {
                                Icon(Icons.Rounded.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(48.dp))
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(playerError ?: "Cannot stream audio", color = Color.White, textAlign = TextAlign.Center)
                                Spacer(modifier = Modifier.height(16.dp))
                                Button(onClick = onDownload) {
                                    Text("Download to Play Locally")
                                }
                            }
                        } else {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                // 1. Spinning Vinyl / Album Art Disc
                                val infiniteTransition = rememberInfiniteTransition(label = "VinylSpin")
                                val rotationAngle by infiniteTransition.animateFloat(
                                    initialValue = 0f,
                                    targetValue = 360f,
                                    animationSpec = infiniteRepeatable(
                                        animation = tween(durationMillis = 10000, easing = LinearEasing),
                                        repeatMode = RepeatMode.Restart
                                    ),
                                    label = "VinylAngle"
                                )

                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier.size(230.dp)
                                ) {
                                    // Ambient glowing background aura
                                    Surface(
                                        shape = CircleShape,
                                        color = Color(0xFF8B5CF6).copy(alpha = 0.12f),
                                        modifier = Modifier.size(230.dp)
                                    ) {}

                                    // Vinyl Disc Body
                                    Surface(
                                        shape = CircleShape,
                                        color = Color(0xFF16151E),
                                        border = BorderStroke(2.dp, Color(0xFF8B5CF6).copy(alpha = 0.45f)),
                                        shadowElevation = 14.dp,
                                        modifier = Modifier
                                            .size(210.dp)
                                            .then(if (isPlaying) Modifier.rotate(rotationAngle) else Modifier)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            // Concentric Groove lines
                                            Surface(
                                                shape = CircleShape,
                                                color = Color.Transparent,
                                                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
                                                modifier = Modifier.size(170.dp)
                                            ) {}
                                            Surface(
                                                shape = CircleShape,
                                                color = Color.Transparent,
                                                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
                                                modifier = Modifier.size(126.dp)
                                            ) {}

                                            // Center Hub Label
                                            Surface(
                                                shape = CircleShape,
                                                color = Color(0xFF8B5CF6).copy(alpha = 0.25f),
                                                border = BorderStroke(2.dp, Color(0xFF8B5CF6)),
                                                modifier = Modifier.size(76.dp)
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    if (isBuffering) {
                                                        CircularProgressIndicator(
                                                            color = Color(0xFFA78BFA),
                                                            strokeWidth = 3.dp,
                                                            modifier = Modifier.size(34.dp)
                                                        )
                                                    } else {
                                                        Icon(
                                                            imageVector = Icons.Rounded.Audiotrack,
                                                            contentDescription = null,
                                                            tint = Color.White,
                                                            modifier = Modifier.size(34.dp)
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(28.dp))

                                // 2. Track Title & Details
                                Text(
                                    text = file.name,
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White,
                                    textAlign = TextAlign.Center,
                                    maxLines = 2,
                                    modifier = Modifier.padding(horizontal = 16.dp)
                                )

                                Spacer(modifier = Modifier.height(6.dp))

                                Text(
                                    text = "${file.size} • Audio Track",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Color.White.copy(alpha = 0.65f)
                                )

                                Spacer(modifier = Modifier.height(24.dp))

                                // 3. Audio Progress Seek Bar & Timers
                                val progress = if (durationMs > 0L) {
                                    (currentPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
                                } else 0f

                                Slider(
                                    value = progress,
                                    onValueChange = { newProgress ->
                                        if (durationMs > 0L) {
                                            val targetMs = (newProgress * durationMs).toLong()
                                            exoPlayer?.seekTo(targetMs)
                                            currentPositionMs = targetMs
                                        }
                                    },
                                    colors = SliderDefaults.colors(
                                        thumbColor = Color(0xFFA78BFA),
                                        activeTrackColor = Color(0xFF8B5CF6),
                                        inactiveTrackColor = Color.White.copy(alpha = 0.2f)
                                    ),
                                    modifier = Modifier.fillMaxWidth()
                                )

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = formatDuration(currentPositionMs),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color.White.copy(alpha = 0.6f)
                                    )
                                    Text(
                                        text = formatDuration(durationMs),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color.White.copy(alpha = 0.6f)
                                    )
                                }

                                Spacer(modifier = Modifier.height(20.dp))

                                // 4. Playback Controls Row (Replay 10s, Play/Pause, Forward 10s)
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(28.dp)
                                ) {
                                    // Replay 10s
                                    IconButton(
                                        onClick = {
                                            val target = maxOf(0L, currentPositionMs - 10000L)
                                            exoPlayer?.seekTo(target)
                                            currentPositionMs = target
                                        },
                                        modifier = Modifier.size(48.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.Replay10,
                                            contentDescription = "Replay 10s",
                                            tint = Color.White,
                                            modifier = Modifier.size(32.dp)
                                        )
                                    }

                                    // Big Central Play / Pause Button
                                    Surface(
                                        shape = CircleShape,
                                        color = Color(0xFF8B5CF6),
                                        shadowElevation = 8.dp,
                                        onClick = {
                                            exoPlayer?.let { player ->
                                                if (player.isPlaying) {
                                                    player.pause()
                                                    isPlaying = false
                                                } else {
                                                    player.play()
                                                    isPlaying = true
                                                }
                                            }
                                        },
                                        modifier = Modifier.size(66.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            if (isBuffering) {
                                                CircularProgressIndicator(
                                                    color = Color.White,
                                                    strokeWidth = 2.5.dp,
                                                    modifier = Modifier.size(26.dp)
                                                )
                                            } else {
                                                Icon(
                                                    imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                                                    contentDescription = if (isPlaying) "Pause" else "Play",
                                                    tint = Color.White,
                                                    modifier = Modifier.size(36.dp)
                                                )
                                            }
                                        }
                                    }

                                    // Forward 10s
                                    IconButton(
                                        onClick = {
                                            val target = if (durationMs > 0L) minOf(durationMs, currentPositionMs + 10000L) else currentPositionMs + 10000L
                                            exoPlayer?.seekTo(target)
                                            currentPositionMs = target
                                        },
                                        modifier = Modifier.size(48.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.Forward10,
                                            contentDescription = "Forward 10s",
                                            tint = Color.White,
                                            modifier = Modifier.size(32.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // ── VIDEO PLAYER WITH LIVE BUFFERING INDICATOR ──
                FileCategoryType.VIDEO -> {
                    Box(modifier = Modifier.fillMaxSize()) {
                        if (playerError != null) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(24.dp)
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
                                        setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS)
                                        keepScreenOn = true
                                    }
                                },
                                modifier = Modifier.fillMaxSize()
                            )

                            // Live Buffering Overlay
                            if (isBuffering) {
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(16.dp),
                                        color = Color.Black.copy(alpha = 0.7f),
                                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.15f))
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 18.dp, vertical = 12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                                        ) {
                                            CircularProgressIndicator(
                                                color = BluePrimary,
                                                strokeWidth = 2.5.dp,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Text(
                                                text = "Buffering video...",
                                                color = Color.White,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                    }
                                }
                            }
                        } else {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(color = BluePrimary)
                            }
                        }
                    }
                }

                // ── IMAGE PREVIEW WITH CENTER LOADING SPINNER ──
                FileCategoryType.IMAGE -> {
                    val imageModel = remember(activeUrl, file.thumbnail) {
                        if (!activeUrl.isNullOrBlank()) activeUrl
                        else if (!file.thumbnail.isNullOrBlank()) file.thumbnail
                        else "https://drive.google.com/thumbnail?id=${file.id}&sz=w1600"
                    }
                    SubcomposeAsyncImage(
                        model = imageModel,
                        contentDescription = file.name,
                        contentScale = ContentScale.Fit,
                        loading = {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(
                                    color = BluePrimary,
                                    strokeWidth = 2.5.dp,
                                    modifier = Modifier.size(36.dp)
                                )
                            }
                        },
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

                // ── DOCUMENT PREVIEW (WEBVIEW) ──
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
                    // APK / Archive Details Card
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
