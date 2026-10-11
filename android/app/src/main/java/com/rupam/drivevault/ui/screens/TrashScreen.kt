package com.rupam.drivevault.ui.screens

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.model.FileCategoryType
import com.rupam.drivevault.repository.DriveRepository
import com.rupam.drivevault.ui.components.getCategoryColor
import com.rupam.drivevault.ui.components.getCategoryIcon
import com.rupam.drivevault.ui.theme.BluePrimary
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun TrashScreen(
    repository: DriveRepository,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var trashFiles by remember { mutableStateOf<List<DriveFile>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var showDeleteConfirmDialog by remember { mutableStateOf(false) }
    var showEmptyTrashConfirmDialog by remember { mutableStateOf(false) }
    var itemToPermanentDelete by remember { mutableStateOf<DriveFile?>(null) }
    var isProcessingAction by remember { mutableStateOf(false) }
    var processingTitle by remember { mutableStateOf("") }
    var processingCurrent by remember { mutableIntStateOf(0) }
    var processingTotal by remember { mutableIntStateOf(0) }

    fun loadTrash() {
        isLoading = true
        scope.launch {
            repository.getTrashFiles().onSuccess { files ->
                trashFiles = files
                isLoading = false
            }.onFailure { err ->
                isLoading = false
                Toast.makeText(context, "Could not load Trash: ${err.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    LaunchedEffect(Unit) {
        loadTrash()
    }

    val isSelectionMode = selectedIds.isNotEmpty()

    // Back Handler: Exit selection mode first, then exit screen
    BackHandler(enabled = !isProcessingAction) {
        if (isSelectionMode) {
            selectedIds = emptySet()
        } else {
            onBack()
        }
    }

    // ── Batch Restore Selected ──
    fun restoreSelected() {
        if (selectedIds.isEmpty()) return
        val idsToRestore = selectedIds.toList()
        processingTitle = "Restoring Items..."
        processingTotal = idsToRestore.size
        processingCurrent = 0
        isProcessingAction = true

        scope.launch {
            var successCount = 0
            val chunks = idsToRestore.chunked(4)
            for (chunk in chunks) {
                val results = chunk.map { id ->
                    async { repository.restoreFile(id) }
                }.awaitAll()
                results.forEach { res ->
                    if (res.isSuccess) successCount++
                    processingCurrent++
                }
            }
            isProcessingAction = false
            selectedIds = emptySet()
            Toast.makeText(context, "Restored $successCount of ${idsToRestore.size} item(s)", Toast.LENGTH_SHORT).show()
            loadTrash()
        }
    }

    // ── Batch Permanent Delete Selected ──
    fun deleteSelectedPermanently(itemsToDelete: List<String> = selectedIds.toList()) {
        if (itemsToDelete.isEmpty()) return
        processingTitle = "Permanently Deleting..."
        processingTotal = itemsToDelete.size
        processingCurrent = 0
        isProcessingAction = true

        scope.launch {
            var deleteCount = 0
            val chunks = itemsToDelete.chunked(4)
            for (chunk in chunks) {
                val results = chunk.map { id ->
                    async { repository.deletePermanently(id) }
                }.awaitAll()
                results.forEach { res ->
                    if (res.isSuccess) deleteCount++
                    processingCurrent++
                }
            }
            isProcessingAction = false
            selectedIds = emptySet()
            Toast.makeText(context, "Permanently deleted $deleteCount item(s)", Toast.LENGTH_SHORT).show()
            loadTrash()
        }
    }

    // ── Single Restore ──
    fun restoreSingleItem(file: DriveFile) {
        processingTitle = "Restoring \"${file.name}\"..."
        processingTotal = 1
        processingCurrent = 0
        isProcessingAction = true

        scope.launch {
            repository.restoreFile(file.id).onSuccess {
                processingCurrent = 1
                isProcessingAction = false
                Toast.makeText(context, "Restored ${file.name}", Toast.LENGTH_SHORT).show()
                loadTrash()
            }.onFailure { err ->
                isProcessingAction = false
                Toast.makeText(context, "Restore failed: ${err.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ── Single Delete Forever ──
    fun deleteSingleItem(file: DriveFile) {
        processingTitle = "Deleting \"${file.name}\"..."
        processingTotal = 1
        processingCurrent = 0
        isProcessingAction = true

        scope.launch {
            repository.deletePermanently(file.id).onSuccess {
                processingCurrent = 1
                isProcessingAction = false
                Toast.makeText(context, "Permanently deleted ${file.name}", Toast.LENGTH_SHORT).show()
                loadTrash()
            }.onFailure { err ->
                isProcessingAction = false
                Toast.makeText(context, "Delete failed: ${err.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = if (isSelectionMode) "${selectedIds.size} Selected" else "Trash / Recycle Bin",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        if (!isSelectionMode) {
                            Text(
                                text = "${trashFiles.size} trashed item(s)",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            if (isSelectionMode) selectedIds = emptySet() else onBack()
                        },
                        enabled = !isProcessingAction
                    ) {
                        Icon(
                            imageVector = if (isSelectionMode) Icons.Rounded.Close else Icons.AutoMirrored.Rounded.ArrowBack,
                            contentDescription = "Back",
                            tint = MaterialTheme.colorScheme.onBackground
                        )
                    }
                },
                actions = {
                    if (trashFiles.isNotEmpty() && !isSelectionMode) {
                        TextButton(
                            onClick = { showEmptyTrashConfirmDialog = true },
                            colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                        ) {
                            Icon(Icons.Rounded.DeleteSweep, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Empty", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }

                        TextButton(onClick = {
                            selectedIds = trashFiles.map { it.id }.toSet()
                        }) {
                            Text(
                                text = "Select All",
                                color = BluePrimary,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp
                            )
                        }
                    } else if (trashFiles.isNotEmpty() && isSelectionMode) {
                        TextButton(onClick = {
                            selectedIds = if (selectedIds.size == trashFiles.size) emptySet() else trashFiles.map { it.id }.toSet()
                        }) {
                            Text(
                                text = if (selectedIds.size == trashFiles.size) "Deselect All" else "Select All",
                                color = BluePrimary,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        bottomBar = {
            AnimatedVisibility(visible = isSelectionMode) {
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 8.dp,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { restoreSelected() },
                            enabled = !isProcessingAction,
                            colors = ButtonDefaults.buttonColors(containerColor = BluePrimary),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(46.dp)
                        ) {
                            Icon(Icons.Rounded.Restore, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Restore (${selectedIds.size})", fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = { showDeleteConfirmDialog = true },
                            enabled = !isProcessingAction,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.15f),
                                contentColor = MaterialTheme.colorScheme.error
                            ),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(46.dp)
                        ) {
                            Icon(Icons.Rounded.DeleteForever, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Delete Forever", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
        modifier = modifier
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (isLoading && trashFiles.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = BluePrimary)
                }
            } else if (trashFiles.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier.size(80.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Rounded.DeleteOutline,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(40.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Trash is Empty",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Items moved to trash will be shown here.\nYou can restore or permanently delete them anytime.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(trashFiles, key = { it.id }) { file ->
                        val isSelected = selectedIds.contains(file.id)
                        val iconColor = getCategoryColor(file.type)

                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = if (isSelected) BluePrimary.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface,
                            border = BorderStroke(
                                1.dp,
                                if (isSelected) BluePrimary else MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .combinedClickable(
                                    onClick = {
                                        if (isSelectionMode) {
                                            selectedIds = if (isSelected) selectedIds - file.id else selectedIds + file.id
                                        }
                                    },
                                    onLongClick = {
                                        selectedIds = if (isSelected) selectedIds - file.id else selectedIds + file.id
                                    }
                                )
                        ) {
                            Row(
                                modifier = Modifier
                                    .padding(horizontal = 14.dp, vertical = 12.dp)
                                    .fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Selection Checkbox
                                if (isSelectionMode) {
                                    Checkbox(
                                        checked = isSelected,
                                        onCheckedChange = { checked ->
                                            selectedIds = if (checked) selectedIds + file.id else selectedIds - file.id
                                        },
                                        colors = CheckboxDefaults.colors(checkedColor = BluePrimary)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                }

                                // Category / File Icon
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = iconColor.copy(alpha = 0.12f),
                                    modifier = Modifier.size(42.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = getCategoryIcon(file.type),
                                            contentDescription = null,
                                            tint = iconColor,
                                            modifier = Modifier.size(24.dp)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                // File Details
                                Column(modifier = Modifier.weight(1f)) {
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
                                        text = if (file.date.isNotBlank()) "${file.size} • Trashed: ${file.date}" else file.size,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontSize = 12.sp,
                                        maxLines = 1
                                    )
                                }

                                // Quick individual action buttons when not in multi-selection
                                if (!isSelectionMode) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        IconButton(
                                            onClick = { restoreSingleItem(file) },
                                            enabled = !isProcessingAction,
                                            modifier = Modifier.size(36.dp)
                                        ) {
                                            Icon(
                                                Icons.Rounded.Restore,
                                                contentDescription = "Restore",
                                                tint = BluePrimary,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }

                                        IconButton(
                                            onClick = { itemToPermanentDelete = file },
                                            enabled = !isProcessingAction,
                                            modifier = Modifier.size(36.dp)
                                        ) {
                                            Icon(
                                                Icons.Rounded.DeleteForever,
                                                contentDescription = "Delete Forever",
                                                tint = MaterialTheme.colorScheme.error,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Batch Delete Forever Confirmation Dialog ──
    if (showDeleteConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmDialog = false },
            icon = { Icon(Icons.Rounded.DeleteForever, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Delete Forever?") },
            text = { Text("Permanently delete ${selectedIds.size} item(s)? This action cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteConfirmDialog = false
                        deleteSelectedPermanently()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete Forever", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── Empty Entire Trash Confirmation Dialog ──
    if (showEmptyTrashConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showEmptyTrashConfirmDialog = false },
            icon = { Icon(Icons.Rounded.DeleteSweep, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Empty Entire Trash?") },
            text = { Text("Permanently delete all ${trashFiles.size} items in trash? This cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = {
                        showEmptyTrashConfirmDialog = false
                        deleteSelectedPermanently(trashFiles.map { it.id })
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Empty Trash", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showEmptyTrashConfirmDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── Single Item Permanent Delete Dialog ──
    if (itemToPermanentDelete != null) {
        val file = itemToPermanentDelete!!
        AlertDialog(
            onDismissRequest = { itemToPermanentDelete = null },
            icon = { Icon(Icons.Rounded.DeleteForever, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Delete Permanently?") },
            text = { Text("Permanently delete \"${file.name}\"? It will be removed forever from Google Drive.") },
            confirmButton = {
                Button(
                    onClick = {
                        itemToPermanentDelete = null
                        deleteSingleItem(file)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete Forever", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { itemToPermanentDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── Live Processing & Progress Dialog Modal ──
    if (isProcessingAction) {
        Dialog(
            onDismissRequest = {},
            properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false)
        ) {
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 8.dp,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    CircularProgressIndicator(
                        color = BluePrimary,
                        strokeWidth = 3.dp,
                        modifier = Modifier.size(46.dp)
                    )

                    Text(
                        text = processingTitle,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        textAlign = TextAlign.Center
                    )

                    if (processingTotal > 1) {
                        val progress = if (processingTotal > 0) processingCurrent.toFloat() / processingTotal.toFloat() else 0f
                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp)),
                            color = BluePrimary,
                            trackColor = BluePrimary.copy(alpha = 0.15f)
                        )

                        Text(
                            text = "$processingCurrent of $processingTotal items processed",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        Text(
                            text = "Please wait a moment...",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
