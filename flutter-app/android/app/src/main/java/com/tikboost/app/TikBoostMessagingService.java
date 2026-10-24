package com.tikboost.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Native FCM service for data-only push messages.
 *
 * Firebase/Android renders notification payloads automatically while the app
 * is backgrounded or terminated. Data-only payloads arrive here and must be
 * rendered manually so admin-sent pushes still appear when TokAura is closed.
 */
public class TikBoostMessagingService extends FirebaseMessagingService {

    public static final String GENERAL_CHANNEL = "tokaura_general_v2";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        createNotificationChannel();

        if (message.getNotification() != null) {
            return;
        }

        String title = message.getData().get("title");
        String body = message.getData().get("body");

        if (title == null || title.trim().isEmpty()) {
            title = "TokAura";
        }
        if (body == null) {
            body = "";
        }

        if (!title.trim().isEmpty() || !body.trim().isEmpty()) {
            showNotification(title, body);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        // firebase_messaging handles token refresh on the Flutter side.
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        Context context = getApplicationContext();
        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        int soundId = context.getResources().getIdentifier(
                "notify", "raw", context.getPackageName());
        Uri soundUri = soundId != 0
                ? Uri.parse("android.resource://" + context.getPackageName() + "/" + soundId)
                : null;

        NotificationChannel channel = new NotificationChannel(
                GENERAL_CHANNEL,
                "إشعارات TokAura",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("الإشعارات المهمة من TokAura");
        channel.enableVibration(true);

        if (soundUri != null) {
            AudioAttributes attributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            channel.setSound(soundUri, attributes);
        }

        manager.createNotificationChannel(channel);
    }

    private void showNotification(String title, String body) {
        Context context = getApplicationContext();

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(context, GENERAL_CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setContentIntent(pendingIntent)
                .build();

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), notification);
        }
    }
}
