package com.rupam.drivevault.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rupam.drivevault.network.NetworkClient
import com.rupam.drivevault.ui.theme.BluePrimary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.util.concurrent.TimeUnit

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.text.style.TextOverflow

enum class ServerHealthStatus {
    NOT_TESTED,
    TESTING,
    ACTIVE,
    NOT_ACTIVE
}

data class ServerHealthResult(
    val status: ServerHealthStatus = ServerHealthStatus.NOT_TESTED,
    val latencyMs: Long = 0L,
    val message: String = ""
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServerCheckScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    BackHandler { onBack() }

    val scope = rememberCoroutineScope()

    var cloudflareResult by remember { mutableStateOf(ServerHealthResult()) }
    var renderResult by remember { mutableStateOf(ServerHealthResult()) }
    var isChecking by remember { mutableStateOf(false) }
    var cooldownRemaining by remember { mutableIntStateOf(0) }

    // Ping check runner
    fun runServerHealthTest() {
        if (isChecking || cooldownRemaining > 0) return

        isChecking = true
        cloudflareResult = ServerHealthResult(status = ServerHealthStatus.TESTING)
        renderResult = ServerHealthResult(status = ServerHealthStatus.TESTING)

        scope.launch {
            // Test Cloudflare Worker
            val cfJob = launch {
                val start = System.currentTimeMillis()
                try {
                    val client = NetworkClient.okHttpClient.newBuilder()
                        .connectTimeout(8, TimeUnit.SECONDS)
                        .readTimeout(8, TimeUnit.SECONDS)
                        .build()
                    val req = Request.Builder()
                        .url("https://drivevault-edge-streamer.rupambairagya07.workers.dev/")
                        .get()
                        .build()
                    val res = withContext(Dispatchers.IO) { client.newCall(req).execute() }
                    val latency = System.currentTimeMillis() - start
                    cloudflareResult = if (res.isSuccessful || res.code in 200..399) {
                        ServerHealthResult(
                            status = ServerHealthStatus.ACTIVE,
                            latencyMs = latency,
                            message = "${latency}ms latency"
                        )
                    } else {
                        ServerHealthResult(
                            status = ServerHealthStatus.NOT_ACTIVE,
                            message = "HTTP ${res.code}"
                        )
                    }
                } catch (e: Exception) {
                    cloudflareResult = ServerHealthResult(
                        status = ServerHealthStatus.NOT_ACTIVE,
                        message = e.localizedMessage ?: "Unreachable"
                    )
                }
            }

            // Test Render Backend
            val renderJob = launch {
                val start = System.currentTimeMillis()
                try {
                    val client = NetworkClient.okHttpClient.newBuilder()
                        .connectTimeout(15, TimeUnit.SECONDS)
                        .readTimeout(15, TimeUnit.SECONDS)
                        .build()
                    val req = Request.Builder()
                        .url("https://g-drive-vault.onrender.com/")
                        .get()
                        .build()
                    val res = withContext(Dispatchers.IO) { client.newCall(req).execute() }
                    val latency = System.currentTimeMillis() - start
                    renderResult = if (res.isSuccessful || res.code in 200..399) {
                        ServerHealthResult(
                            status = ServerHealthStatus.ACTIVE,
                            latencyMs = latency,
                            message = "${latency}ms latency"
                        )
                    } else {
                        ServerHealthResult(
                            status = ServerHealthStatus.NOT_ACTIVE,
                            message = "HTTP ${res.code}"
                        )
                    }
                } catch (e: Exception) {
                    renderResult = ServerHealthResult(
                        status = ServerHealthStatus.NOT_ACTIVE,
                        message = e.localizedMessage ?: "Unreachable"
                    )
                }
            }

            cfJob.join()
            renderJob.join()
            isChecking = false

            // Start 60-second cooldown timer
            cooldownRemaining = 60
            while (cooldownRemaining > 0) {
                delay(1000)
                cooldownRemaining--
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Server Diagnostics",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Cloudflare Edge & Render Cloud Health",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                            contentDescription = "Back",
                            tint = MaterialTheme.colorScheme.onSurface
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // ── Cloudflare Edge Worker Card ──
            ServerStatusCard(
                title = "Cloudflare Edge Streamer",
                subtitle = "drivevault-edge-streamer.rupambairagya07.workers.dev",
                description = "Zero-RAM streaming proxy & Edge bandwidth accelerator",
                icon = Icons.Rounded.Bolt,
                iconTint = Color(0xFFF59E0B),
                result = cloudflareResult
            )

            // ── Render Backend Server Card ──
            ServerStatusCard(
                title = "Render Cloud Backend",
                subtitle = "g-drive-vault.onrender.com",
                description = "OAuth token exchange, database & Google Drive API engine",
                icon = Icons.Rounded.CloudSync,
                iconTint = BluePrimary,
                result = renderResult
            )

            Spacer(modifier = Modifier.height(8.dp))

            // ── Test Server Health Button (1 Min Cooldown) ──
            Button(
                onClick = { runServerHealthTest() },
                enabled = !isChecking && cooldownRemaining == 0,
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = BluePrimary,
                    disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
            ) {
                if (isChecking) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.5.dp,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Testing Server Health...",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                } else if (cooldownRemaining > 0) {
                    Icon(
                        imageVector = Icons.Rounded.Timer,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Test Again in ${cooldownRemaining}s",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                } else {
                    Icon(
                        imageVector = Icons.Rounded.Speed,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "Test Server Health",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // ── Explanation Note ──
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Info,
                        contentDescription = null,
                        tint = BluePrimary,
                        modifier = Modifier.size(22.dp)
                    )
                    Column {
                        Text(
                            text = "Cooldown & Cold-Start Policy",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Aap har 1 minute baad test kar sakte hain. Agar Render server 15 minute baad so gaya ho to wake-up hone me pehli baar thoda samay le sakta hai.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            lineHeight = 18.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ServerStatusCard(
    title: String,
    subtitle: String,
    description: String,
    icon: ImageVector,
    iconTint: Color,
    result: ServerHealthResult
) {
    Surface(
        shape = RoundedCornerShape(22.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    modifier = Modifier.weight(1f, fill = false),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Surface(
                        shape = CircleShape,
                        color = iconTint.copy(alpha = 0.15f),
                        modifier = Modifier.size(42.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = icon,
                                contentDescription = title,
                                tint = iconTint,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                    }

                    Column(
                        modifier = Modifier.weight(1f, fill = false)
                    ) {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = subtitle,
                            style = MaterialTheme.typography.bodySmall,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                Spacer(modifier = Modifier.width(10.dp))

                // ── Status Badge on Right ──
                StatusBadge(result = result)
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))

            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (result.message.isNotBlank() && result.status != ServerHealthStatus.TESTING) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (result.status == ServerHealthStatus.ACTIVE) Color(0xFF10B981).copy(alpha = 0.12f) else MaterialTheme.colorScheme.error.copy(alpha = 0.12f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Status Detail: ${result.message}",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (result.status == ServerHealthStatus.ACTIVE) Color(0xFF10B981) else MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(result: ServerHealthResult) {
    when (result.status) {
        ServerHealthStatus.NOT_TESTED -> {
            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.padding(2.dp)
            ) {
                Text(
                    text = "Not Tested",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    softWrap = false,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                )
            }
        }

        ServerHealthStatus.TESTING -> {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.padding(horizontal = 4.dp)
            ) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    color = BluePrimary,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "Checking...",
                    fontSize = 11.sp,
                    color = BluePrimary,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    softWrap = false
                )
            }
        }

        ServerHealthStatus.ACTIVE -> {
            Surface(
                shape = RoundedCornerShape(50),
                color = Color(0xFF10B981).copy(alpha = 0.15f),
                border = BorderStroke(1.dp, Color(0xFF10B981).copy(alpha = 0.4f))
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .background(Color(0xFF10B981), CircleShape)
                    )
                    Text(
                        text = "Active",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF10B981),
                        maxLines = 1,
                        softWrap = false
                    )
                }
            }
        }

        ServerHealthStatus.NOT_ACTIVE -> {
            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.error.copy(alpha = 0.15f),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.4f))
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .background(MaterialTheme.colorScheme.error, CircleShape)
                    )
                    Text(
                        text = "Not Active",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error,
                        maxLines = 1,
                        softWrap = false
                    )
                }
            }
        }
    }
}

