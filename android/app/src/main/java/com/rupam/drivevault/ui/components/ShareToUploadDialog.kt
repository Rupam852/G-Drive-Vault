package com.rupam.drivevault.ui.components

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForwardIos
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.model.FileCategoryType
import com.rupam.drivevault.repository.DriveRepository
import com.rupam.drivevault.transfer.TransferItem
import com.rupam.drivevault.ui.theme.BluePrimary
import com.rupam.drivevault.ui.theme.CategoryFolder
import kotlinx.coroutines.launch

data class SharedFileItem(
    val uri: Uri,
    val originalName: String,
    var displayName: String,
    val sizeBytes: Long,
    val formattedSize: String,
    val mimeType: String,
    val type: FileCategoryType
)

/**
 * Extracts metadata (display name, size, MIME type) from an incoming shared content URI.
 */
fun querySharedUriMetadata(context: Context, uri: Uri): SharedFileItem {
    var fileName = "shared_${System.currentTimeMillis()}"
    var fileSize = 0L

    val contentResolver = context.contentResolver
    try {
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst()) {
                if (nameIndex >= 0) fileName = cursor.getString(nameIndex) ?: fileName
                if (sizeIndex >= 0) fileSize = cursor.getLong(sizeIndex)
            }
        }
        if (fileSize <= 0) {
            contentResolver.openInputStream(uri)?.use {
                fileSize = it.available().toLong()
            }
        }
    } catch (e: Exception) {
        fileSize = 0L
    }

    val mimeType = try {
        contentResolver.getType(uri) ?: "application/octet-stream"
    } catch (e: Exception) {
        "application/octet-stream"
    }

    val type = FileCategoryType.fromMimeOrExtension(fileName, mimeType)
    val formattedSize = TransferItem.formatBytes(fileSize)

    return SharedFileItem(
        uri = uri,
        originalName = fileName,
        displayName = fileName,
        sizeBytes = fileSize,
        formattedSize = formattedSize,
        mimeType = mimeType,
        type = type
    )
}

