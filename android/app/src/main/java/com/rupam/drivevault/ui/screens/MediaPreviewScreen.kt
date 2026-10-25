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
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.*
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
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.SubcomposeAsyncImage
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.model.FileCategoryType
import com.rupam.drivevault.ui.components.getCategoryIcon
import com.rupam.drivevault.ui.components.SquigglySlider
import com.rupam.drivevault.ui.components.YouTubeVideoSlider
import com.rupam.drivevault.ui.components.NativePdfViewer
import com.rupam.drivevault.ui.components.NativeDocPreview
import com.rupam.drivevault.ui.theme.BluePrimary
import kotlinx.coroutines.delay

enum class VideoSettingSection {
    MAIN, SPEED, QUALITY, AUDIO, SUBTITLES
}

data class AvailableTrack(
    val groupIndex: Int,
    val trackIndex: Int,
    val label: String,
    val language: String,
    val isSelected: Boolean
)

private fun formatDuration(ms: Long, referenceDurationMs: Long = ms): String {
    if (ms <= 0L && referenceDurationMs <= 0L) return "00:00"
    val safeMs = maxOf(0L, ms)
    val totalSeconds = safeMs / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60

    val refSeconds = maxOf(0L, referenceDurationMs) / 1000
    val refHours = refSeconds / 3600

    return if (refHours > 0 || hours > 0) {
        String.format(java.util.Locale.US, "%02d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format(java.util.Locale.US, "%02d:%02d", minutes, seconds)
    }
}

@SuppressLint("SetJavaScriptEnabled")
@OptIn(ExperimentalMaterial3Api::class, UnstableApi::class)
@Composable
fun MediaPreviewScreen(
    file: DriveFile,
    streamUrl: String?,
    fallbackUrl: String? = null,
    onClose: () -> Unit,
    onDownload: () -> Unit,
    onShare: () -> Unit,
    onDelete: () -> Unit,
    isHighQuality: Boolean = true,
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

    fun exitFullscreen() {
        isFullscreenMode = false
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    }

    fun enterFullscreen() {
        isFullscreenMode = true
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    }

    fun toggleFullscreen() {
        val isCurrentlyLandscape = isFullscreenMode || isDeviceLandscape
        if (isCurrentlyLandscape) {
            exitFullscreen()
        } else {
            enterFullscreen()
        }
    }

    // Settings state
    var currentTracks by remember { mutableStateOf<Tracks?>(null) }
    var playbackSpeed by remember { mutableFloatStateOf(1.0f) }
    var showSettingsSheet by remember { mutableStateOf(false) }
    var activeSettingSection by remember { mutableStateOf(VideoSettingSection.MAIN) }

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

    // Intercept back gesture: exit settings first, then fullscreen landscape, then close
    BackHandler {
        if (showSettingsSheet) {
            showSettingsSheet = false
        } else if (isFullscreenMode || isDeviceLandscape) {
            exitFullscreen()
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

            val renderersFactory = DefaultRenderersFactory(context)
                .setEnableDecoderFallback(true)
                .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)

            val loadControl = DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                    if (isHighQuality) 50000 else 15000,
                    if (isHighQuality) 50000 else 25000,
                    if (isHighQuality) 2500 else 1500,
                    if (isHighQuality) 5000 else 2500
                )
                .build()

            val player = ExoPlayer.Builder(context, renderersFactory)
                .setAudioAttributes(audioAttributes, true)
                .setLoadControl(loadControl)
                .build()
                .apply {
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
                            val rawMsg = error.message ?: ""
                            val friendlyMsg = when {
                                rawMsg.contains("NO_EXCEEDS_CAPABILITIES", ignoreCase = true) ||
                                (rawMsg.contains("MediaCodecVideoRenderer", ignoreCase = true) && rawMsg.contains("hevc", ignoreCase = true)) -> {
                                    "Your device's hardware chip does not support 10-Bit HEVC (H.265) video decoding. You can play it directly using an external player (VLC / MX Player) or download it."
                                }
                                rawMsg.contains("MediaCodec", ignoreCase = true) -> {
                                    "Your device cannot decode this video codec natively. Open it in an external player (VLC / MX Player) or download it."
                                }
                                else -> rawMsg.ifBlank { "Failed to stream media" }
                            }
                            playerError = friendlyMsg
                            isBuffering = false
                        }
                    }

                    override fun onTracksChanged(tracks: Tracks) {
                        currentTracks = tracks
                    }
                })
                setPlaybackSpeed(playbackSpeed)
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

    // Extract available audio tracks
    val audioTracks = remember(currentTracks) {
        val list = mutableListOf<AvailableTrack>()
        currentTracks?.groups?.forEachIndexed { gIdx, group ->
            if (group.type == C.TRACK_TYPE_AUDIO) {
                for (tIdx in 0 until group.length) {
                    val format = group.getTrackFormat(tIdx)
                    val lang = format.language ?: "und"
                    val label = format.label ?: if (lang != "und") lang.uppercase() else "Audio Track ${tIdx + 1}"
                    list.add(
                        AvailableTrack(
                            groupIndex = gIdx,
                            trackIndex = tIdx,
                            label = label,
                            language = lang,
                            isSelected = group.isTrackSelected(tIdx)
                        )
                    )
                }
            }
        }
        list
    }

    // Extract available subtitle tracks
    val subtitleTracks = remember(currentTracks) {
        val list = mutableListOf<AvailableTrack>()
        currentTracks?.groups?.forEachIndexed { gIdx, group ->
            if (group.type == C.TRACK_TYPE_TEXT) {
                for (tIdx in 0 until group.length) {
                    val format = group.getTrackFormat(tIdx)
                    val lang = format.language ?: "und"
                    val label = format.label ?: if (lang != "und") lang.uppercase() else "Subtitle ${tIdx + 1}"
                    list.add(
                        AvailableTrack(
                            groupIndex = gIdx,
                            trackIndex = tIdx,
                            label = label,
                            language = lang,
                            isSelected = group.isTrackSelected(tIdx)
                        )
                    )
                }
            }
        }
        list
    }

    fun selectAudio(track: AvailableTrack) {
        exoPlayer?.let { player ->
            val group = player.currentTracks.groups.getOrNull(track.groupIndex) ?: return
            player.trackSelectionParameters = player.trackSelectionParameters
                .buildUpon()
                .setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, track.trackIndex))
                .build()
        }
    }

    fun selectSubtitle(track: AvailableTrack?) {
        exoPlayer?.let { player ->
            if (track == null) {
                player.trackSelectionParameters = player.trackSelectionParameters
                    .buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                    .build()
            } else {
                val group = player.currentTracks.groups.getOrNull(track.groupIndex) ?: return
                player.trackSelectionParameters = player.trackSelectionParameters
                    .buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                    .setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, track.trackIndex))
                    .build()
            }
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
                                        text = formatDuration(currentPositionMs, durationMs),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color.White.copy(alpha = 0.6f)
                                    )
                                    Text(
                                        text = formatDuration(durationMs, durationMs),
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
                                    .padding(horizontal = 28.dp, vertical = 24.dp)
                            ) {
                                Surface(
                                    shape = CircleShape,
                                    color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.25f),
                                    border = BorderStroke(1.5.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.45f)),
                                    modifier = Modifier.size(68.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = Icons.Rounded.ErrorOutline,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.error,
                                            modifier = Modifier.size(36.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(18.dp))
                                Text(
                                    text = "Codec Not Supported by Phone Hardware",
                                    color = Color.White,
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = playerError ?: "Cannot stream file",
                                    color = Color.White.copy(alpha = 0.75f),
                                    fontSize = 13.sp,
                                    lineHeight = 18.sp,
                                    textAlign = TextAlign.Center
                                )
                                Spacer(modifier = Modifier.height(24.dp))

                                // Play in External Player Button (VLC / MX Player)
                                Button(
                                    onClick = {
                                        try {
                                            val streamUri = Uri.parse(activeUrl)
                                            val intent = Intent(Intent.ACTION_VIEW).apply {
                                                setDataAndType(streamUri, "video/*")
                                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                            }
                                            context.startActivity(Intent.createChooser(intent, "Play with..."))
                                        } catch (e: Exception) {
                                            Toast.makeText(context, "No external video player found (install VLC or MX Player)", Toast.LENGTH_LONG).show()
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = BluePrimary,
                                        contentColor = Color.White
                                    ),
                                    shape = RoundedCornerShape(14.dp),
                                    modifier = Modifier
                                        .fillMaxWidth(0.9f)
                                        .height(48.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.PlayArrow,
                                        contentDescription = null,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Play in VLC / MX Player",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp
                                    )
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                // Download Locally Button
                                OutlinedButton(
                                    onClick = onDownload,
                                    shape = RoundedCornerShape(14.dp),
                                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.25f)),
                                    modifier = Modifier
                                        .fillMaxWidth(0.9f)
                                        .height(46.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Download,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Download to Play Locally",
                                        color = Color.White,
                                        fontSize = 13.sp
                                    )
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
                                                text = formatDuration(currentPositionMs, durationMs),
                                                color = Color.White,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium
                                            )

                                            var isDraggingSlider by remember { mutableStateOf(false) }
                                            var dragPositionMs by remember { mutableLongStateOf(0L) }

                                            val bufferedPos = exoPlayer?.bufferedPosition ?: 0L

                                            YouTubeVideoSlider(
                                                positionMs = if (isDraggingSlider) dragPositionMs else currentPositionMs,
                                                durationMs = durationMs,
                                                bufferedPositionMs = bufferedPos,
                                                onSeekStarted = {
                                                    isDraggingSlider = true
                                                    lastInteractionTime = System.currentTimeMillis()
                                                },
                                                onSeekProgress = { targetMs ->
                                                    dragPositionMs = targetMs
                                                    lastInteractionTime = System.currentTimeMillis()
                                                },
                                                onSeekFinished = { targetMs ->
                                                    isDraggingSlider = false
                                                    exoPlayer?.seekTo(targetMs)
                                                    currentPositionMs = targetMs
                                                    lastInteractionTime = System.currentTimeMillis()
                                                },
                                                activeColor = BluePrimary,
                                                thumbColor = BluePrimary,
                                                modifier = Modifier.weight(1f)
                                            )

                                            Text(
                                                text = formatDuration(durationMs, durationMs),
                                                color = Color.White.copy(alpha = 0.7f),
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }

                                        // Adaptive Quick Actions Row (Portrait vs Landscape)
                                        if (!isDeviceLandscape && !isFullscreenMode) {
                                            // ── PORTRAIT MODE: Clean compact layout with 3-Dot Menu ──
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

                                                // Right: 3-Dot Settings & Fullscreen Toggle
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                ) {
                                                    IconButton(
                                                        onClick = {
                                                            lastInteractionTime = System.currentTimeMillis()
                                                            activeSettingSection = VideoSettingSection.MAIN
                                                            showSettingsSheet = true
                                                        }
                                                    ) {
                                                        Icon(
                                                            imageVector = Icons.Rounded.MoreVert,
                                                            contentDescription = "Video Settings",
                                                            tint = Color.White,
                                                            modifier = Modifier.size(24.dp)
                                                        )
                                                    }

                                                    IconButton(
                                                        onClick = {
                                                            lastInteractionTime = System.currentTimeMillis()
                                                            enterFullscreen()
                                                        }
                                                    ) {
                                                        Icon(
                                                            imageVector = Icons.Rounded.Fullscreen,
                                                            contentDescription = "Enter Fullscreen",
                                                            tint = Color.White,
                                                            modifier = Modifier.size(28.dp)
                                                        )
                                                    }
                                                }
                                            }
                                        } else {
                                            // ── LANDSCAPE MODE: Full Spacious Quick Actions Bar ──
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(top = 4.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                // Horizontal scrollable pills
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                                    modifier = Modifier
                                                        .weight(1f, fill = false)
                                                        .horizontalScroll(rememberScrollState())
                                                ) {
                                                    // Aspect Ratio Pill
                                                    Surface(
                                                        shape = RoundedCornerShape(8.dp),
                                                        color = Color.White.copy(alpha = 0.14f),
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
                                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                        ) {
                                                            Icon(Icons.Rounded.AspectRatio, contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp))
                                                            Text(if (resizeMode == AspectRatioFrameLayout.RESIZE_MODE_FIT) "Fit" else "Fill", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                                        }
                                                    }

                                                    // Speed Pill
                                                    Surface(
                                                        shape = RoundedCornerShape(8.dp),
                                                        color = Color.White.copy(alpha = 0.14f),
                                                        onClick = {
                                                            lastInteractionTime = System.currentTimeMillis()
                                                            activeSettingSection = VideoSettingSection.SPEED
                                                            showSettingsSheet = true
                                                        }
                                                    ) {
                                                        Row(
                                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                                            verticalAlignment = Alignment.CenterVertically,
                                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                        ) {
                                                            Icon(Icons.Rounded.Speed, contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp))
                                                            Text("${playbackSpeed}x", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                                        }
                                                    }

                                                    // Audio Track Pill
                                                    Surface(
                                                        shape = RoundedCornerShape(8.dp),
                                                        color = Color.White.copy(alpha = 0.14f),
                                                        onClick = {
                                                            lastInteractionTime = System.currentTimeMillis()
                                                            activeSettingSection = VideoSettingSection.AUDIO
                                                            showSettingsSheet = true
                                                        }
                                                    ) {
                                                        Row(
                                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                                            verticalAlignment = Alignment.CenterVertically,
                                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                        ) {
                                                            Icon(Icons.Rounded.Audiotrack, contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp))
                                                            val currentAudioName = audioTracks.find { it.isSelected }?.label ?: if (audioTracks.isNotEmpty()) "Audio (${audioTracks.size})" else "Audio"
                                                            Text(currentAudioName, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                                        }
                                                    }

                                                    // Subtitles (CC) Pill
                                                    Surface(
                                                        shape = RoundedCornerShape(8.dp),
                                                        color = Color.White.copy(alpha = 0.14f),
                                                        onClick = {
                                                            lastInteractionTime = System.currentTimeMillis()
                                                            activeSettingSection = VideoSettingSection.SUBTITLES
                                                            showSettingsSheet = true
                                                        }
                                                    ) {
                                                        Row(
                                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                                            verticalAlignment = Alignment.CenterVertically,
                                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                        ) {
                                                            Icon(Icons.Rounded.Subtitles, contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp))
                                                            val isSubOn = subtitleTracks.any { it.isSelected }
                                                            Text(if (isSubOn) "CC On" else "CC", color = if (isSubOn) Color(0xFF34D399) else Color.White, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                                        }
                                                    }

                                                    // Quality Pill
                                                    Surface(
                                                        shape = RoundedCornerShape(8.dp),
                                                        color = Color.White.copy(alpha = 0.14f),
                                                        onClick = {
                                                            lastInteractionTime = System.currentTimeMillis()
                                                            activeSettingSection = VideoSettingSection.QUALITY
                                                            showSettingsSheet = true
                                                        }
                                                    ) {
                                                        Row(
                                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                                            verticalAlignment = Alignment.CenterVertically,
                                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                        ) {
                                                            Icon(Icons.Rounded.HighQuality, contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp))
                                                            val isCdn = activeUrl?.contains("workers") == true || activeUrl?.contains("cloudflare") == true
                                                            Text(if (isCdn) "Edge CDN" else "Direct", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                                        }
                                                    }
                                                }

                                                // Right: 3-Dot Menu & Exit Fullscreen Button
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                ) {
                                                    IconButton(
                                                        onClick = {
                                                            lastInteractionTime = System.currentTimeMillis()
                                                            activeSettingSection = VideoSettingSection.MAIN
                                                            showSettingsSheet = true
                                                        }
                                                    ) {
                                                        Icon(
                                                            imageVector = Icons.Rounded.MoreVert,
                                                            contentDescription = "Settings",
                                                            tint = Color.White,
                                                            modifier = Modifier.size(24.dp)
                                                        )
                                                    }

                                                    IconButton(
                                                        onClick = {
                                                            lastInteractionTime = System.currentTimeMillis()
                                                            exitFullscreen()
                                                        }
                                                    ) {
                                                        Icon(
                                                            imageVector = Icons.Rounded.FullscreenExit,
                                                            contentDescription = "Exit Fullscreen",
                                                            tint = Color.White,
                                                            modifier = Modifier.size(30.dp)
                                                        )
                                                    }
                                                }
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

                // ── DOCUMENT PREVIEW (NATIVE PDF OR NATIVE PPT/DOC/XLS PREVIEW) ──
                FileCategoryType.DOCUMENT -> {
                    val isPdf = file.name.endsWith(".pdf", ignoreCase = true) || file.mimeType?.contains("pdf") == true
                    if (isPdf) {
                        NativePdfViewer(
                            file = file,
                            streamUrl = activeUrl ?: streamUrl,
                            fallbackUrl = fallbackUrl,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        NativeDocPreview(
                            file = file,
                            streamUrl = activeUrl ?: streamUrl,
                            fallbackUrl = fallbackUrl,
                            onDownload = onDownload,
                            modifier = Modifier.fillMaxSize()
                        )
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

        // ── Video Settings Modal / Sheet ──
        if (showSettingsSheet) {
            VideoSettingsModal(
                activeSection = activeSettingSection,
                onSectionChange = { activeSettingSection = it },
                playbackSpeed = playbackSpeed,
                onSpeedChange = { speed ->
                    playbackSpeed = speed
                    exoPlayer?.setPlaybackSpeed(speed)
                    showSettingsSheet = false
                },
                audioTracks = audioTracks,
                onAudioTrackSelect = { track ->
                    selectAudio(track)
                    showSettingsSheet = false
                },
                subtitleTracks = subtitleTracks,
                onSubtitleTrackSelect = { track ->
                    selectSubtitle(track)
                    showSettingsSheet = false
                },
                resizeMode = resizeMode,
                onResizeModeChange = { mode ->
                    resizeMode = mode
                },
                isCloudflare = activeUrl?.contains("workers") == true || activeUrl?.contains("cloudflare") == true,
                hasFallback = !fallbackUrl.isNullOrBlank() && fallbackUrl != streamUrl,
                onSwitchQuality = { useFallback ->
                    val target = if (useFallback) fallbackUrl else streamUrl
                    if (!target.isNullOrBlank() && target != activeUrl) {
                        activeUrl = target
                    }
                    showSettingsSheet = false
                },
                onDismiss = { showSettingsSheet = false }
            )
        }
    }
}

@Composable
private fun VideoSettingsModal(
    activeSection: VideoSettingSection,
    onSectionChange: (VideoSettingSection) -> Unit,
    playbackSpeed: Float,
    onSpeedChange: (Float) -> Unit,
    audioTracks: List<AvailableTrack>,
    onAudioTrackSelect: (AvailableTrack) -> Unit,
    subtitleTracks: List<AvailableTrack>,
    onSubtitleTrackSelect: (AvailableTrack?) -> Unit,
    resizeMode: Int,
    onResizeModeChange: (Int) -> Unit,
    isCloudflare: Boolean,
    hasFallback: Boolean,
    onSwitchQuality: (Boolean) -> Unit,
    onDismiss: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.65f))
            .clickable(onClick = onDismiss),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = Color(0xFF181724),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.14f)),
            shadowElevation = 16.dp,
            modifier = Modifier
                .padding(20.dp)
                .widthIn(max = 420.dp)
                .fillMaxWidth(0.92f)
                .clickable(enabled = false) {}
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (activeSection != VideoSettingSection.MAIN) {
                            IconButton(onClick = { onSectionChange(VideoSettingSection.MAIN) }) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                                    contentDescription = "Back",
                                    tint = Color.White
                                )
                            }
                        }
                        Text(
                            text = when (activeSection) {
                                VideoSettingSection.MAIN -> "Video Settings"
                                VideoSettingSection.SPEED -> "Playback Speed"
                                VideoSettingSection.AUDIO -> "Audio Tracks"
                                VideoSettingSection.SUBTITLES -> "Subtitles / Captions"
                                VideoSettingSection.QUALITY -> "Streaming Quality"
                            },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }

                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Rounded.Close,
                            contentDescription = "Close",
                            tint = Color.White.copy(alpha = 0.7f)
                        )
                    }
                }

                HorizontalDivider(
                    color = Color.White.copy(alpha = 0.1f),
                    modifier = Modifier.padding(vertical = 12.dp)
                )

                when (activeSection) {
                    VideoSettingSection.MAIN -> {
                        // 1. Playback Speed
                        SettingsRowItem(
                            icon = Icons.Rounded.Speed,
                            title = "Playback Speed",
                            subtitle = "${playbackSpeed}x ${if (playbackSpeed == 1.0f) "(Normal)" else ""}",
                            onClick = { onSectionChange(VideoSettingSection.SPEED) }
                        )

                        // 2. Audio Track / Language
                        val currentAudio = audioTracks.find { it.isSelected }?.label ?: if (audioTracks.isNotEmpty()) "Audio (1)" else "Default"
                        SettingsRowItem(
                            icon = Icons.Rounded.Audiotrack,
                            title = "Audio Language",
                            subtitle = currentAudio,
                            onClick = { onSectionChange(VideoSettingSection.AUDIO) }
                        )

                        // 3. Subtitles
                        val currentSub = subtitleTracks.find { it.isSelected }?.label ?: "Off"
                        SettingsRowItem(
                            icon = Icons.Rounded.Subtitles,
                            title = "Subtitles",
                            subtitle = if (subtitleTracks.isEmpty()) "None in video" else currentSub,
                            onClick = { onSectionChange(VideoSettingSection.SUBTITLES) }
                        )

                        // 4. Quality
                        SettingsRowItem(
                            icon = Icons.Rounded.HighQuality,
                            title = "Quality / Server",
                            subtitle = if (isCloudflare) "Cloudflare Edge CDN (Ultra-Fast)" else "Render Standard Server",
                            onClick = { onSectionChange(VideoSettingSection.QUALITY) }
                        )

                        // 5. Aspect Ratio
                        SettingsRowItem(
                            icon = Icons.Rounded.AspectRatio,
                            title = "Aspect Ratio",
                            subtitle = if (resizeMode == AspectRatioFrameLayout.RESIZE_MODE_FIT) "Fit to Screen" else "Fill Screen (Zoom)",
                            onClick = {
                                onResizeModeChange(
                                    if (resizeMode == AspectRatioFrameLayout.RESIZE_MODE_FIT) AspectRatioFrameLayout.RESIZE_MODE_ZOOM else AspectRatioFrameLayout.RESIZE_MODE_FIT
                                )
                            }
                        )
                    }

                    VideoSettingSection.SPEED -> {
                        val speeds = listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
                        speeds.forEach { sp ->
                            val isSelected = playbackSpeed == sp
                            SettingsOptionItem(
                                title = "${sp}x ${if (sp == 1.0f) "(Normal)" else ""}",
                                isSelected = isSelected,
                                onClick = { onSpeedChange(sp) }
                            )
                        }
                    }

                    VideoSettingSection.AUDIO -> {
                        if (audioTracks.isEmpty()) {
                            Text(
                                text = "Default single audio track in this video file.",
                                color = Color.White.copy(alpha = 0.6f),
                                fontSize = 13.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        } else {
                            audioTracks.forEach { track ->
                                SettingsOptionItem(
                                    title = track.label,
                                    subtitle = if (track.language != "und") track.language.uppercase() else null,
                                    isSelected = track.isSelected,
                                    onClick = { onAudioTrackSelect(track) }
                                )
                            }
                        }
                    }

                    VideoSettingSection.SUBTITLES -> {
                        val isNoneSelected = subtitleTracks.none { it.isSelected }
                        SettingsOptionItem(
                            title = "Off",
                            isSelected = isNoneSelected,
                            onClick = { onSubtitleTrackSelect(null) }
                        )
                        if (subtitleTracks.isEmpty()) {
                            Text(
                                text = "No embedded subtitle streams detected in this file.",
                                color = Color.White.copy(alpha = 0.5f),
                                fontSize = 13.sp,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                            )
                        } else {
                            subtitleTracks.forEach { track ->
                                SettingsOptionItem(
                                    title = track.label,
                                    subtitle = if (track.language != "und") track.language.uppercase() else null,
                                    isSelected = track.isSelected,
                                    onClick = { onSubtitleTrackSelect(track) }
                                )
                            }
                        }
                    }

                    VideoSettingSection.QUALITY -> {
                        SettingsOptionItem(
                            title = "Cloudflare Edge CDN (Ultra-Fast)",
                            subtitle = "Low-latency streaming via worldwide edge caching",
                            isSelected = isCloudflare,
                            onClick = { onSwitchQuality(false) }
                        )
                        if (hasFallback) {
                            SettingsOptionItem(
                                title = "Render Server (Direct Stream)",
                                subtitle = "Fallback connection direct to Drive rendering",
                                isSelected = !isCloudflare,
                                onClick = { onSwitchQuality(true) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsRowItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Color.Transparent,
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.weight(1f)
            ) {
                Icon(imageVector = icon, contentDescription = null, tint = BluePrimary, modifier = Modifier.size(22.dp))
                Column {
                    Text(text = title, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text(text = subtitle, color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
                }
            }
            Icon(
                imageVector = Icons.AutoMirrored.Rounded.ArrowForwardIos,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.35f),
                modifier = Modifier.size(14.dp)
            )
        }
    }
}

@Composable
private fun SettingsOptionItem(
    title: String,
    subtitle: String? = null,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected) BluePrimary.copy(alpha = 0.15f) else Color.Transparent,
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    color = if (isSelected) BluePrimary else Color.White,
                    fontSize = 14.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                )
                if (subtitle != null) {
                    Text(text = subtitle, color = Color.White.copy(alpha = 0.5f), fontSize = 11.sp)
                }
            }
            if (isSelected) {
                Icon(imageVector = Icons.Rounded.Check, contentDescription = "Selected", tint = BluePrimary, modifier = Modifier.size(18.dp))
            }
        }
    }
}
