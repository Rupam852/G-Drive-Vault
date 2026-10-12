package com.rupam.drivevault.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.sin

/**
 * Android 13/14 Google Pixel Media Player inspired Squiggly Wave Slider.
 * Plays an animated undulating sine wave for the active track while media is playing,
 * with smooth dragging, seeking, and responsive thumb animation.
 */
@Composable
fun SquigglySlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    isPlaying: Boolean = false,
    activeColor: Color = Color(0xFFA78BFA),
    inactiveColor: Color = Color.White.copy(alpha = 0.22f),
    thumbColor: Color = Color.White
) {
    val density = LocalDensity.current
    val waveLengthPx = with(density) { 30.dp.toPx() }
    val baseAmplitudePx = with(density) { 4.5.dp.toPx() }
    val strokeWidthPx = with(density) { 3.5.dp.toPx() }
    val thumbRadiusPx = with(density) { 7.dp.toPx() }

    val infiniteTransition = rememberInfiniteTransition(label = "SquigglyPhase")
    val wavePhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "SquigglyPhaseOffset"
    )

    val animatedAmplitude by animateFloatAsState(
        targetValue = if (isPlaying) baseAmplitudePx else baseAmplitudePx * 0.7f,
        animationSpec = tween(350),
        label = "SquigglyAmplitude"
    )

    var isDragging by remember { mutableStateOf(false) }
    var dragProgress by remember { mutableFloatStateOf(value) }

    val currentProgress = if (isDragging) dragProgress else value.coerceIn(0f, 1f)

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(36.dp)
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    val newProgress = (offset.x / size.width).coerceIn(0f, 1f)
                    onValueChange(newProgress)
                }
            }
            .pointerInput(Unit) {
                detectDragGestures(
                    onDragStart = { offset ->
                        isDragging = true
                        val newProgress = (offset.x / size.width).coerceIn(0f, 1f)
                        dragProgress = newProgress
                        onValueChange(newProgress)
                    },
                    onDragEnd = {
                        isDragging = false
                        onValueChange(dragProgress)
                    },
                    onDragCancel = {
                        isDragging = false
                    },
                    onDrag = { change, _ ->
                        change.consume()
                        val newProgress = (change.position.x / size.width).coerceIn(0f, 1f)
                        dragProgress = newProgress
                        onValueChange(newProgress)
                    }
                )
            }
    ) {
        val width = size.width
        val centerY = size.height / 2f
        val thumbX = (currentProgress * width).coerceIn(0f, width)

        // 1. Inactive Track (straight subtle horizontal line to the right of thumb)
        if (thumbX < width) {
            drawLine(
                color = inactiveColor,
                start = Offset(thumbX, centerY),
                end = Offset(width, centerY),
                strokeWidth = strokeWidthPx,
                cap = StrokeCap.Round
            )
        }

        // 2. Active Track (Squiggly sine wave to the left of thumb)
        if (thumbX > 0f) {
            val path = Path()
            path.moveTo(0f, centerY)

            val stepPx = 2f
            var x = 0f
            while (x <= thumbX) {
                // Taper down amplitude near thumb and start so wave ends cleanly at the thumb center
                val taper = if (thumbX > 20f) {
                    val distFromEnd = thumbX - x
                    val distFromStart = x
                    val endFactor = (distFromEnd / 24f).coerceIn(0f, 1f)
                    val startFactor = (distFromStart / 16f).coerceIn(0f, 1f)
                    minOf(endFactor, startFactor)
                } else 1f

                val phase = if (isPlaying) wavePhase else 0f
                val radians = (x / waveLengthPx) * 2f * PI.toFloat() - phase
                val y = centerY + (sin(radians) * animatedAmplitude * taper)
                path.lineTo(x, y)
                x += stepPx
            }
            path.lineTo(thumbX, centerY)

            drawPath(
                path = path,
                color = activeColor,
                style = Stroke(
                    width = strokeWidthPx,
                    cap = StrokeCap.Round,
                    join = StrokeJoin.Round
                )
            )
        }

        // 3. Thumb (expanding circle when dragged)
        drawCircle(
            color = thumbColor,
            radius = if (isDragging) thumbRadiusPx * 1.25f else thumbRadiusPx,
            center = Offset(thumbX, centerY)
        )
    }
}
