package com.rupam.drivevault.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.rupam.drivevault.auth.AuthManager
import com.rupam.drivevault.ui.theme.BluePrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationSettingsScreen(
    authManager: AuthManager,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    BackHandler {
        onBack()
    }

    val context = LocalContext.current

    var masterEnabled by remember { mutableStateOf(authManager.isMasterNotificationEnabled()) }
    var uploadEnabled by remember { mutableStateOf(authManager.isUploadNotificationEnabled()) }
    var downloadEnabled by remember { mutableStateOf(authManager.isDownloadNotificationEnabled()) }

    var hasSystemPermission by remember {
        mutableStateOf(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else true
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasSystemPermission = granted
        if (granted) {
            Toast.makeText(context, "Notification permission granted", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "Notification permission denied", Toast.LENGTH_LONG).show()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Notification Settings",
                        fontWeight = FontWeight.Bold,
                        fontSize = 19.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
        modifier = modifier
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // ── System Permission Warning Banner (Android 13+) ──
            if (!hasSystemPermission && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                item {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.25f),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.NotificationsOff,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(24.dp)
                                )
                                Text(
                                    text = "System Permission Required",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = MaterialTheme.colorScheme.error
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Android 13+ requires your explicit permission to show upload and download progress in the status bar.",
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = {
                                    permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = BluePrimary)
                            ) {
                                Text("Grant Notification Permission", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // ── Master Notification Switch ──
            item {
                Text(
                    text = "Master Control",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    SettingsSwitchRow(
                        icon = Icons.Rounded.NotificationsActive,
                        title = "Allow Notifications",
                        subtitle = "Master switch for all upload, download, and transfer alerts",
                        checked = masterEnabled,
                        onCheckedChange = { isChecked ->
                            masterEnabled = isChecked
                            authManager.setMasterNotificationEnabled(isChecked)
                            Toast.makeText(
                                context,
                                if (isChecked) "Notifications enabled" else "All transfer notifications disabled",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    )
                }
            }

            // ── Transfer Sub-Notifications ──
            item {
                Text(
                    text = "Transfer Alerts",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(8.dp))

                val subAlpha = if (masterEnabled) 1f else 0.45f

                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .alpha(subAlpha)
                ) {
                    Column {
                        SettingsSwitchRow(
                            icon = Icons.Rounded.CloudUpload,
                            title = "Upload Notifications",
                            subtitle = "Show progress bar, live speed, and upload completion in status bar",
                            checked = uploadEnabled && masterEnabled,
                            onCheckedChange = { isChecked ->
                                if (masterEnabled) {
                                    uploadEnabled = isChecked
                                    authManager.setUploadNotificationEnabled(isChecked)
                                } else {
                                    Toast.makeText(context, "Enable master notifications first", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                        SettingsSwitchRow(
                            icon = Icons.Rounded.CloudDownload,
                            title = "Download Notifications",
                            subtitle = "Show progress bar, live speed, and download completion in status bar",
                            checked = downloadEnabled && masterEnabled,
                            onCheckedChange = { isChecked ->
                                if (masterEnabled) {
                                    downloadEnabled = isChecked
                                    authManager.setDownloadNotificationEnabled(isChecked)
                                } else {
                                    Toast.makeText(context, "Enable master notifications first", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                    }
                }
            }

            // ── Info Note ──
            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Info,
                            contentDescription = null,
                            tint = BluePrimary,
                            modifier = Modifier.size(20.dp)
                        )
                        Text(
                            text = "Status bar notifications keep background uploads and downloads running reliably at full speed even when your phone is locked.",
                            fontSize = 12.sp,
                            lineHeight = 17.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
