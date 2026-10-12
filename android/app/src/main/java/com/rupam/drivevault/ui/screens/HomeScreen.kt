package com.rupam.drivevault.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Cloud
import androidx.compose.material.icons.rounded.CreateNewFolder
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.*
import com.rupam.drivevault.model.*
import com.rupam.drivevault.transfer.TransferManager
import com.rupam.drivevault.ui.components.*
import com.rupam.drivevault.ui.theme.BluePrimary
import androidx.compose.material.icons.rounded.SwapVert
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign

import androidx.compose.material3.pulltorefresh.PullToRefreshBox

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    userName: String,
    storageStats: StorageStats,
    recentFiles: List<DriveFile>,
    categorySyncState: CategorySyncState = CategorySyncState.IDLE,
    activeSyncCategory: FileCategoryType? = null,
    isStorageSyncing: Boolean = false,
    isRefreshing: Boolean = false,
    onRefresh: () -> Unit = {},
    onCategoryClick: (FileCategoryType) -> Unit,
    onFileClick: (DriveFile) -> Unit,
    onFileMenuClick: (DriveFile) -> Unit,
    onUploadClick: () -> Unit,
    onNewFolderClick: () -> Unit,
    onStorageDetailsClick: () -> Unit,
    onViewAllFilesClick: () -> Unit = {},
    onCameraClick: () -> Unit = {},
    onTransfersClick: () -> Unit = {},
    userPictureUrl: String? = null,
    onProfileClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val listState = rememberLazyListState()

    // ── Track scroll direction for Black Hole Collapse / Emergence ──
    var isFabVisible by remember { mutableStateOf(true) }
    var previousIndex by remember { mutableIntStateOf(0) }
    var previousScrollOffset by remember { mutableIntStateOf(0) }

    LaunchedEffect(listState.firstVisibleItemIndex, listState.firstVisibleItemScrollOffset) {
        val currentIndex = listState.firstVisibleItemIndex
        val currentOffset = listState.firstVisibleItemScrollOffset
        if (currentIndex > previousIndex || (currentIndex == previousIndex && currentOffset > previousScrollOffset + 15)) {
            // Scrolling down -> sucked into black hole
            isFabVisible = false
        } else if (currentIndex < previousIndex || (currentIndex == previousIndex && currentOffset < previousScrollOffset - 15)) {
            // Scrolling up -> emerges from black hole
            isFabVisible = true
        }
        previousIndex = currentIndex
        previousScrollOffset = currentOffset
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = onRefresh,
            modifier = Modifier.fillMaxSize()
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
            // ── Header: App Brand & Welcome ──
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "DriveVault",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Welcome back, $userName",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // ── Live Transfers Manager Button (Clean Floating Icon & Badge) ──
                        val activeTransfersCount = TransferManager.activeCountState

                        Box(
                            modifier = Modifier.wrapContentSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            IconButton(
                                onClick = onTransfersClick,
                                modifier = Modifier.size(40.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.SwapVert,
                                    contentDescription = "Transfers",
                                    tint = if (activeTransfersCount > 0) BluePrimary else MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.size(26.dp)
                                )
                            }

                            // Active Badge Indicator on top-right of icon
                            if (activeTransfersCount > 0) {
                                Surface(
                                    shape = CircleShape,
                                    color = BluePrimary,
                                    modifier = Modifier
                                        .size(17.dp)
                                        .align(Alignment.TopEnd)
                                ) {
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier.fillMaxSize()
                                    ) {
                                        Text(
                                            text = if (activeTransfersCount > 9) "9+" else activeTransfersCount.toString(),
                                            color = Color.White,
                                            fontSize = 9.5.sp,
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

                        // ── Circular Google Profile Picture Avatar (Google One Styled) ──
                        val isGoogleOne = storageStats.totalBytes > 16L * 1024L * 1024L * 1024L
                        GoogleOneAvatar(
                            pictureUrl = userPictureUrl,
                            name = userName,
                            size = 46.dp,
                            isGoogleOne = isGoogleOne,
                            onClick = onProfileClick
                        )

                    }
                }
            }

            // ── Storage Overview Card ──
            item {
                StorageGauge(
                    storageStats = storageStats,
                    isSyncing = isStorageSyncing,
                    onClick = onStorageDetailsClick
                )
            }

            // ── Category Grid: Box-less Floating Icons ──
            item {
                Text(
                    text = "Categories",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Spacer(modifier = Modifier.height(10.dp))

                // Display 2 categories per row
                val categories = storageStats.categories
                val chunked = categories.chunked(2)

                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    for (row in chunked) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            for (cat in row) {
                                val cardSyncState = if (activeSyncCategory == null || activeSyncCategory == cat.type) {
                                    categorySyncState
                                } else {
                                    CategorySyncState.IDLE
                                }
                                CategoryCard(
                                    category = cat,
                                    syncState = cardSyncState,
                                    onClick = { onCategoryClick(cat.type) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            // If row has only 1 item, fill remaining space
                            if (row.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            // ── Recent Files Section ──
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Recent Files",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    TextButton(onClick = onViewAllFilesClick) {
                        Text("View All", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            if (recentFiles.isEmpty()) {
                item {
                    Surface(
                        shape = MaterialTheme.shapes.large,
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier.padding(32.dp)
                        ) {
                            Text(
                                text = "No recent files found",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            } else {
                items(recentFiles) { file ->
                    FileItemRow(
                        file = file,
                        onClick = { onFileClick(file) },
                        onMenuClick = { onFileMenuClick(file) }
                    )
                }
            }

            // Bottom space for floating bottom bar / FAB
            item {
                Spacer(modifier = Modifier.height(64.dp))
            }
        }
    }

        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 16.dp, bottom = 16.dp)
        ) {
            ExpandableSpeedDialFab(
                isVisible = isFabVisible,
                onNewFolderClick = onNewFolderClick,
                onUploadClick = onUploadClick,
                onCameraClick = onCameraClick
            )
        }
    }
}
