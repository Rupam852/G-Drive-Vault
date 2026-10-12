package com.rupam.drivevault.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.model.FileCategoryType
import com.rupam.drivevault.ui.theme.*

fun getCategoryColor(type: FileCategoryType) = when (type) {
    FileCategoryType.IMAGE -> CategoryImage
    FileCategoryType.VIDEO -> CategoryVideo
    FileCategoryType.DOCUMENT -> CategoryDocument
    FileCategoryType.AUDIO -> CategoryAudio
    FileCategoryType.APK -> CategoryApk
    FileCategoryType.FOLDER -> CategoryFolder
    FileCategoryType.ARCHIVE -> CategoryArchive
    FileCategoryType.OTHER -> CategoryOther
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun FileItemRow(
    file: DriveFile,
    onClick: () -> Unit,
    onMenuClick: () -> Unit,
    isSelected: Boolean = false,
    isInSelectionMode: Boolean = false,
    onLongClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val iconColor = getCategoryColor(file.type)

    val backgroundColor = if (isSelected) {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
    } else {
        MaterialTheme.colorScheme.surface
    }

    val borderColor = if (isSelected) {
        BluePrimary
    } else {
        MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)
    }

    val borderWidth = if (isSelected) 1.5.dp else 1.dp

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = backgroundColor,
        border = BorderStroke(borderWidth, borderColor),
        shadowElevation = if (isSelected) 2.dp else 0.5.dp,
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            )
    ) {
        Row(
            modifier = Modifier
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Clean Floating Icon (No box container!)
            Icon(
                imageVector = getCategoryIcon(file.type),
                contentDescription = file.name,
                tint = iconColor,
                modifier = Modifier.size(28.dp)
            )

            // File Details (Name & Subtitle)
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = file.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = if (file.date.isNotBlank()) "${file.size} • ${file.date}" else file.size,
                    style = MaterialTheme.typography.bodySmall,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }

            // In selection mode: Checkbox. Otherwise: 3-dot More Options Icon
            if (isInSelectionMode) {
                Checkbox(
                    checked = isSelected,
                    onCheckedChange = { onClick() },
                    colors = CheckboxDefaults.colors(
                        checkedColor = BluePrimary,
                        uncheckedColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    ),
                    modifier = Modifier.size(36.dp)
                )
            } else {
                IconButton(
                    onClick = onMenuClick,
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.MoreVert,
                        contentDescription = "Options",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}
