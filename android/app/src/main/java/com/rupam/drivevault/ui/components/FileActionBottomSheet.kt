package com.rupam.drivevault.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.model.FileCategoryType
import com.rupam.drivevault.ui.theme.BluePrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FileActionBottomSheet(
    file: DriveFile,
    onDismiss: () -> Unit,
    onOpen: (DriveFile) -> Unit,
    onDownload: (DriveFile) -> Unit,
    onRename: (DriveFile) -> Unit,
    onToggleStar: (DriveFile) -> Unit,
    onShare: (DriveFile) -> Unit,
    onDelete: (DriveFile) -> Unit,
    onViewDetails: (DriveFile) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val iconColor = getCategoryColor(file.type)
    val isFolder = file.type == FileCategoryType.FOLDER

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
        containerColor = MaterialTheme.colorScheme.surface,
        dragHandle = {
            Surface(
                modifier = Modifier.padding(top = 12.dp, bottom = 8.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f),
                shape = RoundedCornerShape(10.dp)
            ) {
                Box(modifier = Modifier.size(width = 38.dp, height = 4.dp))
            }
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // ── File Header Info Card ──
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Icon(
                        imageVector = getCategoryIcon(file.type),
                        contentDescription = null,
                        tint = iconColor,
                        modifier = Modifier.size(34.dp)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = file.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = if (file.date.isNotBlank()) "${file.size} • ${file.date}" else file.size,
                            style = MaterialTheme.typography.bodySmall,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))

            // ── Action Items List ──
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Open / Preview
                ActionMenuItem(
                    icon = if (isFolder) Icons.Rounded.FolderOpen else Icons.Rounded.Visibility,
                    title = if (isFolder) "Open Folder" else "Open & Preview",
                    subtitle = if (isFolder) "View folder contents" else "View file in-app",
                    onClick = {
                        onDismiss()
                        onOpen(file)
                    }
                )

                // Download (Only for files)
                if (!isFolder) {
                    ActionMenuItem(
                        icon = Icons.Rounded.Download,
                        title = "Download to Device",
                        subtitle = "High-speed edge download",
                        onClick = {
                            onDismiss()
                            onDownload(file)
                        }
                    )
                }

                // Star / Unstar
                ActionMenuItem(
                    icon = if (file.starred) Icons.Rounded.Star else Icons.Rounded.StarOutline,
                    title = if (file.starred) "Remove from Starred" else "Add to Starred",
                    iconTint = if (file.starred) Color(0xFFFBBF24) else MaterialTheme.colorScheme.onSurface,
                    onClick = {
                        onDismiss()
                        onToggleStar(file)
                    }
                )

                // Rename
                ActionMenuItem(
                    icon = Icons.Rounded.DriveFileRenameOutline,
                    title = "Rename",
                    onClick = {
                        onDismiss()
                        onRename(file)
                    }
                )

                // Share
                ActionMenuItem(
                    icon = Icons.Rounded.Share,
                    title = "Share",
                    subtitle = "Send link or file details",
                    onClick = {
                        onDismiss()
                        onShare(file)
                    }
                )

                // File Details
                ActionMenuItem(
                    icon = Icons.Rounded.Info,
                    title = "Details & Info",
                    subtitle = "View full file properties",
                    onClick = {
                        onDismiss()
                        onViewDetails(file)
                    }
                )

                // Delete / Trash (Destructive)
                ActionMenuItem(
                    icon = Icons.Rounded.DeleteOutline,
                    title = "Move to Trash",
                    subtitle = "Delete from Google Drive",
                    iconTint = MaterialTheme.colorScheme.error,
                    textColor = MaterialTheme.colorScheme.error,
                    onClick = {
                        onDismiss()
                        onDelete(file)
                    }
                )
            }
        }
    }
}

@Composable
private fun ActionMenuItem(
    icon: ImageVector,
    title: String,
    subtitle: String? = null,
    iconTint: Color = MaterialTheme.colorScheme.onSurface,
    textColor: Color = MaterialTheme.colorScheme.onSurface,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(14.dp),
        color = Color.Transparent,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Surface(
                shape = CircleShape,
                color = iconTint.copy(alpha = 0.12f),
                modifier = Modifier.size(38.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = title,
                        tint = iconTint,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = textColor
                )
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
