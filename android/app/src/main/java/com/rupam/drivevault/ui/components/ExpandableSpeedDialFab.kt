package com.rupam.drivevault.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.CreateNewFolder
import androidx.compose.material.icons.rounded.UploadFile
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rupam.drivevault.ui.theme.BluePrimary

/**
 * Single Expandable Speed Dial FAB with "Black Hole" scroll-collapse animation.
 * 
 * - When user scrolls down: Sucks into a black hole (scales to 0, spins 720°, fades to 0).
 * - When user scrolls up: Pops back out from the singularity into normal size.
 * - When clicked: Rotates (+) by 135° into an (X) close icon and unfolds:
 *    1. New Folder
 *    2. Upload File
 *    3. Camera
 */
@Composable
fun ExpandableSpeedDialFab(
    isVisible: Boolean,
    onNewFolderClick: () -> Unit,
    onUploadClick: () -> Unit,
    onCameraClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isExpanded by remember { mutableStateOf(false) }

    // If FAB is sucked into black hole, collapse the speed dial menu automatically
    LaunchedEffect(isVisible) {
        if (!isVisible) {
            isExpanded = false
        }
    }

    // ── Black Hole Animation Specs ──
    val blackHoleScale by animateFloatAsState(
        targetValue = if (isVisible) 1f else 0f,
        animationSpec = if (isVisible) {
            spring(dampingRatio = 0.65f, stiffness = Spring.StiffnessMediumLow)
        } else {
            tween(durationMillis = 350, easing = FastOutSlowInEasing)
        },
        label = "blackHoleScale"
    )

    val blackHoleRotation by animateFloatAsState(
        targetValue = if (isVisible) 0f else 720f,
        animationSpec = tween(durationMillis = 350, easing = FastOutSlowInEasing),
        label = "blackHoleRotation"
    )

    val blackHoleAlpha by animateFloatAsState(
        targetValue = if (isVisible) 1f else 0f,
        animationSpec = tween(durationMillis = 250),
        label = "blackHoleAlpha"
    )

    // Plus (+) to Close (X) rotation (0° -> 135°)
    val mainFabRotation by animateFloatAsState(
        targetValue = if (isExpanded) 135f else 0f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = Spring.StiffnessMedium),
        label = "mainFabRotation"
    )

    Box(
        contentAlignment = Alignment.BottomEnd,
        modifier = modifier
            .scale(blackHoleScale)
            .rotate(blackHoleRotation)
            .alpha(blackHoleAlpha)
    ) {
        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // ── Speed Dial Expanded Action Items ──
            AnimatedVisibility(
                visible = isExpanded,
                enter = fadeIn(tween(180)) + slideInVertically(
                    initialOffsetY = { it / 2 },
                    animationSpec = spring(stiffness = Spring.StiffnessMediumLow)
                ) + scaleIn(initialScale = 0.8f),
                exit = fadeOut(tween(140)) + slideOutVertically(
                    targetOffsetY = { it / 2 },
                    animationSpec = tween(140)
                ) + scaleOut(targetScale = 0.8f)
            ) {
                Column(
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Option 1: Camera
                    SpeedDialItem(
                        label = "Camera",
                        icon = Icons.Rounded.CameraAlt,
                        containerColor = Color(0xFF8B5CF6), // Purple
                        onClick = {
                            isExpanded = false
                            onCameraClick()
                        }
                    )

                    // Option 2: Upload File
                    SpeedDialItem(
                        label = "Upload File",
                        icon = Icons.Rounded.UploadFile,
                        containerColor = BluePrimary,
                        onClick = {
                            isExpanded = false
                            onUploadClick()
                        }
                    )

                    // Option 3: New Folder
                    SpeedDialItem(
                        label = "New Folder",
                        icon = Icons.Rounded.CreateNewFolder,
                        containerColor = Color(0xFF0D9488), // Teal
                        onClick = {
                            isExpanded = false
                            onNewFolderClick()
                        }
                    )
                }
            }

            // ── Primary FAB Button ──
            FloatingActionButton(
                onClick = { isExpanded = !isExpanded },
                containerColor = if (isExpanded) MaterialTheme.colorScheme.surfaceVariant else BluePrimary,
                contentColor = if (isExpanded) MaterialTheme.colorScheme.onSurfaceVariant else Color.White,
                shape = CircleShape,
                elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 6.dp),
                modifier = Modifier.size(56.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.Add,
                    contentDescription = if (isExpanded) "Close options" else "Open actions",
                    modifier = Modifier
                        .size(28.dp)
                        .rotate(mainFabRotation)
                )
            }
        }
    }
}

/**
 * Individual Speed Dial action item with label badge and mini button
 */
@Composable
private fun SpeedDialItem(
    label: String,
    icon: ImageVector,
    containerColor: Color,
    onClick: () -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = null,
            onClick = onClick
        )
    ) {
        // Label Badge
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 4.dp,
            border = androidx.compose.foundation.BorderStroke(
                1.dp,
                MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
            )
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
            )
        }

        // Mini FAB Icon
        SmallFloatingActionButton(
            onClick = onClick,
            containerColor = containerColor,
            contentColor = Color.White,
            shape = CircleShape,
            elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 4.dp),
            modifier = Modifier.size(44.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}
