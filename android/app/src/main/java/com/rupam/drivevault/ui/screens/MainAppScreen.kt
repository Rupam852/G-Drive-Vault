package com.rupam.drivevault.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.rupam.drivevault.auth.AuthManager
import com.rupam.drivevault.auth.AuthTokens
import com.rupam.drivevault.auth.AuthUser
import com.rupam.drivevault.model.*
import com.rupam.drivevault.repository.DriveRepository
import com.rupam.drivevault.ui.components.BottomNavBar
import com.rupam.drivevault.ui.components.NavTab
import kotlinx.coroutines.launch

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File
import com.rupam.drivevault.auth.GoogleAuthHelper
import com.rupam.drivevault.ui.components.ProfileViewDialog
import com.rupam.drivevault.ui.components.StorageBreakdownSheet
import com.rupam.drivevault.ui.components.CameraPhotoConfirmDialog
import com.rupam.drivevault.ui.components.FileActionBottomSheet
import com.rupam.drivevault.ui.components.FileDetailsDialog
import com.rupam.drivevault.ui.components.TransfersBottomSheet
import com.rupam.drivevault.transfer.TransferManager
import android.content.Context
import android.content.Intent
import android.os.Environment
import android.app.DownloadManager
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DeleteOutline
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat

@Composable
fun MainAppScreen(
    authManager: AuthManager,
    repository: DriveRepository,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var isLoggedIn by remember { mutableStateOf(authManager.isLoggedIn()) }
    var currentUser by remember { mutableStateOf(authManager.getUser()) }
    val pagerState = rememberPagerState(initialPage = 0, pageCount = { 3 })
    val selectedTab = when (pagerState.currentPage) {
        0 -> NavTab.HOME
        1 -> NavTab.FILES
        else -> NavTab.SETTINGS
    }
    var isAuthenticating by remember { mutableStateOf(false) }

    // Real Google Sign-In Launcher
    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        GoogleAuthHelper.parseAuthResult(result.data)
            .onSuccess { authCode ->
                isAuthenticating = true
                scope.launch {
                    repository.exchangeNativeAuth(authCode)
                        .onSuccess { authData ->
                            authManager.saveSession(authData.user, authData.tokens)
                            currentUser = authData.user
                            isLoggedIn = true
                            isAuthenticating = false
                            Toast.makeText(context, "Welcome, ${authData.user.name}!", Toast.LENGTH_SHORT).show()
                        }
                        .onFailure { err ->
                            isAuthenticating = false
                            Toast.makeText(context, "Sign in failed: ${err.message}", Toast.LENGTH_LONG).show()
                        }
                }
            }
            .onFailure { err ->
                isAuthenticating = false
                Toast.makeText(context, err.message ?: "Google Sign-In failed", Toast.LENGTH_LONG).show()
            }
    }

    // Data States
    var storageStats by remember {
        mutableStateOf(StorageStats(usedBytes = 0L, totalBytes = 15L * 1024L * 1024L * 1024L, categories = emptyList()))
    }
    var currentFiles by remember { mutableStateOf<List<DriveFile>>(emptyList()) }
    var recentFiles by remember { mutableStateOf<List<DriveFile>>(emptyList()) }
    var activePreviewFile by remember { mutableStateOf<DriveFile?>(null) }
    var previewStreamUrl by remember { mutableStateOf<String?>(null) }
    var filterCategory by remember { mutableStateOf<FileCategoryType?>(null) }

    // Dialog & Sheet States
    var showProfileDialog by remember { mutableStateOf(false) }
    var showStorageBreakdownSheet by remember { mutableStateOf(false) }

    // Breadcrumbs folder navigation stack
    var breadcrumbs by remember {
        mutableStateOf(listOf(FolderBreadcrumb(id = null, name = "My Drive")))
    }
    val currentFolderId = breadcrumbs.lastOrNull()?.id?.takeIf { !it.startsWith("cat_") }

    fun resetAppState() {
        storageStats = StorageStats(usedBytes = 0L, totalBytes = 15L * 1024L * 1024L * 1024L, categories = emptyList())
        currentFiles = emptyList()
        recentFiles = emptyList()
        breadcrumbs = listOf(FolderBreadcrumb(id = null, name = "My Drive"))
        activePreviewFile = null
        previewStreamUrl = null
        filterCategory = null
        currentUser = null
        isLoggedIn = false
    }

    var isFilesLoading by remember { mutableStateOf(false) }

    // ── 3-Dot Menu & Action States ──
    var menuTargetFile by remember { mutableStateOf<DriveFile?>(null) }
    var renameTargetFile by remember { mutableStateOf<DriveFile?>(null) }
    var renameText by remember { mutableStateOf("") }
    var deleteTargetFile by remember { mutableStateOf<DriveFile?>(null) }
    var detailsTargetFile by remember { mutableStateOf<DriveFile?>(null) }
    var showTransfersSheet by remember { mutableStateOf(false) }
    var showServerCheckScreen by remember { mutableStateOf(false) }
    var showTrashScreen by remember { mutableStateOf(false) }

    fun triggerDownload(file: DriveFile) {
        scope.launch {
            Toast.makeText(context, "Starting download for ${file.name}...", Toast.LENGTH_SHORT).show()
            repository.getDownloadTicket().onSuccess { ticket ->
                val streamUrl = repository.getStreamUrl(file.id, ticket)
                TransferManager.startDownload(
                    context = context,
                    file = file,
                    streamUrl = streamUrl,
                    onComplete = { success, err ->
                        if (success) {
                            Toast.makeText(context, "📥 Downloaded ${file.name} to Downloads!", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(context, "Download failed: $err", Toast.LENGTH_LONG).show()
                        }
                    }
                )
            }.onFailure {
                Toast.makeText(context, "Could not start download: ${it.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun triggerShare(file: DriveFile) {
        try {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                val textToShare = buildString {
                    append("File: ${file.name}\n")
                    if (file.size.isNotBlank()) append("Size: ${file.size}\n")
                    if (!file.webViewLink.isNullOrBlank()) {
                        append("Google Drive Link: ${file.webViewLink}\n")
                    }
                    append("Shared via DriveVault")
                }
                putExtra(Intent.EXTRA_SUBJECT, file.name)
                putExtra(Intent.EXTRA_TEXT, textToShare)
            }
            context.startActivity(Intent.createChooser(shareIntent, "Share ${file.name}"))
        } catch (e: Exception) {
            Toast.makeText(context, "Cannot share: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    // Refresh Data function: Parallel execution with instant cache check
    fun refreshData(skipStats: Boolean = false) {
        isFilesLoading = true
        val cached = repository.getCachedFiles(currentFolderId)
        if (cached != null) {
            currentFiles = cached
        }

        // 1. Fetch files in parallel immediately (<300ms)
        scope.launch {
            repository.getFiles(currentFolderId).onSuccess { files ->
                currentFiles = files
                if (currentFolderId == null) {
                    recentFiles = files.take(6)
                }
                isFilesLoading = false
            }.onFailure {
                isFilesLoading = false
            }
        }
        // 2. Fetch fast storage quota in parallel (<200ms), then load breakdown asynchronously
        if (!skipStats) {
            scope.launch {
                repository.getStorageStats().onSuccess { stats ->
                    storageStats = stats
                }
                repository.getStorageStats(forceRefreshBreakdown = true).onSuccess { stats ->
                    storageStats = stats
                }
            }
        }
    }

    fun selectCategoryFilter(category: FileCategoryType?) {
        filterCategory = category
        isFilesLoading = true
        if (category == null || category == FileCategoryType.FOLDER) {
            breadcrumbs = listOf(FolderBreadcrumb(id = null, name = "My Drive"))
            val cached = repository.getCachedFiles(null)
            if (cached != null) currentFiles = cached
            scope.launch {
                repository.getFiles(folderId = null).onSuccess {
                    currentFiles = if (category == FileCategoryType.FOLDER) {
                        it.filter { f -> f.type == FileCategoryType.FOLDER }
                    } else it
                    isFilesLoading = false
                }.onFailure {
                    isFilesLoading = false
                }
            }
        } else {
            val catName = category.name.lowercase().replaceFirstChar { it.uppercase() }
            breadcrumbs = listOf(
                FolderBreadcrumb(id = null, name = "My Drive"),
                FolderBreadcrumb(id = "cat_${category.name}", name = catName)
            )
            val apiFilter = when (category) {
                FileCategoryType.IMAGE -> "image"
                FileCategoryType.VIDEO -> "video"
                FileCategoryType.DOCUMENT -> "document"
                FileCategoryType.AUDIO -> "audio"
                FileCategoryType.APK -> "apk"
                FileCategoryType.ARCHIVE -> "archive"
                FileCategoryType.OTHER -> "other"
                else -> null
            }
            if (apiFilter != null) {
                val cached = repository.getCachedCategoryFiles(apiFilter)
                if (cached != null) {
                    currentFiles = cached
                }
            }
            scope.launch {
                repository.getFiles(folderId = null, filter = apiFilter).onSuccess { files ->
                    currentFiles = files
                    isFilesLoading = false
                }.onFailure { err ->
                    isFilesLoading = false
                    Toast.makeText(context, "Could not load $catName files: ${err.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    fun triggerSwitchAccount() {
        showProfileDialog = false
        GoogleAuthHelper.switchAccount(context) {
            authManager.clearSession()
            repository.clearCache()
            resetAppState()
            googleSignInLauncher.launch(GoogleAuthHelper.getSignInIntent(context))
        }
    }

    fun triggerSignOut() {
        showProfileDialog = false
        GoogleAuthHelper.signOut(context) {
            authManager.clearSession()
            repository.clearCache()
            resetAppState()
            Toast.makeText(context, "Signed out successfully", Toast.LENGTH_SHORT).show()
        }
    }

    LaunchedEffect(isLoggedIn, currentFolderId) {
        if (isLoggedIn) {
            refreshData(skipStats = currentFolderId != null)
        }
    }

    // File Picker Launcher with real-time transfer tracking
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            Toast.makeText(context, "Upload started...", Toast.LENGTH_SHORT).show()
            val tokensHeader = authManager.getTokensHeader()
            TransferManager.startUpload(
                context = context,
                uri = uri,
                targetFolderId = currentFolderId,
                authTokensHeader = tokensHeader,
                onComplete = { success, err ->
                    if (success) {
                        Toast.makeText(context, "Uploaded successfully!", Toast.LENGTH_SHORT).show()
                        refreshData(skipStats = true)
                    } else {
                        Toast.makeText(context, "Upload failed: $err", Toast.LENGTH_LONG).show()
                    }
                }
            )
        }
    }

    // ── Real Camera Capture & Confirmation ──
    var pendingPhotoFile by remember { mutableStateOf<File?>(null) }
    var pendingPhotoUri by remember { mutableStateOf<Uri?>(null) }
    var showCameraConfirmDialog by remember { mutableStateOf(false) }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && pendingPhotoUri != null) {
            showCameraConfirmDialog = true
        } else {
            pendingPhotoFile?.delete()
            pendingPhotoFile = null
            pendingPhotoUri = null
        }
    }

    fun takePhotoInternal() {
        try {
            val photoFile = File(context.cacheDir, "camera_${System.currentTimeMillis()}.jpg")
            val photoUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                photoFile
            )
            pendingPhotoFile = photoFile
            pendingPhotoUri = photoUri
            cameraLauncher.launch(photoUri)
        } catch (e: Exception) {
            Toast.makeText(context, "Cannot open camera: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    // Android 14+ / Runtime Camera Permission Launcher
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            takePhotoInternal()
        } else {
            Toast.makeText(context, "Camera permission is required to capture photos", Toast.LENGTH_SHORT).show()
        }
    }

    fun launchCamera() {
        val hasCameraPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        if (hasCameraPermission) {
            takePhotoInternal()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    // New Folder Dialog State
    var showNewFolderDialog by remember { mutableStateOf(false) }
    var newFolderName by remember { mutableStateOf("") }

    if (showNewFolderDialog) {
        AlertDialog(
            onDismissRequest = { showNewFolderDialog = false },
            title = { Text("Create New Folder") },
            text = {
                OutlinedTextField(
                    value = newFolderName,
                    onValueChange = { newFolderName = it },
                    label = { Text("Folder Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val name = newFolderName.trim().ifEmpty { "New Folder" }
                        showNewFolderDialog = false
                        newFolderName = ""
                        scope.launch {
                            repository.createFolder(name, currentFolderId)
                                .onSuccess {
                                    Toast.makeText(context, "Folder created", Toast.LENGTH_SHORT).show()
                                    refreshData()
                                }
                                .onFailure { err ->
                                    Toast.makeText(context, "Failed: ${err.message}", Toast.LENGTH_SHORT).show()
                                }
                        }
                    }
                ) {
                    Text("Create")
                }
            },
            dismissButton = {
                TextButton(onClick = { showNewFolderDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── NOT LOGGED IN: SHOW REAL GOOGLE LOGIN SCREEN ──
    if (!isLoggedIn) {
        LoginScreen(
            onGoogleSignInClick = {
                val intent = GoogleAuthHelper.getSignInIntent(context)
                googleSignInLauncher.launch(intent)
            },
            isLoading = isAuthenticating
        )
        return
    }

    // ── SERVER HEALTH & DIAGNOSTICS SCREEN ──
    if (showServerCheckScreen) {
        ServerCheckScreen(onBack = { showServerCheckScreen = false })
        return
    }

    // ── TRASH / RECYCLE BIN SCREEN ──
    if (showTrashScreen) {
        TrashScreen(
            repository = repository,
            onBack = {
                showTrashScreen = false
                refreshData()
            }
        )
        return
    }

    // ── PREVIEW OVERLAY ──
    if (activePreviewFile != null) {
        MediaPreviewScreen(
            file = activePreviewFile!!,
            streamUrl = previewStreamUrl,
            onClose = {
                activePreviewFile = null
                previewStreamUrl = null
            },
            onDownload = {
                activePreviewFile?.let { file ->
                    val url = previewStreamUrl
                    if (!url.isNullOrBlank()) {
                        TransferManager.startDownload(
                            context = context,
                            file = file,
                            streamUrl = url,
                            onComplete = { success, err ->
                                if (success) {
                                    Toast.makeText(context, "Downloaded ${file.name} to Downloads!", Toast.LENGTH_SHORT).show()
                                } else {
                                    Toast.makeText(context, "Download failed: $err", Toast.LENGTH_LONG).show()
                                }
                            }
                        )
                        Toast.makeText(context, "Download started for ${file.name}", Toast.LENGTH_SHORT).show()
                    }
                }
            },
            onShare = {
                Toast.makeText(context, "Share link generated", Toast.LENGTH_SHORT).show()
            },
            onDelete = {
                scope.launch {
                    activePreviewFile?.let { repository.trashFile(it.id) }
                    activePreviewFile = null
                    refreshData()
                }
            }
        )
        return
    }

    // ── SMART HIERARCHICAL BACK NAVIGATION ──

    // 1. When a category filter is active in Files section, back press clears it
    BackHandler(enabled = filterCategory != null && pagerState.currentPage == 1) {
        selectCategoryFilter(null)
    }

    // 2. When on Files (at root) or Settings, pressing back returns to Home first before exiting
    BackHandler(enabled = pagerState.currentPage != 0 && (pagerState.currentPage != 1 || (breadcrumbs.size <= 1 && filterCategory == null))) {
        scope.launch {
            pagerState.animateScrollToPage(0)
        }
    }

    // 3. When on Home screen, require double-press to exit so user never quits by accident
    var lastBackPressTime by remember { mutableLongStateOf(0L) }
    BackHandler(enabled = pagerState.currentPage == 0 && activePreviewFile == null && !showServerCheckScreen && !showTrashScreen) {
        val now = System.currentTimeMillis()
        if (now - lastBackPressTime < 2000L) {
            (context as? android.app.Activity)?.finish()
        } else {
            lastBackPressTime = now
            Toast.makeText(context, "Press back again to exit DriveVault", Toast.LENGTH_SHORT).show()
        }
    }

    // ── MAIN APP SHELL ──
    Scaffold(
        bottomBar = {
            BottomNavBar(
                selectedTab = selectedTab,
                onTabSelected = { tab ->
                    if (tab == NavTab.FILES) {
                        filterCategory = null
                    }
                    scope.launch {
                        pagerState.animateScrollToPage(tab.ordinal)
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
        modifier = modifier
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize()
            ) { page ->
                when (page) {
                    0 -> {
                    HomeScreen(
                        userName = currentUser?.name?.split(" ")?.firstOrNull() ?: "User",
                        storageStats = storageStats,
                        recentFiles = recentFiles,
                        userPictureUrl = currentUser?.picture,
                        onProfileClick = { showProfileDialog = true },
                        onCategoryClick = { catType ->
                            selectCategoryFilter(catType)
                            scope.launch { pagerState.animateScrollToPage(1) }
                        },
                        onFileClick = { file ->
                            activePreviewFile = file
                            previewStreamUrl = repository.getFastStreamUrl(file.id)
                            scope.launch {
                                repository.getDownloadTicket().onSuccess { ticket ->
                                    previewStreamUrl = repository.getStreamUrl(file.id, ticket)
                                }
                            }
                        },
                        onFileMenuClick = { file ->
                            menuTargetFile = file
                        },
                        onUploadClick = {
                            filePickerLauncher.launch("*/*")
                        },
                        onNewFolderClick = {
                            showNewFolderDialog = true
                        },
                        onStorageDetailsClick = {
                            showStorageBreakdownSheet = true
                            scope.launch {
                                repository.getStorageStats(forceRefreshBreakdown = true).onSuccess {
                                    storageStats = it
                                }
                            }
                        },
                        onViewAllFilesClick = {
                            filterCategory = null
                            scope.launch { pagerState.animateScrollToPage(1) }
                        },
                        onCameraClick = { launchCamera() },
                        onTransfersClick = { showTransfersSheet = true }
                    )
                }

                1 -> {
                    FileExplorerScreen(
                        files = currentFiles,
                        currentFolderId = currentFolderId,
                        breadcrumbs = breadcrumbs,
                        initialCategory = filterCategory,
                        onCategoryFilterSelected = { cat ->
                            selectCategoryFilter(cat)
                        },
                        isLoading = isFilesLoading,
                        onFolderClick = { folder ->
                            filterCategory = null
                            breadcrumbs = breadcrumbs + FolderBreadcrumb(id = folder.id, name = folder.name)
                            val cached = repository.getCachedFiles(folder.id)
                            if (cached != null) currentFiles = cached else currentFiles = emptyList()
                            scope.launch {
                                isFilesLoading = true
                                repository.getFiles(folder.id).onSuccess {
                                    currentFiles = it
                                    isFilesLoading = false
                                }.onFailure {
                                    isFilesLoading = false
                                }
                            }
                        },
                        onFileClick = { file ->
                            activePreviewFile = file
                            previewStreamUrl = repository.getFastStreamUrl(file.id)
                            scope.launch {
                                repository.getDownloadTicket().onSuccess { ticket ->
                                    previewStreamUrl = repository.getStreamUrl(file.id, ticket)
                                }
                            }
                        },
                        onFileMenuClick = { file ->
                            menuTargetFile = file
                        },
                        onBreadcrumbClick = { crumb ->
                            if (crumb.id == null || crumb.id.startsWith("cat_")) {
                                selectCategoryFilter(null)
                            } else {
                                val targetIndex = breadcrumbs.indexOf(crumb)
                                if (targetIndex >= 0) {
                                    breadcrumbs = breadcrumbs.take(targetIndex + 1)
                                    val cached = repository.getCachedFiles(crumb.id)
                                    if (cached != null) currentFiles = cached else currentFiles = emptyList()
                                    scope.launch {
                                        isFilesLoading = true
                                        repository.getFiles(crumb.id).onSuccess {
                                            currentFiles = it
                                            isFilesLoading = false
                                        }.onFailure {
                                            isFilesLoading = false
                                        }
                                    }
                                }
                            }
                        },
                        onUploadClick = {
                            filePickerLauncher.launch("*/*")
                        },
                        onNewFolderClick = {
                            showNewFolderDialog = true
                        },
                        onCameraClick = { launchCamera() }
                    )
                }

                2 -> {
                    SettingsScreen(
                        user = currentUser,
                        storageStats = storageStats,
                        onLogoutClick = { triggerSignOut() },
                        onSwitchAccountClick = { triggerSwitchAccount() },
                        onStorageDetailsClick = {
                            showStorageBreakdownSheet = true
                            scope.launch {
                                repository.getStorageStats(forceRefreshBreakdown = true).onSuccess {
                                    storageStats = it
                                }
                            }
                        },
                        onClearCacheClick = {
                            repository.clearCache()
                            Toast.makeText(context, "Cache cleared successfully", Toast.LENGTH_SHORT).show()
                            refreshData()
                        },
                        onServerCheckClick = {
                            showServerCheckScreen = true
                        },
                        onTrashClick = {
                            showTrashScreen = true
                        }
                    )
                }
            }
        }
    }
}

    // ── DIALOG OVERLAYS ──
    if (showProfileDialog) {
        ProfileViewDialog(
            user = currentUser,
            onDismiss = { showProfileDialog = false },
            onSwitchAccountClick = { triggerSwitchAccount() }
        )
    }

    if (showStorageBreakdownSheet) {
        StorageBreakdownSheet(
            storageStats = storageStats,
            onDismiss = { showStorageBreakdownSheet = false }
        )
    }

    if (showCameraConfirmDialog && pendingPhotoUri != null) {
        CameraPhotoConfirmDialog(
            photoUri = pendingPhotoUri!!,
            targetFolderName = breadcrumbs.lastOrNull()?.name ?: "My Drive",
            onConfirmUpload = {
                val uriToUpload = pendingPhotoUri!!
                val fileToDelete = pendingPhotoFile
                showCameraConfirmDialog = false
                pendingPhotoUri = null
                pendingPhotoFile = null
                Toast.makeText(context, "Photo upload started...", Toast.LENGTH_SHORT).show()
                val tokensHeader = authManager.getTokensHeader()
                TransferManager.startUpload(
                    context = context,
                    uri = uriToUpload,
                    targetFolderId = currentFolderId,
                    authTokensHeader = tokensHeader,
                    onComplete = { success, err ->
                        fileToDelete?.delete()
                        if (success) {
                            Toast.makeText(context, "Photo uploaded successfully!", Toast.LENGTH_SHORT).show()
                            refreshData(skipStats = true)
                        } else {
                            Toast.makeText(context, "Upload failed: $err", Toast.LENGTH_LONG).show()
                        }
                    }
                )
            },
            onDismiss = {
                showCameraConfirmDialog = false
                pendingPhotoFile?.delete()
                pendingPhotoFile = null
                pendingPhotoUri = null
            }
        )
    }

    if (showTransfersSheet) {
        TransfersBottomSheet(
            onDismiss = { showTransfersSheet = false }
        )
    }

    // ── 3-Dot Action Menu Bottom Sheet ──
    if (menuTargetFile != null) {
        val sheetFile = menuTargetFile!!
        FileActionBottomSheet(
            file = sheetFile,
            onDismiss = { menuTargetFile = null },
            onOpen = { target ->
                if (target.type == FileCategoryType.FOLDER) {
                    breadcrumbs = breadcrumbs + FolderBreadcrumb(target.id, target.name)
                    val cached = repository.getCachedFiles(target.id)
                    if (cached != null) currentFiles = cached else currentFiles = emptyList()
                    scope.launch {
                        isFilesLoading = true
                        repository.getFiles(target.id).onSuccess {
                            currentFiles = it
                            isFilesLoading = false
                        }.onFailure {
                            isFilesLoading = false
                        }
                    }
                } else {
                    activePreviewFile = target
                    previewStreamUrl = repository.getFastStreamUrl(target.id)
                    scope.launch {
                        repository.getDownloadTicket().onSuccess { ticket ->
                            previewStreamUrl = repository.getStreamUrl(target.id, ticket)
                        }
                    }
                }
            },
            onDownload = { target ->
                triggerDownload(target)
            },
            onRename = { target ->
                renameTargetFile = target
                renameText = target.name
            },
            onToggleStar = { target ->
                scope.launch {
                    val newStar = !target.starred
                    repository.starFile(target.id, newStar).onSuccess {
                        Toast.makeText(context, if (newStar) "Added to Starred" else "Removed from Starred", Toast.LENGTH_SHORT).show()
                        refreshData(skipStats = true)
                    }.onFailure {
                        Toast.makeText(context, "Failed: ${it.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            },
            onShare = { target ->
                triggerShare(target)
            },
            onDelete = { target ->
                deleteTargetFile = target
            },
            onViewDetails = { target ->
                detailsTargetFile = target
            }
        )
    }

    // ── Rename Dialog ──
    if (renameTargetFile != null) {
        val target = renameTargetFile!!
        AlertDialog(
            onDismissRequest = { renameTargetFile = null },
            title = { Text("Rename") },
            text = {
                OutlinedTextField(
                    value = renameText,
                    onValueChange = { renameText = it },
                    label = { Text("Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val newName = renameText.trim()
                        renameTargetFile = null
                        if (newName.isNotBlank() && newName != target.name) {
                            scope.launch {
                                repository.renameFile(target.id, newName).onSuccess {
                                    Toast.makeText(context, "Renamed successfully", Toast.LENGTH_SHORT).show()
                                    refreshData(skipStats = true)
                                }.onFailure {
                                    Toast.makeText(context, "Rename failed: ${it.message}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    }
                ) {
                    Text("Rename")
                }
            },
            dismissButton = {
                TextButton(onClick = { renameTargetFile = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── Delete Confirmation Dialog ──
    if (deleteTargetFile != null) {
        val target = deleteTargetFile!!
        AlertDialog(
            onDismissRequest = { deleteTargetFile = null },
            icon = { Icon(Icons.Rounded.DeleteOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Move to Trash?") },
            text = { Text("Are you sure you want to move '${target.name}' to trash?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        deleteTargetFile = null
                        scope.launch {
                            repository.trashFile(target.id).onSuccess {
                                Toast.makeText(context, "Moved to trash", Toast.LENGTH_SHORT).show()
                                refreshData(skipStats = true)
                            }.onFailure {
                                Toast.makeText(context, "Delete failed: ${it.message}", Toast.LENGTH_SHORT).show()
                            }
                        }
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Move to Trash")
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteTargetFile = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── File Details Dialog ──
    if (detailsTargetFile != null) {
        FileDetailsDialog(
            file = detailsTargetFile!!,
            onDismiss = { detailsTargetFile = null }
        )
    }
}
