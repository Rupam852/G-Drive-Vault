package com.rupam.drivevault;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.rupam.drivevault.auth.AuthManager;

public class FileTransferService extends Service {
    public static final String ACTION_START = "com.rupam.drivevault.action.START_TRANSFER";
    public static final String ACTION_UPDATE = "com.rupam.drivevault.action.UPDATE_TRANSFER";
    public static final String ACTION_STOP = "com.rupam.drivevault.action.STOP_TRANSFER";

    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_PROGRESS = "extra_progress";
    public static final String EXTRA_SPEED = "extra_speed";
    public static final String EXTRA_IS_UPLOAD = "extra_is_upload";

    private static final String CHANNEL_ID = "drive_vault_transfers";
    private static final int NOTIFICATION_ID = 9999;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private NotificationManager notificationManager;

    public static void start(Context context) {
        try {
            Intent intent = new Intent(context, FileTransferService.class);
            intent.setAction(ACTION_START);
            ContextCompat.startForegroundService(context, intent);
        } catch (Exception ignored) {}
    }

    public static void updateProgress(Context context, String title, int progress, String speedText, boolean isUpload) {
        try {
            Intent intent = new Intent(context, FileTransferService.class);
            intent.setAction(ACTION_UPDATE);
            intent.putExtra(EXTRA_TITLE, title);
            intent.putExtra(EXTRA_PROGRESS, progress);
            intent.putExtra(EXTRA_SPEED, speedText);
            intent.putExtra(EXTRA_IS_UPLOAD, isUpload);
            ContextCompat.startForegroundService(context, intent);
        } catch (Exception ignored) {}
    }

    public static void showCompletion(Context context, String title, String message, boolean isUpload) {
        try {
            AuthManager authManager = new AuthManager(context);
            if (!authManager.isMasterNotificationEnabled()) return;
            if (isUpload && !authManager.isUploadNotificationEnabled()) return;
            if (!isUpload && !authManager.isDownloadNotificationEnabled()) return;

            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            Intent notificationIntent = new Intent(context, MainActivity.class);
            notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    (int) System.currentTimeMillis(),
                    notificationIntent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

            Bitmap largeIcon = null;
            try {
                largeIcon = BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher);
            } catch (Exception ignored) {}

            int iconRes = isUpload ? R.drawable.ic_upload_notification : R.drawable.ic_download_notification;

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setSmallIcon(iconRes)
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH);

            if (largeIcon != null) {
                builder.setLargeIcon(largeIcon);
            }

            nm.notify((int) (System.currentTimeMillis() % 100000), builder.build());
        } catch (Exception ignored) {}
    }

    public static void stop(Context context) {
        try {
            Intent intent = new Intent(context, FileTransferService.class);
            intent.setAction(ACTION_STOP);
            context.startService(intent);
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        acquireLocks();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            releaseLocks();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String title = "Transferring files...";
        int progress = 0;
        String speedText = "";
        boolean isUpload = true;

        if (intent != null) {
            if (intent.hasExtra(EXTRA_TITLE)) {
                title = intent.getStringExtra(EXTRA_TITLE);
            }
            if (intent.hasExtra(EXTRA_PROGRESS)) {
                progress = intent.getIntExtra(EXTRA_PROGRESS, 0);
            }
            if (intent.hasExtra(EXTRA_SPEED)) {
                speedText = intent.getStringExtra(EXTRA_SPEED);
            }
            if (intent.hasExtra(EXTRA_IS_UPLOAD)) {
                isUpload = intent.getBooleanExtra(EXTRA_IS_UPLOAD, true);
            }
        }

        Notification notification = buildNotification(title, progress, speedText, isUpload);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception ignored) {}
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        releaseLocks();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildNotification(String title, int progress, String speedText, boolean isUpload) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        String contentText = (speedText != null && !speedText.isEmpty()) ? speedText : "Running in background...";

        int smallIcon = isUpload ? R.drawable.ic_upload_notification : R.drawable.ic_download_notification;

        Bitmap largeIcon = null;
        try {
            largeIcon = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
        } catch (Exception ignored) {}

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(contentText)
                .setSmallIcon(smallIcon)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW);

        if (largeIcon != null) {
            builder.setLargeIcon(largeIcon);
        }

        if (progress >= 0 && progress <= 100) {
            builder.setProgress(100, progress, false);
        } else {
            builder.setProgress(0, 0, true);
        }

        return builder.build();
    }

    private void acquireLocks() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null && (wakeLock == null || !wakeLock.isHeld())) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DriveVault::TransferWakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(12 * 60 * 60 * 1000L);
            }
        } catch (Exception ignored) {}

        try {
            WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null && (wifiLock == null || !wifiLock.isHeld())) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_LOW_LATENCY, "DriveVault::TransferWifiLock");
                } else {
                    @SuppressWarnings("deprecation")
                    WifiManager.WifiLock legacyLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "DriveVault::TransferWifiLock");
                    wifiLock = legacyLock;
                }
                wifiLock.setReferenceCounted(false);
                wifiLock.acquire();
            }
        } catch (Exception ignored) {}
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
            }
        } catch (Exception ignored) {}

        try {
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
                wifiLock = null;
            }
        } catch (Exception ignored) {}
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "DriveVault Transfers",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Shows active file upload and download progress");
            serviceChannel.setShowBadge(true);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(serviceChannel);
            }
        }
    }
}
