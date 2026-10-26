package com.rupam.drivevault.cast

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import androidx.fragment.app.FragmentActivity
import androidx.mediarouter.app.MediaRouteChooserDialogFragment
import androidx.mediarouter.app.MediaRouteControllerDialogFragment
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaMetadata
import com.google.android.gms.cast.MediaSeekOptions
import com.google.android.gms.cast.MediaStatus
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.SessionManagerListener
import com.google.android.gms.cast.framework.media.RemoteMediaClient
import com.google.android.gms.common.images.WebImage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * CastManager provides end-to-end Chromecast & Smart TV casting capabilities:
 * - Real-time local Wi-Fi monitoring (enabled on Wi-Fi, disabled on mobile data/disconnected).
 * - Safe CastContext & SessionManager management.
 * - Casting of Videos, Audio, and Photos to big-screen TVs with high-resolution metadata.
 * - Live bidirectional remote controls (Play, Pause, 10s Rewind/Forward, Seekbar slider).
 * - Native Google Cast device chooser dialog.
 */
object CastManager {

    private val _isWifiConnected = MutableStateFlow(false)
    val isWifiConnected: StateFlow<Boolean> = _isWifiConnected.asStateFlow()

    private val _isCasting = MutableStateFlow(false)
    val isCasting: StateFlow<Boolean> = _isCasting.asStateFlow()

    private val _connectedDeviceName = MutableStateFlow<String?>(null)
    val connectedDeviceName: StateFlow<String?> = _connectedDeviceName.asStateFlow()

    private val _isCastPlaying = MutableStateFlow(false)
    val isCastPlaying: StateFlow<Boolean> = _isCastPlaying.asStateFlow()

    private val _castPositionMs = MutableStateFlow(0L)
    val castPositionMs: StateFlow<Long> = _castPositionMs.asStateFlow()

    private val _castDurationMs = MutableStateFlow(0L)
    val castDurationMs: StateFlow<Long> = _castDurationMs.asStateFlow()

    private var currentSession: CastSession? = null
    private var isInitialized = false

    private val remoteMediaClientCallback = object : RemoteMediaClient.Callback() {
        override fun onStatusUpdated() {
            val rmc = currentSession?.remoteMediaClient ?: return
            val mediaStatus = rmc.mediaStatus
            val playerState = mediaStatus?.playerState ?: rmc.playerState
            val idleReason = mediaStatus?.idleReason ?: rmc.idleReason

            if (playerState == MediaStatus.PLAYER_STATE_IDLE &&
                (idleReason == MediaStatus.IDLE_REASON_CANCELED || idleReason == MediaStatus.IDLE_REASON_FINISHED)
            ) {
                // TV remote pressed Back / Stop or video finished playing on TV
                _isCastPlaying.value = false
            } else {
                _isCastPlaying.value = rmc.isPlaying
                val pos = rmc.approximateStreamPosition
                if (pos > 0L) {
                    _castPositionMs.value = pos
                }
                val dur = rmc.streamDuration
                if (dur > 0L) {
                    _castDurationMs.value = dur
                }
            }
        }

        override fun onMetadataUpdated() {
            val rmc = currentSession?.remoteMediaClient ?: return
            _castDurationMs.value = rmc.streamDuration
        }
    }

    private val sessionManagerListener = object : SessionManagerListener<CastSession> {
        override fun onSessionStarting(session: CastSession) {}

        override fun onSessionStarted(session: CastSession, sessionId: String) {
            currentSession = session
            _isCasting.value = true
            _connectedDeviceName.value = session.castDevice?.friendlyName ?: "TV Screen"
            session.remoteMediaClient?.registerCallback(remoteMediaClientCallback)
        }

        override fun onSessionStartFailed(session: CastSession, error: Int) {
            currentSession = null
            _isCasting.value = false
            _connectedDeviceName.value = null
        }

        override fun onSessionEnding(session: CastSession) {
            session.remoteMediaClient?.unregisterCallback(remoteMediaClientCallback)
        }

        override fun onSessionEnded(session: CastSession, error: Int) {
            currentSession = null
            _isCasting.value = false
            _connectedDeviceName.value = null
            _isCastPlaying.value = false
            _castPositionMs.value = 0L
            _castDurationMs.value = 0L
        }

        override fun onSessionResuming(session: CastSession, sessionId: String) {}

        override fun onSessionResumed(session: CastSession, wasSuspended: Boolean) {
            currentSession = session
            _isCasting.value = true
            _connectedDeviceName.value = session.castDevice?.friendlyName ?: "TV Screen"
            session.remoteMediaClient?.registerCallback(remoteMediaClientCallback)
        }

        override fun onSessionResumeFailed(session: CastSession, error: Int) {
            currentSession = null
            _isCasting.value = false
            _connectedDeviceName.value = null
        }

        override fun onSessionSuspended(session: CastSession, reason: Int) {
            // TV remote turned off TV, changed input or killed connection
            _isCasting.value = false
            _isCastPlaying.value = false
        }
    }

