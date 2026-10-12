package com.rupam.drivevault

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import com.rupam.drivevault.auth.AuthManager
import com.rupam.drivevault.repository.DriveRepository
import com.rupam.drivevault.ui.screens.MainAppScreen
import com.rupam.drivevault.ui.theme.DriveVaultTheme
import com.rupam.drivevault.ui.theme.ThemeManager

class MainActivity : FragmentActivity() {

    private lateinit var authManager: AuthManager
    private lateinit var driveRepository: DriveRepository
    private val incomingShareUris = mutableStateOf<List<Uri>?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(android.view.Window.FEATURE_NO_TITLE)
        actionBar?.hide()
        enableEdgeToEdge()

        ThemeManager.init(this)
        authManager = AuthManager(this)
        driveRepository = DriveRepository(authManager)

        handleShareIntent(intent)

        setContent {
            DriveVaultTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    MainAppScreen(
                        authManager = authManager,
                        repository = driveRepository,
                        incomingShareUris = incomingShareUris.value,
                        onClearShareUris = { incomingShareUris.value = null }
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleShareIntent(intent)
    }

    private fun handleShareIntent(intent: Intent?) {
        if (intent == null) return
        val action = intent.action
        val type = intent.type

        if (Intent.ACTION_SEND == action && type != null) {
            var uri: Uri? = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(Intent.EXTRA_STREAM)
            }
            if (uri == null && intent.clipData != null && intent.clipData!!.itemCount > 0) {
                uri = intent.clipData!!.getItemAt(0).uri
            }
            if (uri == null) {
                uri = intent.data
            }
            if (uri != null) {
                incomingShareUris.value = listOf(uri)
            }
        } else if (Intent.ACTION_SEND_MULTIPLE == action && type != null) {
            var uris = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
            }
            if (uris.isNullOrEmpty() && intent.clipData != null) {
                val clipList = mutableListOf<Uri>()
                for (i in 0 until intent.clipData!!.itemCount) {
                    intent.clipData!!.getItemAt(i).uri?.let { clipList.add(it) }
                }
                if (clipList.isNotEmpty()) uris = ArrayList(clipList)
            }
            if (!uris.isNullOrEmpty()) {
                incomingShareUris.value = uris.filterNotNull()
            }
        }
    }
}
