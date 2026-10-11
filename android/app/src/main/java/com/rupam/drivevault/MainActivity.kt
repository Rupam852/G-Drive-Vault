package com.rupam.drivevault

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.rupam.drivevault.auth.AuthManager
import com.rupam.drivevault.repository.DriveRepository
import com.rupam.drivevault.ui.screens.MainAppScreen
import com.rupam.drivevault.ui.theme.DriveVaultTheme

class MainActivity : ComponentActivity() {

    private lateinit var authManager: AuthManager
    private lateinit var driveRepository: DriveRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(android.view.Window.FEATURE_NO_TITLE)
        actionBar?.hide()
        enableEdgeToEdge()

        authManager = AuthManager(this)
        driveRepository = DriveRepository(authManager)

        setContent {
            DriveVaultTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    MainAppScreen(
                        authManager = authManager,
                        repository = driveRepository
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}