    fun init(context: Context) {
        if (isInitialized) return
        isInitialized = true

        startWifiMonitoring(context)

        try {
            val castContext = CastContext.getSharedInstance(context.applicationContext)
            castContext.sessionManager.addSessionManagerListener(sessionManagerListener, CastSession::class.java)
            val current = castContext.sessionManager.currentCastSession
            if (current != null && current.isConnected) {
                currentSession = current
                _isCasting.value = true
                _connectedDeviceName.value = current.castDevice?.friendlyName ?: "TV Screen"
                current.remoteMediaClient?.registerCallback(remoteMediaClientCallback)
            }
        } catch (e: Exception) {
            // Google Play Services might be disabled/missing; app remains stable without crash
            e.printStackTrace()
        }
    }

    private fun startWifiMonitoring(context: Context) {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return

        // Immediate check
        val activeNetwork = cm.activeNetwork
        val caps = cm.getNetworkCapabilities(activeNetwork)
        _isWifiConnected.value = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true

        // Real-time network callback
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .build()

        try {
            cm.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    _isWifiConnected.value = true
                }

                override fun onLost(network: Network) {
                    val currentCaps = cm.getNetworkCapabilities(cm.activeNetwork)
                    _isWifiConnected.value = currentCaps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
                }
            })
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Opens the native Google Cast device chooser dialog (shows nearby TVs on same Wi-Fi).
     * If already casting, opens the controller dialog to control volume or disconnect.
     */
    fun showCastDialog(activity: FragmentActivity) {
        try {
            val castContext = CastContext.getSharedInstance(activity)
            if (_isCasting.value) {
                val dialog = MediaRouteControllerDialogFragment()
                dialog.show(activity.supportFragmentManager, "CastControllerDialog")
            } else {
                val dialog = MediaRouteChooserDialogFragment()
                dialog.routeSelector = castContext.mergedSelector ?: androidx.mediarouter.media.MediaRouteSelector.EMPTY
                dialog.show(activity.supportFragmentManager, "CastChooserDialog")
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Casts a video, audio, or photo URL directly to the connected TV.
     */
    fun castMedia(
        url: String,
        title: String,
        mimeType: String,
        positionMs: Long = 0L,
        thumbnailUrl: String? = null
    ) {
        val session = currentSession ?: return
        val rmc = session.remoteMediaClient ?: return

        val mediaType = when {
            mimeType.startsWith("video/") -> MediaMetadata.MEDIA_TYPE_MOVIE
            mimeType.startsWith("audio/") -> MediaMetadata.MEDIA_TYPE_MUSIC_TRACK
            mimeType.startsWith("image/") -> MediaMetadata.MEDIA_TYPE_PHOTO
            else -> MediaMetadata.MEDIA_TYPE_GENERIC
        }

        val metadata = MediaMetadata(mediaType)
        metadata.putString(MediaMetadata.KEY_TITLE, title)
        if (!thumbnailUrl.isNullOrBlank()) {
            metadata.addImage(WebImage(Uri.parse(thumbnailUrl)))
        }

        val isPhoto = mimeType.startsWith("image/")
        val mediaInfo = MediaInfo.Builder(url)
            .setStreamType(if (isPhoto) MediaInfo.STREAM_TYPE_NONE else MediaInfo.STREAM_TYPE_BUFFERED)
            .setContentType(mimeType)
            .setMetadata(metadata)
            .build()

        val request = MediaLoadRequestData.Builder()
            .setMediaInfo(mediaInfo)
            .setCurrentTime(if (isPhoto) 0L else positionMs)
            .setAutoplay(true)
            .build()

        rmc.load(request)
    }

    fun play() {
        currentSession?.remoteMediaClient?.play()
    }

    fun pause() {
        currentSession?.remoteMediaClient?.pause()
    }

    fun togglePlayPause() {
        val rmc = currentSession?.remoteMediaClient ?: return
        if (rmc.isPlaying) {
            rmc.pause()
        } else {
            rmc.play()
        }
    }

    fun seekTo(positionMs: Long) {
        val rmc = currentSession?.remoteMediaClient ?: return
        val options = MediaSeekOptions.Builder()
            .setPosition(positionMs)
            .build()
        rmc.seek(options)
    }

    fun skip(deltaMs: Long) {
        val rmc = currentSession?.remoteMediaClient ?: return
        val newPos = (rmc.approximateStreamPosition + deltaMs).coerceIn(0L, rmc.streamDuration)
        seekTo(newPos)
    }

    fun stopCast(context: Context) {
        try {
            CastContext.getSharedInstance(context).sessionManager.endCurrentSession(true)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
