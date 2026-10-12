package com.rupam.drivevault.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rupam.drivevault.model.CategoryStat
import com.rupam.drivevault.model.CategorySyncState
import com.rupam.drivevault.model.FileCategoryType

/**
 * Returns the appropriate Material Icon for each category type
 */
fun getCategoryIcon(type: FileCategoryType): ImageVector {
    return when (type) {
        FileCategoryType.IMAGE -> Icons.Rounded.Image
        FileCategoryType.VIDEO -> Icons.Rounded.PlayCircle
        FileCategoryType.DOCUMENT -> Icons.Rounded.Description
        FileCategoryType.AUDIO -> Icons.Rounded.Audiotrack
        FileCategoryType.APK -> Icons.Rounded.Android
        FileCategoryType.FOLDER -> Icons.Rounded.Folder
        FileCategoryType.ARCHIVE -> Icons.Rounded.Archive
        FileCategoryType.OTHER -> Icons.Rounded.InsertDriveFile
    }
}

/**
 * Ultra-premium Category Card (Box-less Floating Icon Design)
 *
 * Direct floating icon with smooth Syncing -> Synced -> Count animated badge,
 * clean typography, and ripple interaction.
 */
@Composable
fun CategoryCard(
    category: CategoryStat,
    syncState: CategorySyncState = CategorySyncState.IDLE,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(22.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
        shadowElevation = 1.dp,
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 110.dp)
    ) {
        Column(
            modifier = Modifier
                .padding(14.dp)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top Row: Clean Floating Icon (NO box around it!) + Sleek Count / Sync Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Direct floating icon with vibrant tint
                Icon(
                    imageVector = getCategoryIcon(category.type),
                    contentDescription = category.title,
                    tint = category.accentColor,
                    modifier = Modifier.size(28.dp)
                )

                // Modern Pill Badge for Count / Syncing / Synced
                Surface(
                    shape = RoundedCornerShape(50),
                    color = when (syncState) {
                        CategorySyncState.SYNCING -> category.badgeBgColor.copy(alpha = 0.12f)
                        CategorySyncState.SYNCED -> Color(0xFF10B981).copy(alpha = 0.15f)
                        CategorySyncState.IDLE -> category.badgeBgColor.copy(alpha = 0.15f)
                    }
                ) {
                    AnimatedContent(
                        targetState = syncState,
                        transitionSpec = {
                            fadeIn(animationSpec = tween(220)) togetherWith fadeOut(animationSpec = tween(220))
                        },
                        label = "CategoryBadgeTransition"
                    ) { state ->
                        when (state) {
                            CategorySyncState.SYNCING -> {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                                ) {
                                    CircularProgressIndicator(
                                        strokeWidth = 1.8.dp,
                                        color = category.accentColor,
                                        modifier = Modifier.size(10.dp)
                                    )
                                    Text(
                                        text = "Syncing",
                                        color = category.accentColor,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }

                            CategorySyncState.SYNCED -> {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Check,
                                        contentDescription = "Synced",
                                        tint = Color(0xFF10B981),
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Text(
                                        text = "Synced",
                                        color = Color(0xFF10B981),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            CategorySyncState.IDLE -> {
                                Text(
                                    text = "${category.count}",
                                    color = category.accentColor,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Bottom Column: Category Name & Size
            Column {
                Text(
                    text = category.title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1
                )
                Spacer(modifier = Modifier.height(2.dp))
                AnimatedContent(
                    targetState = category.formattedSize,
                    transitionSpec = {
                        fadeIn(animationSpec = tween(300)) togetherWith fadeOut(animationSpec = tween(300))
                    },
                    label = "CategorySizeTransition"
                ) { sizeText ->
                    Text(
                        text = sizeText,
                        style = MaterialTheme.typography.bodySmall,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1
                    )
                }
            }
        }
    }
}

