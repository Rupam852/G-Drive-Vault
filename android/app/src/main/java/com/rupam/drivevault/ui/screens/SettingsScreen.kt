package com.rupam.drivevault.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import android.widget.Toast
import androidx.fragment.app.FragmentActivity
import coil.compose.AsyncImage
import com.rupam.drivevault.auth.AuthManager
import com.rupam.drivevault.auth.AuthUser
import com.rupam.drivevault.auth.BiometricHelper
import com.rupam.drivevault.model.StorageStats
import com.rupam.drivevault.ui.components.StorageGauge
import com.rupam.drivevault.ui.components.GoogleOneAvatar
import com.rupam.drivevault.ui.components.GoogleOneColors
import androidx.compose.ui.graphics.Brush
import com.rupam.drivevault.ui.theme.BluePrimary
import com.rupam.drivevault.ui.theme.ThemeManager
import com.rupam.drivevault.ui.theme.AppThemeMode
import com.rupam.drivevault.transfer.TransferManager

@Composable
fun SettingsScreen(
    user: AuthUser?,
    storageStats: StorageStats,
    onLogoutClick: () -> Unit,
    onSwitchAccountClick: () -> Unit = {},
    onStorageDetailsClick: () -> Unit = {},
    onClearCacheClick: () -> Unit,
    onServerCheckClick: () -> Unit = {},
    onTrashClick: () -> Unit = {},
    authManager: AuthManager? = null,
    onNotificationsClick: () -> Unit = {},
    onAboutClick: () -> Unit = {},
    onAppUpdateClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val activity = context as? FragmentActivity
    var biometricEnabled by remember { mutableStateOf(authManager?.isBiometricEnabled() ?: false) }
    var highQualityStreaming by remember { mutableStateOf(authManager?.isHighQualityStreaming() ?: true) }
    var autoCheckUpdateEnabled by remember { mutableStateOf(authManager?.isAutoCheckUpdateEnabled() ?: true) }
    var isBackgroundSpeedBoost by remember {
        mutableStateOf(
            (authManager?.isBackgroundSpeedBoostEnabled() == true) || TransferManager.isBatteryOptimizationIgnored(context)
        )
    }

    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) {
                val systemIgnored = TransferManager.isBatteryOptimizationIgnored(context)
                if (systemIgnored) {
                    authManager?.setBackgroundSpeedBoostEnabled(true)
                }
                isBackgroundSpeedBoost = (authManager?.isBackgroundSpeedBoostEnabled() == true) || systemIgnored
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // ── Title ──
        item {
            Text(
                text = "Settings",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onBackground
            )
        }

        // ── User Profile Card ──
        item {
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        val isGoogleOne = storageStats.totalBytes > 16L * 1024L * 1024L * 1024L

                        // ── Circular Avatar (Google One Styled) ──
                        GoogleOneAvatar(
                            pictureUrl = user?.picture,
                            name = user?.name,
                            size = 56.dp,
                            isGoogleOne = isGoogleOne
                        )

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = user?.name ?: "Drive User",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = user?.email ?: "user@gmail.com",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            if (isGoogleOne) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color(0xFF4285F4).copy(alpha = 0.12f),
                                    border = BorderStroke(1.dp, Color(0xFF4285F4).copy(alpha = 0.35f))
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(7.dp)
                                                .clip(CircleShape)
                                                .background(Brush.sweepGradient(GoogleOneColors))
                                        )
                                        Text(
                                            text = "Google One Member",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = FontWeight.SemiBold,
                                                fontSize = 11.sp
                                            ),
                                            color = Color(0xFF2563EB)
                                        )
                                    }
                                }
                            }
                        }

                        // Logout Icon
                        IconButton(onClick = onLogoutClick) {
                            Icon(
                                imageVector = Icons.Rounded.ExitToApp,
                                contentDescription = "Sign Out",
                                tint = MaterialTheme.colorScheme.error
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // ── Switch Account Button ──
                    FilledTonalButton(
                        onClick = onSwitchAccountClick,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = BluePrimary.copy(alpha = 0.15f),
                            contentColor = BluePrimary
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Sync,
                            contentDescription = "Switch Account",
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Switch Google Account",
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }

        // ── Storage Overview Card (Clickable to open breakdown) ──
        item {
            StorageGauge(
                storageStats = storageStats,
                onClick = onStorageDetailsClick
            )
        }

        // ── Theme & Appearance Group ──
        item {
            val context = LocalContext.current
            val currentMode = ThemeManager.currentThemeMode

            Text(
                text = "Theme & Appearance",
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
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = BluePrimary.copy(alpha = 0.12f),
                            modifier = Modifier.size(38.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Rounded.Palette,
                                    contentDescription = null,
                                    tint = BluePrimary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Theme Mode",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "Choose your preferred visual style",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        AppThemeMode.values().forEach { mode ->
                            val isSelected = currentMode == mode
                            val modeIcon = when (mode) {
                                AppThemeMode.LIGHT -> Icons.Rounded.LightMode
                                AppThemeMode.DARK -> Icons.Rounded.DarkMode
                                AppThemeMode.SYSTEM -> Icons.Rounded.BrightnessAuto
                            }

                            Surface(
                                onClick = {
                                    ThemeManager.setThemeMode(context, mode)
                                },
                                shape = RoundedCornerShape(14.dp),
                                color = if (isSelected) BluePrimary.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                                border = BorderStroke(
                                    1.dp,
                                    if (isSelected) BluePrimary else MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)
                                ),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 14.dp, vertical = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    Icon(
                                        imageVector = modeIcon,
                                        contentDescription = mode.title,
                                        tint = if (isSelected) BluePrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.size(22.dp)
                                    )
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = mode.title,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                            color = if (isSelected) BluePrimary else MaterialTheme.colorScheme.onSurface
                                        )
                                        Text(
                                            text = mode.subtitle,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            fontSize = 11.sp
                                        )
                                    }
                                    RadioButton(
                                        selected = isSelected,
                                        onClick = { ThemeManager.setThemeMode(context, mode) },
                                        colors = RadioButtonDefaults.colors(
                                            selectedColor = BluePrimary,
                                            unselectedColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Preferences Group ──
        item {
            Text(
                text = "Preferences",
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
                Column {
                    SettingsActionRow(
                        icon = Icons.Rounded.Notifications,
                        title = "Notifications",
                        subtitle = if (authManager?.isMasterNotificationEnabled() != false)
                            "Upload, download, and transfer status alerts active"
                        else
                            "Transfer alerts turned off",
                        onClick = onNotificationsClick
                    )
                    Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                    SettingsSwitchRow(
                        icon = Icons.Rounded.Fingerprint,
                        title = "Biometric Lock",
                        subtitle = "Require fingerprint/face to unlock DriveVault",
                        checked = biometricEnabled,
                        onCheckedChange = { targetState ->
                            if (targetState) {
                                val (isAvailable, reason) = BiometricHelper.isBiometricAvailable(context)
                                if (!isAvailable) {
                                    Toast.makeText(context, reason, Toast.LENGTH_LONG).show()
                                } else if (activity != null) {
                                    BiometricHelper.authenticate(
                                        activity = activity,
                                        title = "Enable Biometric Lock",
                                        subtitle = "Verify fingerprint or screen lock to enable protection",
                                        onSuccess = {
                                            biometricEnabled = true
                                            authManager?.setBiometricEnabled(true)
                                            Toast.makeText(context, "Biometric Lock enabled", Toast.LENGTH_SHORT).show()
                                        },
                                        onError = { err ->
                                            Toast.makeText(context, "Authentication failed: $err", Toast.LENGTH_LONG).show()
                                        }
                                    )
                                } else {
                                    biometricEnabled = true
                                    authManager?.setBiometricEnabled(true)
                                }
                            } else {
                                if (activity != null) {
                                    BiometricHelper.authenticate(
                                        activity = activity,
                                        title = "Disable Biometric Lock",
                                        subtitle = "Verify identity to disable biometric protection",
                                        onSuccess = {
                                            biometricEnabled = false
                                            authManager?.setBiometricEnabled(false)
                                            Toast.makeText(context, "Biometric Lock disabled", Toast.LENGTH_SHORT).show()
                                        },
                                        onError = { err ->
                                            Toast.makeText(context, "Authentication failed: $err", Toast.LENGTH_LONG).show()
                                        }
                                    )
                                } else {
                                    biometricEnabled = false
                                    authManager?.setBiometricEnabled(false)
                                }
                            }
                        }
                    )
                    Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                    SettingsSwitchRow(
                        icon = Icons.Rounded.HighQuality,
                        title = "Original Stream Resolution",
                        subtitle = if (highQualityStreaming)
                            "Streaming in full original bitstream & resolution without recompression"
                        else
                            "Data Saver: Limits background pre-buffering to save mobile data",
                        checked = highQualityStreaming,
                        onCheckedChange = {
                            highQualityStreaming = it
                            authManager?.setHighQualityStreaming(it)
                            Toast.makeText(
                                context,
                                if (it) "Original Resolution streaming active" else "Data Saver mode active",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    )
                    Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                    SettingsSwitchRow(
                        icon = Icons.Rounded.BatteryChargingFull,
                        title = "Background Transfer Speed",
                        subtitle = if (isBackgroundSpeedBoost)
                            "Unrestricted • Sleep mode won't slow down transfers"
                        else
                            "Optimized by Android • Tap to prevent throttling when screen is off",
                        checked = isBackgroundSpeedBoost,
                        onCheckedChange = { enable ->
                            isBackgroundSpeedBoost = enable
                            authManager?.setBackgroundSpeedBoostEnabled(enable)
                            if (enable) {
                                TransferManager.requestIgnoreBatteryOptimization(context)
                                Toast.makeText(context, "Background speed boost enabled", Toast.LENGTH_SHORT).show()
                            } else {
                                Toast.makeText(context, "Background speed boost disabled", Toast.LENGTH_SHORT).show()
                            }
                        }
                    )
                }
            }
        }

        // ── Storage & Maintenance Group ──
        item {
            Text(
                text = "Maintenance",
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
                Column {
                    SettingsActionRow(
                        icon = Icons.Rounded.CleaningServices,
                        title = "Clear Download Cache",
                        subtitle = "Free up temporary streaming & download files",
                        onClick = onClearCacheClick
                    )
                    Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                    SettingsActionRow(
                        icon = Icons.Rounded.Dns,
                        title = "Server Diagnostics & Health",
                        subtitle = "Test Cloudflare Edge & Render backend live status",
                        onClick = onServerCheckClick
                    )
                    Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                    SettingsActionRow(
                        icon = Icons.Rounded.DeleteOutline,
                        title = "Trash / Recycle Bin",
                        subtitle = "View, restore, or permanently delete files",
                        onClick = onTrashClick
                    )
                    Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                    SettingsActionRow(
                        icon = Icons.Rounded.Info,
                        title = "About DriveVault",
                        subtitle = "Developer info, website, support & donate",
                        onClick = onAboutClick
                    )
                }
            }
        }

        // ── APP UPDATES Group (Matches Screenshot 1) ──
        item {
            Text(
                text = "APP UPDATES",
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
                Column {
                    // Row 1: Software Update
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(onClick = onAppUpdateClick)
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(BluePrimary.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.AutoAwesome,
                                contentDescription = null,
                                tint = BluePrimary,
                                modifier = Modifier.size(22.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Software Update",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            val updateSubtitle = if (com.rupam.drivevault.update.AppUpdateManager.isUpdateAvailable) {
                                "Update available: ${com.rupam.drivevault.update.AppUpdateManager.updateInfo?.version ?: "New"}"
                            } else {
                                "Installed: ${com.rupam.drivevault.update.AppUpdateManager.getInstalledVersion(context)}"
                            }
                            Text(
                                text = updateSubtitle,
                                fontSize = 12.sp,
                                color = if (com.rupam.drivevault.update.AppUpdateManager.isUpdateAvailable) Color(0xFFEF4444) else MaterialTheme.colorScheme.onSurfaceVariant,
                                fontWeight = if (com.rupam.drivevault.update.AppUpdateManager.isUpdateAvailable) FontWeight.Bold else FontWeight.Normal
                            )
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (com.rupam.drivevault.update.AppUpdateManager.isUpdateAvailable) {
                                Box(
                                    modifier = Modifier
                                        .size(9.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFFEF4444))
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                            }
                            Icon(
                                imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

                    // Row 2: Auto-check on App Open
                    SettingsSwitchRow(
                        icon = Icons.Rounded.Sync,
                        title = "Auto-check on App Open",
                        subtitle = "Check for updates when app launches",
                        checked = autoCheckUpdateEnabled,
                        onCheckedChange = { enable ->
                            autoCheckUpdateEnabled = enable
                            authManager?.setAutoCheckUpdateEnabled(enable)
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Check for Updates Now Button
            OutlinedButton(
                onClick = {
                    com.rupam.drivevault.update.AppUpdateManager.checkForUpdates(context, isManual = true) { hasUpdate ->
                        if (hasUpdate) {
                            onAppUpdateClick()
                        }
                    }
                },
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
                enabled = !com.rupam.drivevault.update.AppUpdateManager.isChecking,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                if (com.rupam.drivevault.update.AppUpdateManager.isChecking) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = BluePrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Checking for Updates...", fontWeight = FontWeight.SemiBold)
                } else {
                    Icon(
                        imageVector = Icons.Rounded.Sync,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Check for Updates Now", fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // ── Sign Out Button ──
        item {
            Button(
                onClick = onLogoutClick,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.1f),
                    contentColor = MaterialTheme.colorScheme.error
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                Icon(Icons.Rounded.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Sign Out of DriveVault", fontWeight = FontWeight.Bold)
            }
        }

        // ── App Version ──
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onAboutClick)
                    .padding(vertical = 4.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "DriveVault Native Android • ${com.rupam.drivevault.update.AppUpdateManager.getInstalledVersion(context)} (Build 41)",
                    style = MaterialTheme.typography.bodySmall,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                )
            }
            Spacer(modifier = Modifier.height(40.dp))
        }
    }
}

@Composable
fun SettingsSwitchRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier.weight(1f)
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = BluePrimary, modifier = Modifier.size(24.dp))
            Column {
                Text(text = title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun SettingsActionRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        color = Color.Transparent,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.weight(1f)
            ) {
                Icon(imageVector = icon, contentDescription = null, tint = BluePrimary, modifier = Modifier.size(24.dp))
                Column {
                    Text(text = title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Icon(Icons.Rounded.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