@Composable
fun ShareToUploadDialog(
    sharedUris: List<Uri>,
    repository: DriveRepository,
    onUploadConfirmed: (filesToUpload: List<Pair<Uri, String>>, targetFolderId: String?) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    // ── Parse shared URIs into items ──
    val filesList = remember(sharedUris) {
        mutableStateListOf<SharedFileItem>().apply {
            addAll(sharedUris.map { querySharedUriMetadata(context, it) })
        }
    }

    // ── Selected destination folder ──
    var targetFolderId by remember { mutableStateOf<String?>(null) }
    var targetFolderName by remember { mutableStateOf("My Drive") }

    // ── Modal dialog states ──
    var isFolderPickerOpen by remember { mutableStateOf(false) }
    var renamingItem by remember { mutableStateOf<SharedFileItem?>(null) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .padding(vertical = 24.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(22.dp)
            ) {
                // ── Header Row ──
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = BluePrimary.copy(alpha = 0.12f),
                            modifier = Modifier.size(40.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Rounded.CloudUpload,
                                    contentDescription = null,
                                    tint = BluePrimary,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                        Column {
                            Text(
                                text = "Upload to DriveVault",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "${filesList.size} ${if (filesList.size == 1) "file" else "files"} to upload",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Rounded.Close,
                            contentDescription = "Close",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ── Files List (with inline rename support) ──
                Text(
                    text = "FILES (TAP NAME TO RENAME)",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    letterSpacing = 0.5.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 240.dp)
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filesList) { item ->
                            SharedFileRow(
                                item = item,
                                onRenameClick = { renamingItem = item },
                                onRemoveClick = {
                                    if (filesList.size > 1) {
                                        filesList.remove(item)
                                    } else {
                                        onDismiss()
                                    }
                                }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // ── Destination Folder Card (Clickable to change location) ──
                Text(
                    text = "DESTINATION FOLDER",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    letterSpacing = 0.5.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                Surface(
                    onClick = { isFolderPickerOpen = true },
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                    border = BorderStroke(1.dp, BluePrimary.copy(alpha = 0.3f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Folder,
                                contentDescription = null,
                                tint = CategoryFolder,
                                modifier = Modifier.size(26.dp)
                            )
                            Column {
                                Text(
                                    text = targetFolderName,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = if (targetFolderId == null) "Root Directory" else "Subfolder",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = BluePrimary.copy(alpha = 0.12f)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "Change",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = BluePrimary
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Icon(
                                    imageVector = Icons.AutoMirrored.Rounded.ArrowForwardIos,
                                    contentDescription = null,
                                    tint = BluePrimary,
                                    modifier = Modifier.size(10.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // ── Bottom Action Buttons ──
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Cancel")
                    }

                    Button(
                        onClick = {
                            val uploadPayload = filesList.map { Pair(it.uri, it.displayName) }
                            onUploadConfirmed(uploadPayload, targetFolderId)
                        },
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = BluePrimary),
                        modifier = Modifier.weight(1.4f)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.CloudUpload,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Upload (${filesList.size})",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }

    // ── Rename File Prompt Dialog ──
    renamingItem?.let { item ->
        var editedName by remember(item) { mutableStateOf(item.displayName) }

        AlertDialog(
            onDismissRequest = { renamingItem = null },
            title = {
                Text(
                    text = "Rename File",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column {
                    Text(
                        text = "Edit file name before uploading to DriveVault:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = editedName,
                        onValueChange = { editedName = it },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val trimmed = editedName.trim()
                        if (trimmed.isNotEmpty()) {
                            item.displayName = trimmed
                            // Trigger compose recomposition
                            val index = filesList.indexOf(item)
                            if (index >= 0) {
                                filesList[index] = item.copy(displayName = trimmed)
                            }
                        }
                        renamingItem = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BluePrimary)
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { renamingItem = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── Interactive Folder Picker Dialog (with New Folder creation) ──
    if (isFolderPickerOpen) {
        FolderPickerDialog(
            repository = repository,
            initialFolderId = targetFolderId,
            initialFolderName = targetFolderName,
            onFolderSelected = { selectedId, selectedName ->
                targetFolderId = selectedId
                targetFolderName = selectedName
                isFolderPickerOpen = false
            },
            onDismiss = { isFolderPickerOpen = false }
        )
    }
}

/**
 * Individual row for a shared file with thumbnail/icon, name, size, rename button, and remove option.
 */
@Composable
private fun SharedFileRow(
    item: SharedFileItem,
    onRenameClick: () -> Unit,
    onRemoveClick: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp)
        ) {
            // Thumbnail or Category Icon
            if (item.type == FileCategoryType.IMAGE) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.size(40.dp)
                ) {
                    AsyncImage(
                        model = item.uri,
                        contentDescription = item.displayName,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            } else {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = getCategoryColor(item.type).copy(alpha = 0.12f),
                    modifier = Modifier.size(40.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = getCategoryIcon(item.type),
                            contentDescription = item.displayName,
                            tint = getCategoryColor(item.type),
                            modifier = Modifier.size(22.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(10.dp))

            // File Name & Size
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable { onRenameClick() }
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = item.displayName,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        imageVector = Icons.Rounded.Edit,
                        contentDescription = "Rename",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(14.dp)
                    )
                }
                Text(
                    text = item.formattedSize,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            IconButton(
                onClick = onRemoveClick,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.DeleteOutline,
                    contentDescription = "Remove file",
                    tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

/**
 * Full interactive folder explorer modal that supports:
 * - Navigating into subfolders
 * - Breadcrumb / Up navigation
 * - Creating brand new folders right from the picker
 * - Selecting target folder
 */
@Composable
fun FolderPickerDialog(
    repository: DriveRepository,
    initialFolderId: String?,
    initialFolderName: String,
    onFolderSelected: (folderId: String?, folderName: String) -> Unit,
    onDismiss: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()

    // Navigation Stack: Pair of (folderId, folderName)
    val folderStack = remember {
        mutableStateListOf<Pair<String?, String>>().apply {
            add(Pair(null, "My Drive"))
            if (initialFolderId != null && initialFolderId != "root") {
                add(Pair(initialFolderId, initialFolderName))
            }
        }
    }

    val currentFolder = folderStack.last()
    val currentFolderId = currentFolder.first
    val currentFolderName = currentFolder.second

    var subfolders by remember { mutableStateOf<List<DriveFile>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showNewFolderDialog by remember { mutableStateOf(false) }

    // Load subfolders for current folder
    LaunchedEffect(currentFolderId) {
        isLoading = true
        val result = repository.getFiles(folderId = currentFolderId)
        if (result.isSuccess) {
            val allFiles = result.getOrNull() ?: emptyList()
            subfolders = allFiles.filter { it.type == FileCategoryType.FOLDER }
        } else {
            subfolders = emptyList()
        }
        isLoading = false
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.75f)
                .padding(vertical = 20.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                // Header with Breadcrumb & New Folder button
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (folderStack.size > 1) {
                            IconButton(
                                onClick = { folderStack.removeAt(folderStack.size - 1) },
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                                    contentDescription = "Back",
                                    tint = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                        Column {
                            Text(
                                text = "Select Destination",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = currentFolderName,
                                style = MaterialTheme.typography.labelMedium,
                                color = BluePrimary,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    // Create New Folder Button
                    FilledTonalButton(
                        onClick = { showNewFolderDialog = true },
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.CreateNewFolder,
                            contentDescription = "New Folder",
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "New",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Folder List / Explorer Area
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    if (isLoading) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier.fillMaxSize()
                        ) {
                            CircularProgressIndicator(
                                color = BluePrimary,
                                strokeWidth = 2.5.dp,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    } else if (subfolders.isEmpty()) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(20.dp)
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    imageVector = Icons.Rounded.FolderOpen,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                                    modifier = Modifier.size(40.dp)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "No subfolders here",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = "Tap 'New' above to create one, or select this folder.",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                                )
                            }
                        }
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(8.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(subfolders) { folder ->
                                Surface(
                                    onClick = {
                                        // Navigate into this folder
                                        folderStack.add(Pair(folder.id, folder.name))
                                    },
                                    shape = RoundedCornerShape(12.dp),
                                    color = MaterialTheme.colorScheme.surface,
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 14.dp, vertical = 12.dp)
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Rounded.Folder,
                                                contentDescription = null,
                                                tint = CategoryFolder,
                                                modifier = Modifier.size(24.dp)
                                            )
                                            Text(
                                                text = folder.name,
                                                style = MaterialTheme.typography.bodyMedium,
                                                fontWeight = FontWeight.Medium,
                                                color = MaterialTheme.colorScheme.onSurface,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }

                                        Icon(
                                            imageVector = Icons.AutoMirrored.Rounded.ArrowForwardIos,
                                            contentDescription = "Open",
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                                            modifier = Modifier.size(12.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Bottom Action: Cancel & Select Folder
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Cancel")
                    }

                    Button(
                        onClick = {
                            onFolderSelected(currentFolderId, currentFolderName)
                        },
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = BluePrimary),
                        modifier = Modifier.weight(1.4f)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Check,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Select This Folder",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }

    // Create New Folder Dialog
    if (showNewFolderDialog) {
        var newFolderName by remember { mutableStateOf("") }
        var isCreating by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { showNewFolderDialog = false },
            title = {
                Text(
                    text = "New Folder",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column {
                    Text(
                        text = "Enter a name for the folder in '$currentFolderName':",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = newFolderName,
                        onValueChange = { newFolderName = it },
                        placeholder = { Text("Folder name") },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val name = newFolderName.trim()
                        if (name.isNotEmpty()) {
                            isCreating = true
                            coroutineScope.launch {
                                val res = repository.createFolder(name, currentFolderId)
                                if (res.isSuccess) {
                                    // Refresh folder list
                                    val refreshRes = repository.getFiles(currentFolderId)
                                    if (refreshRes.isSuccess) {
                                        subfolders = refreshRes.getOrNull()?.filter { it.type == FileCategoryType.FOLDER } ?: emptyList()
                                    }
                                }
                                isCreating = false
                                showNewFolderDialog = false
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BluePrimary),
                    enabled = !isCreating && newFolderName.isNotBlank()
                ) {
                    if (isCreating) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(16.dp)
                        )
                    } else {
                        Text("Create")
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showNewFolderDialog = false },
                    enabled = !isCreating
                ) {
                    Text("Cancel")
                }
            }
        )
    }
}
