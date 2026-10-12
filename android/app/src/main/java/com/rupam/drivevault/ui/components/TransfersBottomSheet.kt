package com.rupam.drivevault.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.clickable
import com.rupam.drivevault.transfer.TransferItem
import com.rupam.drivevault.transfer.TransferManager
import com.rupam.drivevault.transfer.TransferStatus
import com.rupam.drivevault.transfer.TransferType
import com.rupam.drivevault.ui.theme.BluePrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransfersBottomSheet(
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedFilter by remember { mutableStateOf<TransferType?>(null) } // null = All

    val allTransfers = TransferManager.transfers
    val filteredList = remember(allTransfers.toList(), selectedFilter) {
        if (selectedFilter == null) allTransfers else allTransfers.filter { it.type == selectedFilter }
    }

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
                .padding(bottom = 32.dp)
        ) {
            // ── Top Header: Title, Active Count & Clear ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Transfers",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    if (TransferManager.activeCount > 0) {
                        Text(
                            text = "${TransferManager.activeCount} active • ${TransferManager.formattedActiveSpeed}",
                            style = MaterialTheme.typography.bodySmall,
                            color = BluePrimary,
                            fontWeight = FontWeight.Medium
                        )
                    } else {
                        Text(
                            text = "Uploads & Downloads history",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                if (allTransfers.any { it.status == TransferStatus.COMPLETED || it.status == TransferStatus.FAILED || it.status == TransferStatus.CANCELLED }) {
                    TextButton(
                        onClick = { TransferManager.clearCompleted() },
                        colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text("Clear Completed", fontSize = 13.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // ── Filter Chips: All, Uploads, Downloads ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedFilter == null,
                    onClick = { selectedFilter = null },
                    label = { Text("All (${allTransfers.size})") },
                    shape = RoundedCornerShape(50)
                )
                FilterChip(
                    selected = selectedFilter == TransferType.UPLOAD,
                    onClick = { selectedFilter = TransferType.UPLOAD },
                    leadingIcon = { Icon(Icons.Rounded.ArrowUpward, contentDescription = null, modifier = Modifier.size(16.dp)) },
                    label = { Text("Uploads (${allTransfers.count { it.type == TransferType.UPLOAD }})") },
                    shape = RoundedCornerShape(50)
                )
                FilterChip(
                    selected = selectedFilter == TransferType.DOWNLOAD,
                    onClick = { selectedFilter = TransferType.DOWNLOAD },
                    leadingIcon = { Icon(Icons.Rounded.ArrowDownward, contentDescription = null, modifier = Modifier.size(16.dp)) },
                    label = { Text("Downloads (${allTransfers.count { it.type == TransferType.DOWNLOAD }})") },
                    shape = RoundedCornerShape(50)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            val context = LocalContext.current
            val isBatteryIgnored = TransferManager.isBatteryOptimizationIgnored(context)
            if (TransferManager.activeCount > 0 && !isBatteryIgnored) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = BluePrimary.copy(alpha = 0.12f),
                    border = BorderStroke(1.dp, BluePrimary.copy(alpha = 0.3f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { TransferManager.requestIgnoreBatteryOptimization(context) }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.BatteryChargingFull,
                            contentDescription = null,
                            tint = BluePrimary,
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = "Tap to prevent phone sleep mode from slowing down background speed",
                            style = MaterialTheme.typography.bodySmall,
                            color = BluePrimary,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = "Enable",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = BluePrimary
                        )
                    }
                }
                Spacer(modifier = Modifier.height(14.dp))
            }

            // ── Transfer List or Empty State ──
            if (filteredList.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 48.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            modifier = Modifier.size(64.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Rounded.SwapVert,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                                    modifier = Modifier.size(32.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "No transfers yet",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = "Uploaded and downloaded files will appear here",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp)
                ) {
                    items(filteredList, key = { it.id }) { item ->
                        TransferItemCard(
                            item = item,
                            onCancel = { TransferManager.cancelTransfer(item.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TransferItemCard(
    item: TransferItem,
    onCancel: () -> Unit
) {
    val isUpload = item.type == TransferType.UPLOAD
    val accentColor = if (isUpload) Color(0xFF10B981) else Color(0xFF6366F1) // Green for Upload, Indigo/Blue for Download
    val animatedProgress by animateFloatAsState(targetValue = item.progress, label = "progress")

    Surface(
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Direction Icon (Up for Upload, Down for Download)
                Surface(
                    shape = CircleShape,
                    color = accentColor.copy(alpha = 0.15f),
                    modifier = Modifier.size(38.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = if (isUpload) Icons.Rounded.ArrowUpward else Icons.Rounded.ArrowDownward,
                            contentDescription = if (isUpload) "Upload" else "Download",
                            tint = accentColor,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                // File Name & Details
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = item.fileName,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))

                    when (item.status) {
                        TransferStatus.IN_PROGRESS -> {
                            Text(
                                text = "${item.formattedTransferred} of ${item.formattedTotal} • ${item.formattedSpeed}",
                                style = MaterialTheme.typography.bodySmall,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        TransferStatus.COMPLETED -> {
                            Text(
                                text = "Completed • ${item.formattedTotal}",
                                style = MaterialTheme.typography.bodySmall,
                                fontSize = 11.sp,
                                color = Color(0xFF10B981),
                                fontWeight = FontWeight.Medium
                            )
                        }
                        TransferStatus.FAILED -> {
                            Text(
                                text = item.errorMessage ?: "Failed",
                                style = MaterialTheme.typography.bodySmall,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                        TransferStatus.CANCELLED -> {
                            Text(
                                text = "Cancelled",
                                style = MaterialTheme.typography.bodySmall,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        TransferStatus.QUEUED -> {
                            Text(
                                text = "Queued...",
                                style = MaterialTheme.typography.bodySmall,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                // Status Action / Percentage
                when (item.status) {
                    TransferStatus.IN_PROGRESS -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = item.formattedProgress,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = accentColor
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            IconButton(onClick = onCancel, modifier = Modifier.size(28.dp)) {
                                Icon(
                                    imageVector = Icons.Rounded.Close,
                                    contentDescription = "Cancel",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                    TransferStatus.COMPLETED -> {
                        Icon(
                            imageVector = Icons.Rounded.CheckCircle,
                            contentDescription = "Done",
                            tint = Color(0xFF10B981),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    TransferStatus.FAILED -> {
                        Icon(
                            imageVector = Icons.Rounded.Error,
                            contentDescription = "Failed",
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    TransferStatus.CANCELLED -> {
                        Icon(
                            imageVector = Icons.Rounded.Cancel,
                            contentDescription = "Cancelled",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    TransferStatus.QUEUED -> {}
                }
            }

            // Progress Bar (when in progress)
            if (item.status == TransferStatus.IN_PROGRESS) {
                LinearProgressIndicator(
                    progress = { animatedProgress },
                    color = accentColor,
                    trackColor = accentColor.copy(alpha = 0.2f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                )
            }
        }
    }
}
