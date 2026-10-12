package com.rupam.drivevault.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import com.rupam.drivevault.ui.components.ExpandableSpeedDialFab
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material.icons.automirrored.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rupam.drivevault.model.DriveFile
import com.rupam.drivevault.model.FileCategoryType
import com.rupam.drivevault.ui.components.FileItemRow
import com.rupam.drivevault.ui.components.getCategoryColor
import com.rupam.drivevault.ui.components.getCategoryIcon
import com.rupam.drivevault.ui.theme.BluePrimary
import com.rupam.drivevault.transfer.TransferManager
import androidx.compose.material3.pulltorefresh.PullToRefreshBox

data class FolderBreadcrumb(
    val id: String?,
    val name: String
)

enum class SortOption {
    NAME_ASC,
    NAME_DESC,
    DATE_DESC,
    SIZE_DESC
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FileExplorerScreen(
    files: List<DriveFile>,
    currentFolderId: String?,
    breadcrumbs: List<FolderBreadcrumb>,
    onFolderClick: (DriveFile) -> Unit,
    onFileClick: (DriveFile) -> Unit,
    onFileMenuClick: (DriveFile) -> Unit,
    onBreadcrumbClick: (FolderBreadcrumb) -> Unit,
    onUploadClick: () -> Unit,
    onNewFolderClick: () -> Unit,
    onCameraClick: () -> Unit = {},
    initialCategory: FileCategoryType? = null,
    onCategoryFilterSelected: (FileCategoryType?) -> Unit = {},
    onTransfersClick: () -> Unit = {},
    isLoading: Boolean = false,
    isRefreshing: Boolean = false,
    onRefresh: () -> Unit = {},
    onBatchMove: (List<DriveFile>) -> Unit = {},
    onBatchTrash: (List<DriveFile>) -> Unit = {},
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }

    // Multi-Selection state
    val selectedFiles = remember { mutableStateMapOf<String, DriveFile>() }
    val isSelectionMode = selectedFiles.isNotEmpty()

    // Reset selection when changing folders or categories
    LaunchedEffect(currentFolderId) {
        selectedFiles.clear()
    }

    // Intercept back gesture if in selection mode
    BackHandler(enabled = isSelectionMode) {
        selectedFiles.clear()
    }

    // Intercept back gesture to clear search query if typing/filtering
    BackHandler(enabled = !isSelectionMode && searchQuery.isNotBlank()) {
        searchQuery = ""
    }

    // Intercept physical and gesture back press to navigate to parent folder
    BackHandler(enabled = !isSelectionMode && breadcrumbs.size > 1 && searchQuery.isBlank()) {
        val parent = breadcrumbs.dropLast(1).lastOrNull()
        if (parent != null) {
            onBreadcrumbClick(parent)
        }
    }

    fun toggleSelection(file: DriveFile) {
        if (selectedFiles.containsKey(file.id)) {
            selectedFiles.remove(file.id)
        } else {
            selectedFiles[file.id] = file
        }
    }

    var selectedCategory by remember(initialCategory) { mutableStateOf(initialCategory) }
    var isGridView by remember { mutableStateOf(false) }
    var currentSort by remember { mutableStateOf(SortOption.DATE_DESC) }
    var showSortMenu by remember { mutableStateOf(false) }

    // Scroll states for Black Hole Animation
    val listState = rememberLazyListState()
    val gridState = rememberLazyGridState()
    var isFabVisible by remember { mutableStateOf(true) }
    var previousIndex by remember { mutableIntStateOf(0) }
    var previousScrollOffset by remember { mutableIntStateOf(0) }

    val activeIndex = if (isGridView) gridState.firstVisibleItemIndex else listState.firstVisibleItemIndex
    val activeOffset = if (isGridView) gridState.firstVisibleItemScrollOffset else listState.firstVisibleItemScrollOffset

    LaunchedEffect(activeIndex, activeOffset) {
        if (activeIndex > previousIndex || (activeIndex == previousIndex && activeOffset > previousScrollOffset + 15)) {
            // Scrolling down -> sucked into black hole
            isFabVisible = false
        } else if (activeIndex < previousIndex || (activeIndex == previousIndex && activeOffset < previousScrollOffset - 15)) {
            // Scrolling up -> emerges from black hole
            isFabVisible = true
        }
        previousIndex = activeIndex
        previousScrollOffset = activeOffset
    }

