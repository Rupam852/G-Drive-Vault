package com.rupam.drivevault.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.unit.dp
import com.rupam.drivevault.auth.AuthManager
import com.rupam.drivevault.auth.AuthTokens
import com.rupam.drivevault.auth.AuthUser
import com.rupam.drivevault.model.*
import com.rupam.drivevault.repository.DriveRepository
import com.rupam.drivevault.ui.components.BottomNavBar
import com.rupam.drivevault.ui.components.NavTab
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

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
import com.rupam.drivevault.ui.components.MoveFilesDialog
import com.rupam.drivevault.ui.components.ShareToUploadDialog
import com.rupam.drivevault.ui.components.ShareAccessDialog
import com.rupam.drivevault.ui.components.SignOutLoadingDialog
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
    incomingShareUris: List<Uri>? = null,
    onClearShareUris: () -> Unit = {},
    openUpdaterOnLaunch: Boolean = false,
    onResetOpenUpdater: () -> Unit = {},
    openTransfersOnLaunch: Boolean = false,
    onResetOpenTransfers: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()

    var isPullRefreshing by remember { mutableStateOf(false) }

    var isLoggedIn by remember { mutableStateOf(authManager.isLoggedIn()) }
    var currentUser by remember { mutableStateOf(authManager.getUser()) }
    var isAppLocked by remember {
        mutableStateOf(authManager.isLoggedIn() && authManager.isBiometricEnabled())
    }
    var isLaunchingExternalIntent by remember { mutableStateOf(false) }

    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        var wasInBackground = false
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_STOP) {
                if (!isLaunchingExternalIntent) {
                    wasInBackground = true
                }
            } else if (event == androidx.lifecycle.Lifecycle.Event.ON_START) {
                if (wasInBackground && authManager.isLoggedIn() && authManager.isBiometricEnabled()) {
                    isAppLocked = true
                }
                wasInBackground = false
                isLaunchingExternalIntent = false
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

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
        mutableStateOf(StorageStats(usedBytes = 0L, totalBytes = 0L, categories = emptyList()))
    }
    var isStorageQuotaSyncing by remember { mutableStateOf(true) }
    var categorySyncState by remember { mutableStateOf(CategorySyncState.SYNCING) }
    var activeSyncCategory by remember { mutableStateOf<FileCategoryType?>(null) }
    var currentFiles by remember { mutableStateOf<List<DriveFile>>(emptyList()) }
    var recentFiles by remember { mutableStateOf<List<DriveFile>>(emptyList()) }
    var activePreviewFile by remember { mutableStateOf<DriveFile?>(null) }
    var previewStreamUrl by remember { mutableStateOf<String?>(null) }
    var previewFallbackUrl by remember { mutableStateOf<String?>(null) }
    var filterCategory by remember { mutableStateOf<FileCategoryType?>(null) }

    // Dialog & Sheet States
    var showProfileDialog by remember { mutableStateOf(false) }
    var showStorageBreakdownSheet by remember { mutableStateOf(false) }
    var isSigningOut by remember { mutableStateOf(false) }
    var signOutDialogTitle by remember { mutableStateOf("Signing out...") }
    var signOutDialogSubtitle by remember { mutableStateOf("Clearing secure session & cache...") }

    // Breadcrumbs folder navigation stack
    var breadcrumbs by remember {
        mutableStateOf(listOf(FolderBreadcrumb(id = null, name = "My Drive")))
    }
    val currentFolderId = breadcrumbs.lastOrNull()?.id?.takeIf { !it.startsWith("cat_") }

    fun resetAppState() {
        storageStats = StorageStats(usedBytes = 0L, totalBytes = 0L, categories = emptyList())
        isStorageQuotaSyncing = true
        categorySyncState = CategorySyncState.SYNCING
        currentFiles = emptyList()
        recentFiles = emptyList()
        breadcrumbs = listOf(FolderBreadcrumb(id = null, name = "My Drive"))
        activePreviewFile = null
        previewStreamUrl = null
        previewFallbackUrl = null
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
    var shareTargetFile by remember { mutableStateOf<DriveFile?>(null) }
    var filesToMove by remember { mutableStateOf<List<DriveFile>?>(null) }
    var batchTrashTargets by remember { mutableStateOf<List<DriveFile>?>(null) }
    var showTransfersSheet by remember { mutableStateOf(false) }
    var showServerCheckScreen by remember { mutableStateOf(false) }
    var showTrashScreen by remember { mutableStateOf(false) }
    var showNotificationSettingsScreen by remember { mutableStateOf(false) }
    var showAboutScreen by remember { mutableStateOf(false) }
    var showAppUpdaterScreen by remember { mutableStateOf(false) }

    LaunchedEffect(openUpdaterOnLaunch) {
        if (openUpdaterOnLaunch) {
            showAppUpdaterScreen = true
            onResetOpenUpdater()
        }
    }

    LaunchedEffect(openTransfersOnLaunch) {
        if (openTransfersOnLaunch) {
            showTransfersSheet = true
            onResetOpenTransfers()
        }
    }

    // Automatic Android 13/14+ Notification Permission Request
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { /* granted or denied */ }

    LaunchedEffect(Unit) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            val hasNotifPermission = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!hasNotifPermission) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (authManager.isAutoCheckUpdateEnabled()) {
            com.rupam.drivevault.update.AppUpdateManager.checkForUpdates(context, isManual = false)
        }
    }

    fun triggerDownload(file: DriveFile) {
        showTransfersSheet = true
        scope.launch {
            val isFolder = file.type == FileCategoryType.FOLDER
            val displayName = if (isFolder && !file.name.endsWith(".zip", ignoreCase = true)) "${file.name}.zip" else file.name
            Toast.makeText(context, if (isFolder) "Preparing ZIP download for ${file.name}..." else "Starting download for ${file.name}...", Toast.LENGTH_SHORT).show()
            repository.getDownloadTicket().onSuccess { ticket ->
                val renderUrl = repository.getRenderDownloadUrl(file.id, ticket)
                // For folders, always stream from backend renderUrl since it has the live ZIP compression engine
                val streamUrl = if (isFolder) renderUrl else repository.getStreamUrl(file.id, ticket)
                val fallbackUrl = renderUrl
                TransferManager.startDownload(
                    context = context,
                    file = file,
                    streamUrl = streamUrl,
                    fallbackUrl = fallbackUrl,
                    onComplete = { success, err ->
                        if (success) {
                            Toast.makeText(context, "📥 Downloaded $displayName to Downloads!", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(context, "Download failed: $err", Toast.LENGTH_LONG).show()
                        }
                    }
                )
            }.onFailure {
                val streamUrl = if (isFolder) {
                    "https://g-drive-vault.onrender.com/api/drive/download/${file.id}"
                } else {
                    repository.getFastStreamUrl(file.id)
                }
                TransferManager.startDownload(
                    context = context,
                    file = file,
                    streamUrl = streamUrl,
                    onComplete = { success, err ->
                        if (success) {
                            Toast.makeText(context, "📥 Downloaded $displayName to Downloads!", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(context, "Download failed: $err", Toast.LENGTH_LONG).show()
                        }
                    }
                )
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
    fun refreshData(skipStats: Boolean = false, forceNetwork: Boolean = false, targetCategoryType: FileCategoryType? = null) {
        isFilesLoading = true
        if (targetCategoryType != null) {
            activeSyncCategory = targetCategoryType
        }
        if (forceNetwork) {
            repository.clearCache(currentFolderId)
        }

        if (filterCategory != null) {
            val apiFilter = when (filterCategory) {
                FileCategoryType.IMAGE -> "image"
                FileCategoryType.VIDEO -> "video"
                FileCategoryType.DOCUMENT -> "document"
                FileCategoryType.AUDIO -> "audio"
                FileCategoryType.APK -> "apk"
                FileCategoryType.ARCHIVE -> "archive"
                FileCategoryType.FOLDER -> "folder"
                FileCategoryType.OTHER -> "other"
                null -> null
            }
            if (!forceNetwork) {
                apiFilter?.let { repository.getCachedCategoryFiles(it) }?.let { currentFiles = it }
            }
            scope.launch {
                repository.getFiles(folderId = null, filter = apiFilter).onSuccess { files ->
                    currentFiles = files
                    isFilesLoading = false
                }.onFailure {
                    isFilesLoading = false
                }
            }
        } else {
            if (!forceNetwork) {
                val cached = repository.getCachedFiles(currentFolderId)
                if (cached != null) {
                    currentFiles = cached
                }
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
        }

        // 2. Fetch fast storage quota in parallel (<200ms), then load breakdown asynchronously
        if (!skipStats) {
            scope.launch {
                isStorageQuotaSyncing = true
                categorySyncState = CategorySyncState.SYNCING
                repository.getStorageStats().onSuccess { stats ->
                    storageStats = stats
                    if (stats.totalBytes > 0L) {
                        isStorageQuotaSyncing = false
                    }
                }
                repository.getStorageStats(forceRefreshBreakdown = true).onSuccess { stats ->
                    storageStats = stats
                    isStorageQuotaSyncing = false
                    categorySyncState = CategorySyncState.SYNCED
                    delay(900)
                    categorySyncState = CategorySyncState.IDLE
                    activeSyncCategory = null
                }.onFailure {
                    isStorageQuotaSyncing = false
                    categorySyncState = CategorySyncState.IDLE
                    activeSyncCategory = null
                }
            }
        }
    }

    fun performPullRefresh() {
        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
        isPullRefreshing = true
        refreshData(skipStats = false, forceNetwork = true)
        scope.launch {
            delay(1000)
            isPullRefreshing = false
        }
    }

    fun selectCategoryFilter(category: FileCategoryType?) {
        filterCategory = category
        isFilesLoading = true
        if (category == null) {
            breadcrumbs = listOf(FolderBreadcrumb(id = null, name = "My Drive"))
            val cached = repository.getCachedFiles(null)
            if (cached != null) currentFiles = cached
            scope.launch {
                repository.getFiles(folderId = null).onSuccess {
                    currentFiles = it
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
                FileCategoryType.FOLDER -> "folder"
                FileCategoryType.OTHER -> "other"
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
        signOutDialogTitle = "Switching account..."
        signOutDialogSubtitle = "Preparing Google account chooser..."
        isSigningOut = true
        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
        scope.launch {
            val startTime = System.currentTimeMillis()
            var googleSignOutDone = false
            GoogleAuthHelper.switchAccount(context) {
                googleSignOutDone = true
            }
            while (!googleSignOutDone && (System.currentTimeMillis() - startTime) < 3000L) {
                delay(50L)
            }
            val elapsed = System.currentTimeMillis() - startTime
            if (elapsed < 800L) {
                delay(800L - elapsed)
            }
            authManager.clearSession()
            repository.clearCache()
            resetAppState()
            isSigningOut = false
            googleSignInLauncher.launch(GoogleAuthHelper.getSignInIntent(context))
        }
    }

    fun triggerSignOut() {
        showProfileDialog = false
        signOutDialogTitle = "Signing out..."
        signOutDialogSubtitle = "Clearing secure session & cache..."
        isSigningOut = true
        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
        scope.launch {
            val startTime = System.currentTimeMillis()
            var googleSignOutDone = false
            GoogleAuthHelper.signOut(context) {
                googleSignOutDone = true
            }
            while (!googleSignOutDone && (System.currentTimeMillis() - startTime) < 3000L) {
                delay(50L)
            }
            val elapsed = System.currentTimeMillis() - startTime
            if (elapsed < 900L) {
                delay(900L - elapsed)
            }
            authManager.clearSession()
            repository.clearCache()
            resetAppState()
            delay(200L)
            isSigningOut = false
            Toast.makeText(context, "Signed out successfully", Toast.LENGTH_SHORT).show()
        }
    }

    LaunchedEffect(isLoggedIn, currentFolderId) {
        if (isLoggedIn) {
            refreshData(skipStats = currentFolderId != null)
        }
    }

    fun handleUploadSuccess(dto: com.rupam.drivevault.network.DriveFileDto?) {
        Toast.makeText(context, "Uploaded successfully!", Toast.LENGTH_SHORT).show()

        val uploadedType = if (dto != null) {
            val newFile = repository.mapDtoToDriveFile(dto)
            if (filterCategory == null || filterCategory == newFile.type) {
                currentFiles = listOf(newFile) + currentFiles.filter { it.id != newFile.id }
            }
            recentFiles = listOf(newFile) + recentFiles.filter { it.id != newFile.id }.take(5)
            newFile.type
        } else null

        // 2. Clear cache and perform targeted network refresh with storage stats
        repository.clearCache()
        refreshData(skipStats = false, forceNetwork = true, targetCategoryType = uploadedType)
    }

    // File Picker Launcher with real-time transfer tracking
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            Toast.makeText(context, "Upload started...", Toast.LENGTH_SHORT).show()
            showTransfersSheet = true
            val tokensHeader = authManager.getTokensHeader()
            TransferManager.startUpload(
                context = context,
                uri = uri,
                targetFolderId = currentFolderId,
                authTokensHeader = tokensHeader,
                onComplete = { success, err, uploadedDto ->
                    if (success) {
                        handleUploadSuccess(uploadedDto)
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
            isLaunchingExternalIntent = true
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
                                .onSuccess { newFolder ->
                                    Toast.makeText(context, "Folder created", Toast.LENGTH_SHORT).show()
                                    currentFiles = listOf(newFolder) + currentFiles
                                    repository.clearCache()
                                    refreshData(skipStats = false, forceNetwork = true)
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

    // ── SMOOTH SIGN OUT LOADING OVERLAY ──
    SignOutLoadingDialog(
        visible = isSigningOut,
        title = signOutDialogTitle,
        subtitle = signOutDialogSubtitle
    )

    // ── NOT LOGGED IN: SHOW REAL GOOGLE LOGIN SCREEN ──
    if (!isLoggedIn) {
        LoginScreen(
            onGoogleSignInClick = {
                val intent = GoogleAuthHelper.getSignInIntent(context)
                isLaunchingExternalIntent = true
                googleSignInLauncher.launch(intent)
            },
            isLoading = isAuthenticating
        )
        return
    }

    // ── BIOMETRIC LOCK SCREEN ──
    if (isAppLocked) {
        BiometricLockScreen(
            onUnlockSuccess = {
                isAppLocked = false
            },
            onLogoutClick = {
                isAppLocked = false
                triggerSignOut()
            }
        )
        return
    }

    // ── SERVER HEALTH & DIAGNOSTICS SCREEN ──
    if (showServerCheckScreen) {
        ServerCheckScreen(onBack = { showServerCheckScreen = false })
        return
    }

    // ── NOTIFICATION SETTINGS SCREEN ──
    if (showNotificationSettingsScreen) {
        NotificationSettingsScreen(
            authManager = authManager,
            onBack = { showNotificationSettingsScreen = false }
        )
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

    // ── ABOUT SCREEN ──
    if (showAboutScreen) {
        AboutScreen(
            onBack = { showAboutScreen = false },
            userEmail = currentUser?.email
        )
        return
    }

    // ── APP UPDATER SCREEN ──
    if (showAppUpdaterScreen) {
        AppUpdaterScreen(
            onBack = { showAppUpdaterScreen = false }
        )
        return
    }

    // ── PREVIEW OVERLAY ──
    if (activePreviewFile != null) {
        MediaPreviewScreen(
            file = activePreviewFile!!,
            streamUrl = previewStreamUrl,
            fallbackUrl = previewFallbackUrl,
            isHighQuality = authManager.isHighQualityStreaming(),
            onClose = {
                activePreviewFile = null
                previewStreamUrl = null
                previewFallbackUrl = null
            },
            onDownload = {
                activePreviewFile?.let { file ->
                    val url = previewStreamUrl
                    if (!url.isNullOrBlank()) {
                        scope.launch {
                            val ticket = repository.getDownloadTicket().getOrNull()
                            val fallbackUrl = if (ticket != null) repository.getRenderDownloadUrl(file.id, ticket) else null
                            TransferManager.startDownload(
                                context = context,
                                file = file,
                                streamUrl = url,
                                fallbackUrl = fallbackUrl,
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
                }
            },
            onShare = {
                Toast.makeText(context, "Share link generated", Toast.LENGTH_SHORT).show()
            },
            onDelete = {
                scope.launch {
                    val file = activePreviewFile
                    if (file != null) {
                        val targetType = file.type
                        repository.trashFile(file.id)
                        activePreviewFile = null
                        refreshData(targetCategoryType = targetType)
                    }
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
                hasUpdateBadge = com.rupam.drivevault.update.AppUpdateManager.isUpdateAvailable,
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
                        categorySyncState = categorySyncState,
                        activeSyncCategory = activeSyncCategory,
                        isStorageSyncing = isStorageQuotaSyncing,
                        isRefreshing = isPullRefreshing,
                        onRefresh = { performPullRefresh() },
                        userPictureUrl = currentUser?.picture,
                        onProfileClick = { showProfileDialog = true },
                        onCategoryClick = { catType ->
                            selectCategoryFilter(catType)
                            scope.launch { pagerState.animateScrollToPage(1) }
                        },
                        onFileClick = { file ->
                            if (file.type == FileCategoryType.FOLDER) {
                                filterCategory = null
                                breadcrumbs = breadcrumbs + FolderBreadcrumb(id = file.id, name = file.name)
                                val cached = repository.getCachedFiles(file.id)
                                if (cached != null) currentFiles = cached else currentFiles = emptyList()
                                scope.launch {
                                    pagerState.animateScrollToPage(1)
                                    isFilesLoading = true
                                    repository.getFiles(file.id).onSuccess {
                                        currentFiles = it
                                        isFilesLoading = false
                                    }.onFailure {
                                        isFilesLoading = false
                                    }
                                }
                            } else {
                                activePreviewFile = file
                                previewStreamUrl = repository.getFastStreamUrl(file.id)
                                scope.launch {
                                    repository.getDownloadTicket().onSuccess { ticket ->
                                        previewStreamUrl = repository.getStreamUrl(file.id, ticket)
                                        previewFallbackUrl = repository.getRenderDownloadUrl(file.id, ticket) + "&inline=true"
                                    }
                                }
                            }
                        },
                        onFileMenuClick = { file ->
                            menuTargetFile = file
                        },
                        onUploadClick = {
                            isLaunchingExternalIntent = true
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
                        isRefreshing = isPullRefreshing,
                        onRefresh = { performPullRefresh() },
                        onCategoryFilterSelected = { cat ->
                            selectCategoryFilter(cat)
                        },
                        onTransfersClick = { showTransfersSheet = true },
                        isLoading = isFilesLoading,
                        onBatchMove = { targets ->
                            filesToMove = targets
                        },
                        onBatchTrash = { targets ->
                            batchTrashTargets = targets
                        },
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
                                    previewFallbackUrl = repository.getRenderDownloadUrl(file.id, ticket) + "&inline=true"
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
                            isLaunchingExternalIntent = true
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
                        authManager = authManager,
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
                            scope.launch {
                                withContext(Dispatchers.IO) {
                                    try {
                                        context.cacheDir?.listFiles()?.forEach { it.deleteRecursively() }
                                        context.externalCacheDir?.listFiles()?.forEach { it.deleteRecursively() }
                                    } catch (ignored: Exception) {}
                                    repository.clearCache()
                                }
                                Toast.makeText(context, "Cache cleared successfully", Toast.LENGTH_SHORT).show()
                                refreshData()
                            }
                        },
                        onServerCheckClick = {
                            showServerCheckScreen = true
                        },
                        onTrashClick = {
                            showTrashScreen = true
                        },
                        onNotificationsClick = {
                            showNotificationSettingsScreen = true
                        },
                        onAboutClick = {
                            showAboutScreen = true
                        },
                        onAppUpdateClick = {
                            showAppUpdaterScreen = true
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
            storageStats = storageStats,
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
                showTransfersSheet = true
                val tokensHeader = authManager.getTokensHeader()
                TransferManager.startUpload(
                    context = context,
                    uri = uriToUpload,
                    targetFolderId = currentFolderId,
                    authTokensHeader = tokensHeader,
                    onComplete = { success, err, uploadedDto ->
                        fileToDelete?.delete()
                        if (success) {
                            handleUploadSuccess(uploadedDto)
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
                            previewFallbackUrl = repository.getRenderDownloadUrl(target.id, ticket) + "&inline=true"
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
                shareTargetFile = target
            },
            onMove = { target ->
                filesToMove = listOf(target)
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
                                    currentFiles = currentFiles.map { if (it.id == target.id) it.copy(name = newName) else it }
                                    recentFiles = recentFiles.map { if (it.id == target.id) it.copy(name = newName) else it }
                                    repository.clearCache()
                                    refreshData(skipStats = true, forceNetwork = true)
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
                        val targetType = target.type
                        scope.launch {
                            repository.trashFile(target.id).onSuccess {
                                Toast.makeText(context, "Moved to trash", Toast.LENGTH_SHORT).show()
                                currentFiles = currentFiles.filter { it.id != target.id }
                                recentFiles = recentFiles.filter { it.id != target.id }
                                repository.clearCache()
                                refreshData(skipStats = false, forceNetwork = true, targetCategoryType = targetType)
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

    // ── Move Files Dialog ──
    if (filesToMove != null) {
        MoveFilesDialog(
            filesToMove = filesToMove!!,
            repository = repository,
            onDismiss = { filesToMove = null },
            onMoveConfirmed = { targetFolderId ->
                val toMove = filesToMove ?: return@MoveFilesDialog
                filesToMove = null
                scope.launch {
                    val fileIds = toMove.map { it.id }
                    val targetName = if (targetFolderId == null) "My Drive" else "destination"
                    Toast.makeText(context, "Moving ${toMove.size} item(s)...", Toast.LENGTH_SHORT).show()
                    val moveResult = repository.moveFiles(fileIds, targetFolderId ?: "root")
                    moveResult.onSuccess { movedCount ->
                        Toast.makeText(context, "Moved $movedCount item(s) to $targetName", Toast.LENGTH_SHORT).show()
                        refreshData(forceNetwork = true)
                    }.onFailure {
                        Toast.makeText(context, "Move failed: ${it.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        )
    }

    // ── Batch Trash Confirmation Dialog ──
    if (batchTrashTargets != null) {
        val targets = batchTrashTargets!!
        AlertDialog(
            onDismissRequest = { batchTrashTargets = null },
            shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
            title = {
                Text("Move ${targets.size} item(s) to Trash?", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
            },
            text = {
                Text("Selected items will be moved to Google Drive Trash. You can restore them from Trash anytime.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        val toTrash = batchTrashTargets ?: return@Button
                        batchTrashTargets = null
                        scope.launch {
                            Toast.makeText(context, "Trashing ${toTrash.size} item(s)...", Toast.LENGTH_SHORT).show()
                            val result = repository.trashFiles(toTrash.map { it.id })
                            result.onSuccess { count ->
                                Toast.makeText(context, "Moved $count item(s) to Trash", Toast.LENGTH_SHORT).show()
                                refreshData(forceNetwork = true)
                            }.onFailure {
                                Toast.makeText(context, "Trash failed: ${it.message}", Toast.LENGTH_LONG).show()
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Move to Trash")
                }
            },
            dismissButton = {
                TextButton(onClick = { batchTrashTargets = null }) {
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

    // ── Share & Access Dialog ──
    if (shareTargetFile != null) {
        ShareAccessDialog(
            file = shareTargetFile!!,
            repository = repository,
            onDismiss = { shareTargetFile = null },
            onShareToApps = { target ->
                triggerShare(target)
            }
        )
    }

    // ── Share to DriveVault Dialog (External File Share) ──
    if (!incomingShareUris.isNullOrEmpty() && isLoggedIn && !isAppLocked) {
        ShareToUploadDialog(
            sharedUris = incomingShareUris,
            repository = repository,
            onUploadConfirmed = { filesToUpload, targetFolderId ->
                showTransfersSheet = true
                val tokensHeader = authManager.getTokensHeader()
                filesToUpload.forEach { (uri, customName) ->
                    TransferManager.startUpload(
                        context = context,
                        uri = uri,
                        targetFolderId = targetFolderId,
                        authTokensHeader = tokensHeader,
                        customFileName = customName,
                        onComplete = { success, _, _ ->
                            if (success) {
                                repository.clearCache()
                                refreshData(skipStats = false, forceNetwork = true)
                            }
                        }
                    )
                }
                Toast.makeText(
                    context,
                    "Starting upload for ${filesToUpload.size} ${if (filesToUpload.size == 1) "file" else "files"}",
                    Toast.LENGTH_SHORT
                ).show()
                onClearShareUris()
            },
            onDismiss = {
                onClearShareUris()
            }
        )
    }
}
