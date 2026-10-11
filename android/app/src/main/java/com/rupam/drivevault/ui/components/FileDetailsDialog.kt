package com.rupam.drivevault.ui.components

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rupam.drivevault.model.DriveFile

@Composable
fun FileDetailsDialog(
    file: DriveFile,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "File Details",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                DetailRow(label = "Name", value = file.name)
                DetailRow(label = "Type", value = file.type.name)
                DetailRow(label = "Size", value = if (file.sizeBytes > 0) "${file.size} (${file.sizeBytes} bytes)" else file.size)
                DetailRow(label = "Modified", value = file.date.ifEmpty { "Unknown" })
                if (!file.mimeType.isNullOrBlank()) {
                    DetailRow(label = "MIME Type", value = file.mimeType)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("File ID", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(file.id.take(16) + "...", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                    }
                    IconButton(
                        onClick = {
                            val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            cm.setPrimaryClip(ClipData.newPlainText("File ID", file.id))
                            Toast.makeText(context, "File ID copied to clipboard", Toast.LENGTH_SHORT).show()
                        }
                    ) {
                        Icon(Icons.Rounded.ContentCopy, contentDescription = "Copy ID", modifier = Modifier.size(18.dp))
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        },
        shape = RoundedCornerShape(24.dp)
    )
}

@Composable
private fun DetailRow(label: String, value: String) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
