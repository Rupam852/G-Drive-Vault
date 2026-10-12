package com.rupam.drivevault.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.rupam.drivevault.ui.theme.BluePrimary

// Official Google One 4-color gradient palette
val GoogleOneColors = listOf(
    Color(0xFF4285F4), // Google Blue
    Color(0xFFEA4335), // Google Red
    Color(0xFFFBBC05), // Google Yellow
    Color(0xFF34A853), // Google Green
    Color(0xFF4285F4)  // Google Blue loop
)

@Composable
fun GoogleOneAvatar(
    pictureUrl: String?,
    name: String?,
    size: Dp = 46.dp,
    isGoogleOne: Boolean = false,
    onClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val ringWidth = if (size > 60.dp) 3.dp else 2.5.dp
    val gapWidth = if (size > 60.dp) 2.5.dp else 2.dp

    val baseModifier = modifier
        .size(size)
        .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)

    if (isGoogleOne) {
        // ── Google One Signature 4-Color Sweep Gradient Ring ──
        Box(
            modifier = baseModifier
                .clip(CircleShape)
                .background(Brush.sweepGradient(GoogleOneColors))
                .padding(ringWidth), // Colorful border ring
            contentAlignment = Alignment.Center
        ) {
            // Gap spacer matching surface background
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(gapWidth),
                contentAlignment = Alignment.Center
            ) {
                AvatarContent(pictureUrl = pictureUrl, name = name)
            }
        }
    } else {
        // ── Standard Clean Border for Free Accounts ──
        Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surfaceVariant,
            modifier = baseModifier
                .clip(CircleShape)
                .border(
                    width = 2.dp,
                    color = BluePrimary.copy(alpha = 0.5f),
                    shape = CircleShape
                )
        ) {
            AvatarContent(pictureUrl = pictureUrl, name = name)
        }
    }
}

@Composable
private fun AvatarContent(pictureUrl: String?, name: String?) {
    if (!pictureUrl.isNullOrBlank()) {
        AsyncImage(
            model = pictureUrl,
            contentDescription = name ?: "Profile",
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxSize()
                .clip(CircleShape)
        )
    } else {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(CircleShape)
                .background(BluePrimary),
            contentAlignment = Alignment.Center
        ) {
            if (!name.isNullOrBlank()) {
                Text(
                    text = name.take(1).uppercase(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            } else {
                Icon(
                    imageVector = Icons.Rounded.Person,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(24.dp)
                )
            }
        }
    }
}
