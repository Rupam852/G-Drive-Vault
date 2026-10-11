package com.rupam.drivevault.ui.theme

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

enum class AppThemeMode(val title: String, val subtitle: String) {
    SYSTEM("System Default", "Follows device appearance automatically"),
    LIGHT("Light Mode", "Bright, crisp & elegant slate aesthetics"),
    DARK("Dark Mode", "Deep midnight OLED battery saver")
}

object ThemeManager {
    private const val PREFS_NAME = "drive_vault_theme_prefs"
    private const val KEY_THEME_MODE = "app_theme_mode"

    var currentThemeMode by mutableStateOf(AppThemeMode.SYSTEM)
        private set

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedName = prefs.getString(KEY_THEME_MODE, AppThemeMode.SYSTEM.name)
        currentThemeMode = try {
            AppThemeMode.valueOf(savedName ?: AppThemeMode.SYSTEM.name)
        } catch (e: Exception) {
            AppThemeMode.SYSTEM
        }
    }

    fun setThemeMode(context: Context, mode: AppThemeMode) {
        currentThemeMode = mode
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_THEME_MODE, mode.name).apply()
    }
}
