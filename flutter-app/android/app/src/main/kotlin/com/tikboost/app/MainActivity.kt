package com.tikboost.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val soundUri = Uri.parse(
            "android.resource://$packageName/${resources.getIdentifier("notify", "raw", packageName)}"
        )
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val manager = getSystemService(NotificationManager::class.java)

        val general = NotificationChannel(
            "tokaura_general_v2",
            "إشعارات TokAura",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "الإشعارات المهمة من TokAura"
            enableVibration(true)
            setSound(soundUri, audioAttributes)
        }

        val reminders = NotificationChannel(
            "tokaura_reminders_v2",
            "تذكيرات TokAura",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "تذكيرات TokAura"
            enableVibration(true)
            setSound(soundUri, audioAttributes)
        }

        manager.createNotificationChannel(general)
        manager.createNotificationChannel(reminders)
    }
}
