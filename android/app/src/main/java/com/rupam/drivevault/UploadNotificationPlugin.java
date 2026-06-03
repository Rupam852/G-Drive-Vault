package com.rupam.drivevault;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import android.app.DownloadManager;
import android.net.Uri;
import android.os.Environment;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import android.os.AsyncTask;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(name = "UploadNotification", permissions = {
        @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" })
})
public class UploadNotificationPlugin extends Plugin {

    private final java.util.Map<String, Boolean> activeDownloads = new java.util.concurrent.ConcurrentHashMap<>();

    private static final String CHANNEL_ID = "upload_channel";
    private static final String CHANNEL_NAME = "File Uploads";

    private static final String ACTION_PAUSE = "com.rupam.drivevault.ACTION_PAUSE";
    private static final String ACTION_RESUME = "com.rupam.drivevault.ACTION_RESUME";
    private static final String ACTION_CANCEL = "com.rupam.drivevault.ACTION_CANCEL";

    private BroadcastReceiver actionReceiver;

    @Override
    public void load() {
        super.load();
        createNotificationChannel();
        registerActionReceiver();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shows active file upload progress and actions");
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void registerActionReceiver() {
        actionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                String id = intent.getStringExtra("id");
                if (id == null)
                    return;

                JSObject ret = new JSObject();
                ret.put("id", id);

                if (ACTION_PAUSE.equals(action)) {
                    ret.put("action", "pause");
                    notifyListeners("onNotificationAction", ret);
                } else if (ACTION_RESUME.equals(action)) {
                    ret.put("action", "resume");
                    notifyListeners("onNotificationAction", ret);
                } else if (ACTION_CANCEL.equals(action)) {
                    activeDownloads.put(id, false);
                    ret.put("action", "cancel");
                    notifyListeners("onNotificationAction", ret);
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_PAUSE);
        filter.addAction(ACTION_RESUME);
        filter.addAction(ACTION_CANCEL);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(actionReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(actionReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (actionReceiver != null) {
            try {
                getContext().unregisterReceiver(actionReceiver);
            } catch (Exception e) {
                // ignore
            }
        }
    }

    @PluginMethod
    public void checkLaunchIntent(PluginCall call) {
        JSObject ret = new JSObject();
        Activity activity = getActivity();
        if (activity != null) {
            Intent intent = activity.getIntent();
            if (intent != null && "settings_history".equals(intent.getStringExtra("open_tab"))) {
                ret.put("openTab", "settings_history");
                intent.removeExtra("open_tab");
            }
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void showProgressNotification(PluginCall call) {
        String id = call.getString("id");
        String title = call.getString("title");
        Integer progress = call.getInt("progress", 0);
        String speedText = call.getString("speedText", "");
        Boolean isPaused = call.getBoolean("isPaused", false);

        if (id == null || title == null) {
            call.reject("Missing required parameters: id or title");
            return;
        }

        Context context = getContext();
        int notificationId = id.hashCode();

        // 1. Content click intent to open Settings history tab
        Intent contentIntent = new Intent(context, MainActivity.class);
        contentIntent.putExtra("open_tab", "settings_history");
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                context,
                notificationId,
                contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // 2. Build NotificationBuilder
        Bitmap largeIcon = BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setLargeIcon(largeIcon)
                .setContentTitle(isPaused ? "[Paused] " + title : title)
                .setContentText(speedText)
                .setContentIntent(contentPendingIntent)
                .setProgress(100, progress, false)
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        // 3. Cancel Action Button (Works on all OS versions by passing 0 as icon
        // resource)
        Intent cancelIntent = new Intent(ACTION_CANCEL);
        cancelIntent.putExtra("id", id);
        PendingIntent cancelPendingIntent = PendingIntent.getBroadcast(
                context,
                notificationId + 3,
                cancelIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        builder.addAction(0, "Cancel", cancelPendingIntent);

        // 5. Fire Notification
        try {
            NotificationManagerCompat.from(context).notify(notificationId, builder.build());
            call.resolve();
        } catch (SecurityException e) {
            call.reject("Permission failed showing progress notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void showSuccessNotification(PluginCall call) {
        String id = call.getString("id");
        String title = call.getString("title");
        String notificationTitle = call.getString("notificationTitle", "Upload Successful");

        if (id == null || title == null) {
            call.reject("Missing required parameters: id or title");
            return;
        }

        Context context = getContext();
        int notificationId = id.hashCode();

        Intent contentIntent = new Intent(context, MainActivity.class);
        contentIntent.putExtra("open_tab", "settings_history");
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                context,
                notificationId,
                contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Bitmap largeIcon = BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setLargeIcon(largeIcon)
                .setContentTitle(notificationTitle)
                .setContentText(title)
                .setContentIntent(contentPendingIntent)
                .setOngoing(false)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        try {
            NotificationManagerCompat.from(context).notify(notificationId, builder.build());
            call.resolve();
        } catch (SecurityException e) {
            call.reject("Permission failed showing success notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelNotification(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("Missing required parameters: id");
            return;
        }

        activeDownloads.put(id, false);

        Context context = getContext();
        int notificationId = id.hashCode();
        NotificationManagerCompat.from(context).cancel(notificationId);
        call.resolve();
    }

    private String formatBytesJava(long bytes) {
        if (bytes <= 0)
            return "0 Bytes";
        final String[] units = new String[] { "Bytes", "KB", "MB", "GB", "TB" };
        int digitGroups = (int) (Math.log10(bytes) / Math.log10(1024));
        return String.format(Locale.US, "%.1f %s", bytes / Math.pow(1024, digitGroups), units[digitGroups]);
    }

    @PluginMethod
    public void downloadFileNatively(PluginCall call) {
        String urlString = call.getString("url");
        String filename = call.getString("filename");
        String id = call.getString("id");

        long tempSize = -1L;
        try {
            if (call.hasOption("size")) {
                Object sizeObj = call.getData().get("size");
                if (sizeObj instanceof Number) {
                    tempSize = ((Number) sizeObj).longValue();
                } else if (sizeObj instanceof String) {
                    tempSize = Long.parseLong((String) sizeObj);
                }
            }
        } catch (Exception e) {
            tempSize = -1L;
        }
        final long totalSizeBytes = tempSize;

        if (urlString == null || filename == null || id == null) {
            call.reject("Missing required parameters: url, filename, or id");
            return;
        }

        Context context = getContext();
        activeDownloads.put(id, true);

        new Thread(new Runnable() {
            @Override
            public void run() {
                InputStream input = null;
                OutputStream output = null;
                HttpURLConnection connection = null;
                File outputFile = null;
                int notificationId = id.hashCode();
                try {
                    URL url = new URL(urlString);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestProperty("User-Agent", "Mozilla/5.0");
                    connection.setInstanceFollowRedirects(true);
                    connection.connect();

                    int responseCode = connection.getResponseCode();
                    int redirectCount = 0;
                    while ((responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
                            responseCode == HttpURLConnection.HTTP_MOVED_PERM ||
                            responseCode == 307 || responseCode == 308) && redirectCount < 5) {
                        String newUrl = connection.getHeaderField("Location");
                        if (newUrl == null)
                            break;
                        connection.disconnect();
                        url = new URL(newUrl);
                        connection = (HttpURLConnection) url.openConnection();
                        connection.setRequestProperty("User-Agent", "Mozilla/5.0");
                        connection.setInstanceFollowRedirects(true);
                        connection.connect();
                        responseCode = connection.getResponseCode();
                        redirectCount++;
                    }

                    if (responseCode < 200 || responseCode >= 300) {
                        call.reject("Server returned HTTP " + responseCode + " " + connection.getResponseMessage());
                        return;
                    }

                    // Read Content-Length robustly
                    long fileLength = totalSizeBytes;
                    if (fileLength <= 0) {
                        String contentLengthHeader = connection.getHeaderField("Content-Length");
                        if (contentLengthHeader != null) {
                            try {
                                fileLength = Long.parseLong(contentLengthHeader);
                            } catch (NumberFormatException ignored) {
                            }
                        }
                    }
                    if (fileLength <= 0) {
                        fileLength = connection.getContentLength();
                    }

                    // Destination file (Try public Download directory first, fallback to private)
                    File publicDownloadDir = Environment
                            .getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    boolean usingPublicStorage = false;
                    try {
                        if (publicDownloadDir != null && (publicDownloadDir.exists() || publicDownloadDir.mkdirs())) {
                            outputFile = new File(publicDownloadDir, filename);
                            // Test if writable by creating/touching the file
                            FileOutputStream testOut = new FileOutputStream(outputFile, true);
                            testOut.close();
                            usingPublicStorage = true;
                        }
                    } catch (Exception e) {
                        usingPublicStorage = false;
                    }

                    if (!usingPublicStorage) {
                        File externalDir = context.getExternalFilesDir(null);
                        if (externalDir == null) {
                            call.reject("External storage unavailable");
                            return;
                        }
                        outputFile = new File(externalDir, filename);
                    }

                    if (outputFile.exists() && !usingPublicStorage) {
                        outputFile.delete();
                    }

                    input = connection.getInputStream();
                    output = new FileOutputStream(outputFile);

                    byte[] data = new byte[64 * 1024]; // 64KB high speed buffer
                    long total = 0;
                    int count;
                    long startTime = System.currentTimeMillis();
                    long lastNotificationTime = 0;

                    // Click intent
                    Intent contentIntent = new Intent(context, MainActivity.class);
                    contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    PendingIntent contentPendingIntent = PendingIntent.getActivity(
                            context,
                            notificationId,
                            contentIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

                    // Builder
                    Bitmap largeIcon = BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher);
                    NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                            .setSmallIcon(R.drawable.ic_launcher_foreground)
                            .setLargeIcon(largeIcon)
                            .setContentTitle("Downloading " + filename)
                            .setContentIntent(contentPendingIntent)
                            .setOngoing(true)
                            .setAutoCancel(false)
                            .setOnlyAlertOnce(true)
                            .setPriority(NotificationCompat.PRIORITY_DEFAULT);

                    // Cancel Intent
                    Intent cancelIntent = new Intent(ACTION_CANCEL);
                    cancelIntent.putExtra("id", id);
                    PendingIntent cancelPendingIntent = PendingIntent.getBroadcast(
                            context,
                            notificationId + 3,
                            cancelIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                    builder.addAction(0, "Cancel", cancelPendingIntent);

                    while ((count = input.read(data)) != -1) {
                        // Check for cancellation
                        if (activeDownloads.containsKey(id) && !activeDownloads.get(id)) {
                            output.close();
                            input.close();
                            if (outputFile.exists()) {
                                outputFile.delete();
                            }
                            NotificationManagerCompat.from(context).cancel(notificationId);
                            call.reject("Cancelled");
                            return;
                        }

                        total += count;
                        output.write(data, 0, count);

                        long now = System.currentTimeMillis();
                        if (now - lastNotificationTime > 300) {
                            int progress = fileLength > 0 ? (int) ((total * 100) / fileLength) : -1;

                            double elapsedSeconds = (now - startTime) / 1000.0;
                            double speed = elapsedSeconds > 0 ? total / elapsedSeconds : 0.0;
                            double remainingBytes = fileLength > 0 ? Math.max(0, fileLength - total) : 0.0;
                            double remainingSeconds = speed > 0 ? remainingBytes / speed : 0.0;

                            String progressSizeText = fileLength > 0
                                    ? formatBytesJava(total) + " / " + formatBytesJava(fileLength)
                                    : formatBytesJava(total);
                            String speedText = speed > 1048576 ? String.format(Locale.US, "%.1f MB/s", speed / 1048576)
                                    : String.format(Locale.US, "%.0f KB/s", speed / 1024);
                            String etaText = remainingSeconds > 60 ? ((int) (remainingSeconds / 60)) + "m left"
                                    : ((int) remainingSeconds) + "s left";

                            String speedDetails = fileLength > 0
                                    ? progressSizeText + " • " + speedText + " • " + etaText
                                    : progressSizeText + " • " + speedText;

                            builder.setProgress(100, progress, false);
                            builder.setContentText(speedDetails);

                            JSObject progressRet = new JSObject();
                            progressRet.put("id", id);
                            progressRet.put("progress", progress);
                            notifyListeners("onDownloadProgress", progressRet);

                            try {
                                NotificationManagerCompat.from(context).notify(notificationId, builder.build());
                            } catch (SecurityException e) {
                                // ignore
                            }

                            lastNotificationTime = now;
                        }
                    }

                    output.flush();
                    output.close();
                    input.close();

                    // Emit a guaranteed 100% complete event to complete React app progress bars
                    // immediately
                    try {
                        JSObject progressRet = new JSObject();
                        progressRet.put("id", id);
                        progressRet.put("progress", 100);
                        notifyListeners("onDownloadProgress", progressRet);
                    } catch (Exception ignored) {
                    }

                    // Notify media scanner so file appears in standard Android Downloads app
                    // instantly
                    try {
                        android.media.MediaScannerConnection.scanFile(context,
                                new String[] { outputFile.getAbsolutePath() },
                                null,
                                new android.media.MediaScannerConnection.OnScanCompletedListener() {
                                    public void onScanCompleted(String path, android.net.Uri uri) {
                                        // Scan completed successfully
                                    }
                                });
                    } catch (Exception ignored) {
                    }

                    // Complete success notification
                    Bitmap successLargeIcon = BitmapFactory.decodeResource(context.getResources(),
                            R.mipmap.ic_launcher);
                    NotificationCompat.Builder successBuilder = new NotificationCompat.Builder(context, CHANNEL_ID)
                            .setSmallIcon(R.drawable.ic_launcher_foreground)
                            .setLargeIcon(successLargeIcon)
                            .setContentTitle("Download Successful")
                            .setContentText("Downloaded " + filename)
                            .setContentIntent(contentPendingIntent)
                            .setOngoing(false)
                            .setAutoCancel(true)
                            .setPriority(NotificationCompat.PRIORITY_DEFAULT);

                    try {
                        NotificationManagerCompat.from(context).notify(notificationId, successBuilder.build());
                    } catch (SecurityException e) {
                        // ignore
                    }

                    JSObject ret = new JSObject();
                    ret.put("path", outputFile.getAbsolutePath());
                    call.resolve(ret);

                } catch (Exception e) {
                    if (outputFile != null && outputFile.exists()) {
                        outputFile.delete();
                    }
                    NotificationManagerCompat.from(context).cancel(notificationId);
                    call.reject("Download failed: " + e.getMessage());
                } finally {
                    try {
                        if (output != null)
                            output.close();
                        if (input != null)
                            input.close();
                    } catch (IOException ignored) {
                    }
                    if (connection != null)
                        connection.disconnect();
                    activeDownloads.remove(id);
                }
            }
        }).start();
    }

    @PluginMethod
    public void installApkNatively(PluginCall call) {
        String filePath = call.getString("path");
        if (filePath == null) {
            call.reject("Missing parameter: path");
            return;
        }

        Context context = getContext();
        File file = new File(filePath);
        if (!file.exists()) {
            call.reject("File does not exist: " + filePath);
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            Uri fileUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                fileUri = androidx.core.content.FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        file);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                fileUri = Uri.fromFile(file);
            }

            intent.setDataAndType(fileUri, "application/vnd.android.package-archive");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to trigger install: " + e.getMessage());
        }
    }
}
