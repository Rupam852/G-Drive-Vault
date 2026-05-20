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

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
        name = "UploadNotification",
        permissions = {
                @Permission(
                        alias = "notifications",
                        strings = { "android.permission.POST_NOTIFICATIONS" }
                )
        }
)
public class UploadNotificationPlugin extends Plugin {

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
                    NotificationManager.IMPORTANCE_LOW
            );
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
                if (id == null) return;

                JSObject ret = new JSObject();
                ret.put("id", id);

                if (ACTION_PAUSE.equals(action)) {
                    ret.put("action", "pause");
                    notifyListeners("onNotificationAction", ret);
                } else if (ACTION_RESUME.equals(action)) {
                    ret.put("action", "resume");
                    notifyListeners("onNotificationAction", ret);
                } else if (ACTION_CANCEL.equals(action)) {
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
            getContext().registerReceiver(actionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
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
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // 2. Build NotificationBuilder
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(isPaused ? "[Paused] " + title : title)
                .setContentText(speedText)
                .setContentIntent(contentPendingIntent)
                .setProgress(100, progress, false)
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        // 3. Cancel Action Button (Works on all OS versions by passing 0 as icon resource)
        Intent cancelIntent = new Intent(ACTION_CANCEL);
        cancelIntent.putExtra("id", id);
        PendingIntent cancelPendingIntent = PendingIntent.getBroadcast(
                context,
                notificationId + 3,
                cancelIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
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
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Upload Successful")
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

        Context context = getContext();
        int notificationId = id.hashCode();
        NotificationManagerCompat.from(context).cancel(notificationId);
        call.resolve();
    }
}
