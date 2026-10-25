package com.rupam.drivevault.ui.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import com.rupam.drivevault.ui.theme.BluePrimary

/**
 * YouTube / Netflix style video scrubber seekbar.
 * Features:
 * - Sleek 3.5dp continuous line track (smoothly animates to 5.5dp when scrubbing).
 * - Smooth continuous active track filled with [activeColor] (default BluePrimary) from start to thumb with NO gap.
 * - Optional buffered track in translucent white.
 * - Smooth circular thumb dot with white border that scales up when scrubbing.
 * - Seamless tap-to-seek and drag-to-seek gestures without Android M3 end-dots or gaps.
 */
@Composable
fun YouTubeVideoSlider(
    positionMs: Long,
    durationMs: Long,
    bufferedPositionMs: Long = 0L,
    onSeekStarted: () -> Unit,
    onSeekProgress: (Long) -> Unit,
    onSeekFinished: (Long) -> Unit,
    modifier: Modifier = Modifier,
    activeColor: Color = BluePrimary,
    bufferedColor: Color = Color.White.copy(alpha = 0.38f),
    inactiveColor: Color = Color.White.copy(alpha = 0.22f),
    thumbColor: Color = BluePrimary
) {
    var isDragging by remember { mutableStateOf(false) }
    var dragProgress by remember { mutableFloatStateOf(0f) }

    val actualProgress = if (durationMs > 0L) {
        (positionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
    } else 0f

    val bufferedProgress = if (durationMs > 0L) {
        (bufferedPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
    } else 0f

    val displayProgress = if (isDragging) dragProgress else actualProgress

    val animatedTrackHeight by animateDpAsState(
        targetValue = if (isDragging) 5.dp else 3.5.dp,
        animationSpec = tween(durationMillis = 150),
        label = "trackHeight"
    )

    val animatedThumbRadius by animateDpAsState(
        targetValue = if (isDragging) 8.dp else 6.dp,
        animationSpec = tween(durationMillis = 150),
        label = "thumbRadius"
    )

    val density = LocalDensity.current
    val whiteRingWidthPx = with(density) { 2.dp.toPx() }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(32.dp)
            .pointerInput(durationMs) {
                detectTapGestures { offset ->
                    if (durationMs > 0L && size.width > 0) {
                        val newProgress = (offset.x / size.width.toFloat()).coerceIn(0f, 1f)
                        val targetMs = (newProgress * durationMs).toLong()
                        onSeekStarted()
                        onSeekFinished(targetMs)
                    }
                }
            }
            .pointerInput(durationMs) {
                detectDragGestures(
                    onDragStart = { offset ->
                        isDragging = true
                        onSeekStarted()
                        if (durationMs > 0L && size.width > 0) {
                            dragProgress = (offset.x / size.width.toFloat()).coerceIn(0f, 1f)
                            onSeekProgress((dragProgress * durationMs).toLong())
                        }
                    },
                    onDrag = { change, _ ->
                        change.consume()
                        if (durationMs > 0L && size.width > 0) {
                            dragProgress = (change.position.x / size.width.toFloat()).coerceIn(0f, 1f)
                            onSeekProgress((dragProgress * durationMs).toLong())
                        }
                    },
                    onDragEnd = {
                        isDragging = false
                        if (durationMs > 0L) {
                            onSeekFinished((dragProgress * durationMs).toLong())
                        }
                    },
                    onDragCancel = {
                        isDragging = false
                    }
                )
            },
        contentAlignment = Alignment.Center
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(32.dp)
        ) {
            val width = size.width
            val height = size.height
            val centerY = height / 2f
            val trackH = animatedTrackHeight.toPx()
            val thumbR = animatedThumbRadius.toPx()
            val cornerRadius = CornerRadius(trackH / 2f, trackH / 2f)

            // 1. Inactive background track (sleek subtle line)
            drawRoundRect(
                color = inactiveColor,
                topLeft = Offset(0f, centerY - trackH / 2f),
                size = Size(width, trackH),
                cornerRadius = cornerRadius
            )

            // 2. Buffered progress track (YouTube translucent buffer line)
            if (bufferedProgress > 0f) {
                val bufferedWidth = (width * bufferedProgress).coerceIn(0f, width)
                drawRoundRect(
                    color = bufferedColor,
                    topLeft = Offset(0f, centerY - trackH / 2f),
                    size = Size(bufferedWidth, trackH),
                    cornerRadius = cornerRadius
                )
            }

            // 3. Active played track (continuous blue line without gaps)
            val thumbX = (width * displayProgress).coerceIn(0f, width)
            if (thumbX > 0f) {
                drawRoundRect(
                    color = activeColor,
                    topLeft = Offset(0f, centerY - trackH / 2f),
                    size = Size(thumbX, trackH),
                    cornerRadius = cornerRadius
                )
            }

            // 4. Scrubber Thumb (YouTube smooth circular dot with clean white ring)
            drawCircle(
                color = Color.White,
                radius = thumbR + whiteRingWidthPx,
                center = Offset(thumbX, centerY)
            )
            drawCircle(
                color = thumbColor,
                radius = thumbR,
                center = Offset(thumbX, centerY)
            )
        }
    }
}
