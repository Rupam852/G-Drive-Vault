package com.rupam.drivevault.auth

import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

object BiometricHelper {

    fun isBiometricAvailable(context: Context): Pair<Boolean, String> {
        val biometricManager = BiometricManager.from(context)
        val authenticators = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        } else {
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        }

        return when (biometricManager.canAuthenticate(authenticators)) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                true to "Biometric authentication is available"
            }
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                false to "No biometric features available on this device"
            }
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                false to "Biometric sensors are currently unavailable"
            }
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                false to "No biometric or screen lock enrolled. Please set a fingerprint, face, or PIN in device Settings."
            }
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> {
                false to "Security update required for biometric authentication"
            }
            else -> {
                false to "Biometric authentication is not supported"
            }
        }
    }

    fun authenticate(
        activity: FragmentActivity,
        title: String = "Unlock DriveVault",
        subtitle: String = "Touch fingerprint sensor or verify identity to continue",
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
        onCancel: () -> Unit = {}
    ) {
        val executor = ContextCompat.getMainExecutor(activity)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                if (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                    errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                    errorCode == BiometricPrompt.ERROR_CANCELED
                ) {
                    onCancel()
                } else {
                    onError(errString.toString())
                }
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                // Single attempt failed; biometric dialog continues listening
            }
        }

        val biometricPrompt = BiometricPrompt(activity, executor, callback)

        val promptInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                .build()
        } else {
            BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .setNegativeButtonText("Cancel")
                .build()
        }

        try {
            biometricPrompt.authenticate(promptInfo)
        } catch (e: Exception) {
            onError(e.message ?: "Failed to start biometric authentication")
        }
    }
}
