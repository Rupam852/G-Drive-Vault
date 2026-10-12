package com.rupam.drivevault.ui.screens

import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.SubcomposeAsyncImage
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.model.FileCategoryType
import com.rupam.drivevault.ui.components.getCategoryIcon
import com.rupam.drivevault.ui.components.SquigglySlider
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
    val context = LocalContext.current
    val configuration = LocalConfiguration.current
    val isDeviceLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
    var isFullscreenMode by remember { mutableStateOf(false) }
    var resizeMode by remember { mutableIntStateOf(AspectRatioFrameLayout.RESIZE_MODE_FIT) }
    var areVideoControlsVisible by remember { mutableStateOf(true) }
    var lastInteractionTime by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var doubleTapSeekFeedback by remember { mutableStateOf<String?>(null) }

    val activity = context as? Activity
    val window = activity?.window
    val insetsController = remember(window) {
        window?.let { WindowCompat.getInsetsController(it, it.decorView) }
    }

    val isImmersive = file.type == FileCategoryType.VIDEO && (isFullscreenMode || isDeviceLandscape)

    // System Status & Navigation Bar immersive hiding
    DisposableEffect(isImmersive) {
        if (isImmersive) {
            insetsController?.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            insetsController?.hide(WindowInsetsCompat.Type.systemBars())
        } else {
            insetsController?.show(WindowInsetsCompat.Type.systemBars())
        }
        onDispose {
            insetsController?.show(WindowInsetsCompat.Type.systemBars())
        }
    }

    // Restore orientation and system bars on exit
    DisposableEffect(Unit) {
        onDispose {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            insetsController?.show(WindowInsetsCompat.Type.systemBars())
        }
    }

    // Intercept back gesture: exit fullscreen landscape first if active
    BackHandler {
        if (isFullscreenMode || isDeviceLandscape) {
            isFullscreenMode = false
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        } else {
            onClose()
        }
    }

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

    // Auto-hide controls after 3.5s of playback with no touch
    LaunchedEffect(areVideoControlsVisible, lastInteractionTime, isPlaying) {
        if (file.type == FileCategoryType.VIDEO && areVideoControlsVisible && isPlaying) {
            delay(3500)
            areVideoControlsVisible = false
        }
    }

    // Double-tap badge timeout
    LaunchedEffect(doubleTapSeekFeedback) {
        if (doubleTapSeekFeedback != null) {
            delay(750)
            doubleTapSeekFeedback = null
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

                                SquigglySlider(
                                    value = progress,
                                    isPlaying = isPlaying,
                                    onValueChange = { newProgress ->
                                        if (durationMs > 0L) {
                                            val targetMs = (newProgress * durationMs).toLong()
                                            exoPlayer?.seekTo(targetMs)
                                            currentPositionMs = targetMs
                                        }
                                    },
                                    activeColor = Color(0xFFA78BFA),
                                    inactiveColor = Color.White.copy(alpha = 0.22f),
                                    thumbColor = Color.White,
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

                // ── VIDEO PLAYER WITH TOUCH CONTROLS & IMMERSIVE LANDSCAPE ──
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
                            // 1. AndroidView Video Surface
                            AndroidView(
                                factory = { ctx ->
                                    PlayerView(ctx).apply {
                                        player = exoPlayer
                                        layoutParams = FrameLayout.LayoutParams(
                                            ViewGroup.LayoutParams.MATCH_PARENT,
                                            ViewGroup.LayoutParams.MATCH_PARENT
                                        )
                                        useController = false
                                        setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
                                        keepScreenOn = true
                                        this.resizeMode = resizeMode
                                    }
                                },
                                update = { playerView ->
                                    playerView.player = exoPlayer
                                    playerView.resizeMode = resizeMode
                                },
                                modifier = Modifier.fillMaxSize()
                            )

                            // 2. Gesture Detector Layer (Tap to toggle controls, Double tap to seek +/-10s)
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .pointerInput(Unit) {
                                        detectTapGestures(
                                            onTap = {
                                                areVideoControlsVisible = !areVideoControlsVisible
                                                lastInteractionTime = System.currentTimeMillis()
                                            },
                                            onDoubleTap = { offset ->
                                                lastInteractionTime = System.currentTimeMillis()
                                                areVideoControlsVisible = true
                                                if (offset.x < size.width / 2) {
                                                    val target = maxOf(0L, currentPositionMs - 10000L)
                                                    exoPlayer?.seekTo(target)
                                                    currentPositionMs = target
                                                    doubleTapSeekFeedback = "-10s"
                                                } else {
                                                    val target = if (durationMs > 0L) minOf(durationMs, currentPositionMs + 10000L) else currentPositionMs + 10000L
                                                    exoPlayer?.seekTo(target)
                                                    currentPositionMs = target
                                                    doubleTapSeekFeedback = "+10s"
                                                }
                                            }
                                        )
                                    }
                            )

                            // 3. Live Buffering Overlay
                            if (isBuffering) {
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(16.dp),
                                        color = Color.Black.copy(alpha = 0.75f),
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

                            // 4. Double-Tap Seek Feedback Badge
                            if (doubleTapSeekFeedback != null) {
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = if (doubleTapSeekFeedback == "-10s") Alignment.CenterStart else Alignment.CenterEnd
                                ) {
                                    Surface(
                                        shape = CircleShape,
                                        color = Color.Black.copy(alpha = 0.7f),
                                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.2f)),
                                        modifier = Modifier.padding(horizontal = 40.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Icon(
                                                imageVector = if (doubleTapSeekFeedback == "-10s") Icons.Rounded.Replay10 else Icons.Rounded.Forward10,
                                                contentDescription = null,
                                                tint = Color.White,
                                                modifier = Modifier.size(22.dp)
                                            )
                                            Text(
                                                text = doubleTapSeekFeedback ?: "",
                                                color = Color.White,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 14.sp
                                            )
                                        }
                                    }
                                }
                            }

                            // 5. Center Play / Pause / 10s Rewind / 10s Forward Controls
                            AnimatedVisibility(
                                visible = areVideoControlsVisible,
                                enter = fadeIn(tween(250)),
                                exit = fadeOut(tween(250)),
                                modifier = Modifier.align(Alignment.Center)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(28.dp)
                                ) {
                                    // Rewind 10s
                                    Surface(
                                        shape = CircleShape,
                                        color = Color.Black.copy(alpha = 0.6f),
                                        onClick = {
                                            lastInteractionTime = System.currentTimeMillis()
                                            val target = maxOf(0L, currentPositionMs - 10000L)
                                            exoPlayer?.seekTo(target)
                                            currentPositionMs = target
                                        },
                                        modifier = Modifier.size(48.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = Icons.Rounded.Replay10,
                                                contentDescription = "Rewind 10s",
                                                tint = Color.White,
                                                modifier = Modifier.size(28.dp)
                                            )
                                        }
                                    }

                                    // Main Play / Pause Button
                                    Surface(
                                        shape = CircleShape,
                                        color = BluePrimary,
                                        shadowElevation = 8.dp,
                                        onClick = {
                                            lastInteractionTime = System.currentTimeMillis()
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
                                        modifier = Modifier.size(64.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                                                contentDescription = if (isPlaying) "Pause" else "Play",
                                                tint = Color.White,
                                                modifier = Modifier.size(36.dp)
                                            )
                                        }
                                    }

                                    // Fast Forward 10s
                                    Surface(
                                        shape = CircleShape,
                                        color = Color.Black.copy(alpha = 0.6f),
                                        onClick = {
                                            lastInteractionTime = System.currentTimeMillis()
                                            val target = if (durationMs > 0L) minOf(durationMs, currentPositionMs + 10000L) else currentPositionMs + 10000L
                                            exoPlayer?.seekTo(target)
                                            currentPositionMs = target
                                        },
                                        modifier = Modifier.size(48.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = Icons.Rounded.Forward10,
                                                contentDescription = "Forward 10s",
                                                tint = Color.White,
                                                modifier = Modifier.size(28.dp)
                                            )
                                        }
                                    }
                                }
                            }

                            // 6. Bottom Video Control Bar (Timeline Scrubber & Fullscreen Toggle)
                            AnimatedVisibility(
                                visible = areVideoControlsVisible,
                                enter = fadeIn(tween(250)),
                                exit = fadeOut(tween(250)),
                                modifier = Modifier.align(Alignment.BottomCenter)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(
                                            Brush.verticalGradient(
                                                colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.88f))
                                            )
                                        )
                                        .padding(horizontal = 20.dp, vertical = if (isImmersive) 14.dp else 24.dp)
                                ) {
                                    Column(modifier = Modifier.fillMaxWidth()) {
                                        // Timeline Scrubber
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            Text(
                                                text = formatDuration(currentPositionMs),
                                                color = Color.White,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium
                                            )

                                            var isDraggingSlider by remember { mutableStateOf(false) }
                                            var dragPositionMs by remember { mutableFloatStateOf(0f) }

                                            Slider(
                                                value = if (isDraggingSlider) dragPositionMs else currentPositionMs.toFloat(),
                                                onValueChange = {
                                                    isDraggingSlider = true
                                                    dragPositionMs = it
                                                    lastInteractionTime = System.currentTimeMillis()
                                                },
                                                onValueChangeFinished = {
                                                    isDraggingSlider = false
                                                    exoPlayer?.seekTo(dragPositionMs.toLong())
                                                    currentPositionMs = dragPositionMs.toLong()
                                                    lastInteractionTime = System.currentTimeMillis()
                                                },
                                                valueRange = 0f..(if (durationMs > 0L) durationMs.toFloat() else 1f),
                                                colors = SliderDefaults.colors(
                                                    thumbColor = BluePrimary,
                                                    activeTrackColor = BluePrimary,
                                                    inactiveTrackColor = Color.White.copy(alpha = 0.25f)
                                                ),
                                                modifier = Modifier.weight(1f)
                                            )

                                            Text(
                                                text = formatDuration(durationMs),
                                                color = Color.White.copy(alpha = 0.7f),
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }

                                        // Quick Actions Row (Aspect Ratio & Fullscreen)
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(top = 4.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            // Aspect Ratio Toggle
                                            Surface(
                                                shape = RoundedCornerShape(8.dp),
                                                color = Color.White.copy(alpha = 0.12f),
                                                onClick = {
                                                    lastInteractionTime = System.currentTimeMillis()
                                                    resizeMode = if (resizeMode == AspectRatioFrameLayout.RESIZE_MODE_FIT) {
                                                        AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                                                    } else {
                                                        AspectRatioFrameLayout.RESIZE_MODE_FIT
                                                    }
                                                }
                                            ) {
                                                Row(
                                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    Icon(
                                                        imageVector = Icons.Rounded.AspectRatio,
                                                        contentDescription = "Aspect Ratio",
                                                        tint = Color.White,
                                                        modifier = Modifier.size(16.dp)
                                                    )
                                                    Text(
                                                        text = if (resizeMode == AspectRatioFrameLayout.RESIZE_MODE_FIT) "Fit Screen" else "Fill Screen",
                                                        color = Color.White,
                                                        fontSize = 11.sp,
                                                        fontWeight = FontWeight.Medium
                                                    )
                                                }
                                            }

                                            // Fullscreen / Landscape Toggle
                                            IconButton(
                                                onClick = {
                                                    lastInteractionTime = System.currentTimeMillis()
                                                    val newMode = !(isFullscreenMode || isDeviceLandscape)
                                                    isFullscreenMode = newMode
                                                    if (newMode) {
                                                        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                                                    } else {
                                                        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                                                    }
                                                }
                                            ) {
                                                Icon(
                                                    imageVector = if (isFullscreenMode || isDeviceLandscape) Icons.Rounded.FullscreenExit else Icons.Rounded.Fullscreen,
                                                    contentDescription = if (isFullscreenMode || isDeviceLandscape) "Exit Fullscreen" else "Enter Fullscreen",
                                                    tint = Color.White,
                                                    modifier = Modifier.size(28.dp)
                                                )
                                            }
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
        val showTopNav = if (file.type == FileCategoryType.VIDEO) areVideoControlsVisible else true

        AnimatedVisibility(
            visible = showTopNav,
            enter = fadeIn(tween(250)),
            exit = fadeOut(tween(250)),
            modifier = Modifier.align(Alignment.TopCenter)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = if (isImmersive) 14.dp else 36.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = CircleShape,
                    color = Color.Black.copy(alpha = 0.6f),
                    onClick = {
                        if (isFullscreenMode || isDeviceLandscape) {
                            isFullscreenMode = false
                            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                        } else {
                            onClose()
                        }
                    }
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
}