    // Filter and Sort files
    val filteredFiles = remember(files, searchQuery, selectedCategory, currentSort) {
        files.filter { file ->
            val matchesQuery = searchQuery.isBlank() || file.name.contains(searchQuery, ignoreCase = true)
            val matchesCat = if (selectedCategory == null) {
                true
            } else {
                file.type == selectedCategory
            }
            matchesQuery && matchesCat
        }.sortedWith { a, b ->
            // Folders always first
            if (a.type == FileCategoryType.FOLDER && b.type != FileCategoryType.FOLDER) -1
            else if (a.type != FileCategoryType.FOLDER && b.type == FileCategoryType.FOLDER) 1
            else when (currentSort) {
                SortOption.NAME_ASC -> a.name.compareTo(b.name, ignoreCase = true)
                SortOption.NAME_DESC -> b.name.compareTo(a.name, ignoreCase = true)
                SortOption.DATE_DESC -> b.timestamp.compareTo(a.timestamp)
                SortOption.SIZE_DESC -> b.sizeBytes.compareTo(a.sizeBytes)
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // ── Top Header & Search Bar / Selection Header ──
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
            ) {
                if (isSelectionMode) {
                    Surface(
                        shape = RoundedCornerShape(18.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        border = BorderStroke(1.dp, BluePrimary.copy(alpha = 0.4f)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                IconButton(
                                    onClick = { selectedFiles.clear() },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Close,
                                        contentDescription = "Clear Selection",
                                        tint = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                                Text(
                                    text = "${selectedFiles.size} selected",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }

                            val allSelected = filteredFiles.isNotEmpty() && filteredFiles.all { selectedFiles.containsKey(it.id) }
                            TextButton(
                                onClick = {
                                    if (allSelected) {
                                        selectedFiles.clear()
                                    } else {
                                        filteredFiles.forEach { selectedFiles[it.id] = it }
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = if (allSelected) Icons.Rounded.Deselect else Icons.Rounded.SelectAll,
                                    contentDescription = null,
                                    tint = BluePrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (allSelected) "Deselect All" else "Select All",
                                    color = BluePrimary,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp
                                )
                            }
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = { Text("Search files & folders...", fontSize = 14.sp) },
                            leadingIcon = {
                                Icon(Icons.Rounded.Search, contentDescription = "Search", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            },
                            trailingIcon = {
                                if (searchQuery.isNotEmpty()) {
                                    IconButton(onClick = { searchQuery = "" }) {
                                        Icon(Icons.Rounded.Close, contentDescription = "Clear")
                                    }
                                }
                            },
                            shape = RoundedCornerShape(18.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = MaterialTheme.colorScheme.surface,
                                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                                focusedBorderColor = BluePrimary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)
                            ),
                            modifier = Modifier.weight(1f)
                        )

                        // ── Live Transfers Manager Button (with reactive badge) ──
                        val activeTransfersCount = TransferManager.activeCountState

                        Box {
                            Surface(
                                shape = CircleShape,
                                color = if (activeTransfersCount > 0) BluePrimary.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surfaceVariant,
                                border = BorderStroke(
                                    1.dp,
                                    if (activeTransfersCount > 0) BluePrimary else MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                                ),
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .clickable { onTransfersClick() }
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Rounded.SwapVert,
                                        contentDescription = "Transfers",
                                        tint = if (activeTransfersCount > 0) BluePrimary else MaterialTheme.colorScheme.onSurface,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                            }

                            // Active Badge Indicator
                            if (activeTransfersCount > 0) {
                                Surface(
                                    shape = CircleShape,
                                    color = BluePrimary,
                                    modifier = Modifier
                                        .size(18.dp)
                                        .align(Alignment.TopEnd)
                                ) {
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier.fillMaxSize()
                                    ) {
                                        Text(
                                            text = if (activeTransfersCount > 9) "9+" else activeTransfersCount.toString(),
                                            color = Color.White,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            textAlign = TextAlign.Center,
                                            style = TextStyle(
                                                platformStyle = @Suppress("DEPRECATION") PlatformTextStyle(
                                                    includeFontPadding = false
                                                ),
                                                lineHeight = 10.sp,
                                                lineHeightStyle = LineHeightStyle(
                                                    alignment = LineHeightStyle.Alignment.Center,
                                                    trim = LineHeightStyle.Trim.Both
                                                )
                                            ),
                                            modifier = Modifier.offset(y = (-0.5).dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // ── Breadcrumb Navigation + View/Sort Controls Row ──
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Breadcrumb Trail (Scrollable)
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .horizontalScroll(rememberScrollState()),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (breadcrumbs.size > 1) {
                            IconButton(
                                onClick = {
                                    val parent = breadcrumbs.dropLast(1).lastOrNull()
                                    if (parent != null) onBreadcrumbClick(parent)
                                },
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                                    contentDescription = "Go back",
                                    tint = BluePrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(4.dp))
                        }
                        breadcrumbs.forEachIndexed { index, crumb ->
                            val isLast = index == breadcrumbs.lastIndex
                            TextButton(
                                onClick = { if (!isLast) onBreadcrumbClick(crumb) },
                                colors = ButtonDefaults.textButtonColors(
                                    contentColor = if (isLast) BluePrimary else MaterialTheme.colorScheme.onSurfaceVariant
                                ),
                                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = crumb.name,
                                    fontWeight = if (isLast) FontWeight.Bold else FontWeight.Medium,
                                    fontSize = 13.sp
                                )
                            }
                            if (!isLast) {
                                Icon(
                                    imageVector = Icons.Rounded.ChevronRight,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.width(6.dp))

                    // Compact View Toggle & Sort Controls (placed on the right end of Breadcrumb row)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        IconButton(
                            onClick = { isGridView = !isGridView },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = if (isGridView) Icons.AutoMirrored.Rounded.List else Icons.Rounded.GridView,
                                contentDescription = "Toggle View",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Box {
                            IconButton(
                                onClick = { showSortMenu = true },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Rounded.Sort,
                                    contentDescription = "Sort",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            DropdownMenu(
                                expanded = showSortMenu,
                                onDismissRequest = { showSortMenu = false }
                            ) {
                                DropdownMenuItem(
                                    text = { Text("Name (A-Z)") },
                                    onClick = { currentSort = SortOption.NAME_ASC; showSortMenu = false }
                                )
                                DropdownMenuItem(
                                    text = { Text("Name (Z-A)") },
                                    onClick = { currentSort = SortOption.NAME_DESC; showSortMenu = false }
                                )
                                DropdownMenuItem(
                                    text = { Text("Date (Newest)") },
                                    onClick = { currentSort = SortOption.DATE_DESC; showSortMenu = false }
                                )
                                DropdownMenuItem(
                                    text = { Text("Size (Largest)") },
                                    onClick = { currentSort = SortOption.SIZE_DESC; showSortMenu = false }
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // ── Category Chips (Full Width Horizontal Scroll) ──
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = selectedCategory == null,
                        onClick = {
                            selectedCategory = null
                            onCategoryFilterSelected(null)
                        },
                        label = { Text("All") },
                        shape = RoundedCornerShape(50)
                    )
                    FileCategoryType.values().filter { it != FileCategoryType.FOLDER }.forEach { cat ->
                        FilterChip(
                            selected = selectedCategory == cat,
                            onClick = {
                                val newCat = if (selectedCategory == cat) null else cat
                                selectedCategory = newCat
                                onCategoryFilterSelected(newCat)
                            },
                            label = { Text(cat.name.lowercase().replaceFirstChar { it.uppercase() }) },
                            shape = RoundedCornerShape(50)
                        )
                    }
                }
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

            if (isLoading) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth().height(2.dp),
                    color = BluePrimary,
                    trackColor = Color.Transparent
                )
            }

            // ── File Content List or Grid with Pull-to-Refresh ──
            PullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh = onRefresh,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                if (isLoading && filteredFiles.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(
                                color = BluePrimary,
                                strokeWidth = 3.dp,
                                modifier = Modifier.size(36.dp)
                            )
                            Spacer(modifier = Modifier.height(14.dp))
                            Text(
                                text = "Opening folder...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else if (filteredFiles.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Rounded.FolderOpen,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = if (searchQuery.isNotEmpty()) "No files match '$searchQuery'" else "This folder is empty",
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else if (isGridView) {
                    LazyVerticalGrid(
                        state = gridState,
                        columns = GridCells.Fixed(2),
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(filteredFiles, key = { it.id }) { file ->
                            val isSelected = selectedFiles.containsKey(file.id)
                            GridFileCard(
                                file = file,
                                isSelected = isSelected,
                                isInSelectionMode = isSelectionMode,
                                onClick = {
                                    if (isSelectionMode) {
                                        toggleSelection(file)
                                    } else {
                                        if (file.type == FileCategoryType.FOLDER) onFolderClick(file) else onFileClick(file)
                                    }
                                },
                                onLongClick = {
                                    toggleSelection(file)
                                },
                                onMenuClick = { onFileMenuClick(file) }
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        contentPadding = PaddingValues(
                            start = 20.dp,
                            end = 20.dp,
                            top = 12.dp,
                            bottom = if (isSelectionMode) 88.dp else 12.dp
                        ),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(filteredFiles, key = { it.id }) { file ->
                            val isSelected = selectedFiles.containsKey(file.id)
                            FileItemRow(
                                file = file,
                                isSelected = isSelected,
                                isInSelectionMode = isSelectionMode,
                                onClick = {
                                    if (isSelectionMode) {
                                        toggleSelection(file)
                                    } else {
                                        if (file.type == FileCategoryType.FOLDER) onFolderClick(file) else onFileClick(file)
                                    }
                                },
                                onLongClick = {
                                    toggleSelection(file)
                                },
                                onMenuClick = { onFileMenuClick(file) }
                            )
                        }
                    }
                }
            }
        }

        // Floating Bottom Multi-Selection Action Bar (Move & Trash)
        AnimatedVisibility(
            visible = isSelectionMode,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp, start = 16.dp, end = 16.dp)
        ) {
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = MaterialTheme.colorScheme.surfaceColorAtElevation(6.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
                shadowElevation = 8.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            val targets = selectedFiles.values.toList()
                            selectedFiles.clear()
                            onBatchMove(targets)
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = BluePrimary,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.DriveFileMove,
                            contentDescription = "Move",
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Move (${selectedFiles.size})",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp
                        )
                    }

                    OutlinedButton(
                        onClick = {
                            val targets = selectedFiles.values.toList()
                            selectedFiles.clear()
                            onBatchTrash(targets)
                        },
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error
                        ),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.6f)),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.DeleteOutline,
                            contentDescription = "Trash",
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Trash (${selectedFiles.size})",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }

        // Expandable Speed Dial FAB
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 16.dp, bottom = 16.dp)
        ) {
            ExpandableSpeedDialFab(
                isVisible = isFabVisible && !isSelectionMode,
                onNewFolderClick = onNewFolderClick,
                onUploadClick = onUploadClick,
                onCameraClick = onCameraClick
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun GridFileCard(
    file: DriveFile,
    onClick: () -> Unit,
    onMenuClick: () -> Unit,
    isSelected: Boolean = false,
    isInSelectionMode: Boolean = false,
    onLongClick: (() -> Unit)? = null
) {
    val iconColor = getCategoryColor(file.type)

    val backgroundColor = if (isSelected) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.surface
    }

    val borderColor = if (isSelected) {
        BluePrimary
    } else {
        MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)
    }

    val borderWidth = if (isSelected) 1.5.dp else 1.dp

    Surface(
        shape = RoundedCornerShape(18.dp),
        color = backgroundColor,
        border = BorderStroke(borderWidth, borderColor),
        shadowElevation = 0.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .combinedClickable(
                    onClick = onClick,
                    onLongClick = onLongClick
                )
                .padding(14.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Icon(
                    imageVector = getCategoryIcon(file.type),
                    contentDescription = file.name,
                    tint = iconColor,
                    modifier = Modifier.size(32.dp)
                )
                if (isInSelectionMode) {
                    Checkbox(
                        checked = isSelected,
                        onCheckedChange = { onClick() },
                        colors = CheckboxDefaults.colors(
                            checkedColor = BluePrimary,
                            uncheckedColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                        ),
                        modifier = Modifier.size(28.dp)
                    )
                } else {
                    IconButton(onClick = onMenuClick, modifier = Modifier.size(24.dp)) {
                        Icon(
                            imageVector = Icons.Rounded.MoreVert,
                            contentDescription = "Options",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Column {
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
        }
    }
}
}
