package com.tikboost.wh.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build

/**
 * Single source of truth for the notification channels so that both the
 * activity and the messaging service create identical high-importance
 * channels (FCM falls back to a muted channel when the target channel is
 * missing — that is the classic cause of "sometimes no notification").
 */
object NotificationChannels {
    const val GENERAL = "tikboostwh_general_v2"
    const val REMINDERS = "tikboostwh_reminders_v2"

    fun createAll(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val resId = context.resources.getIdentifier("notify", "raw", context.packageName)
        val soundUri = if (resId != 0) {
            Uri.parse("android.resource://${context.packageName}/$resId")
        } else null
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val manager = context.getSystemService(NotificationManager::class.java)

        val general = NotificationChannel(
            GENERAL, "إشعارات tikboost.wh", NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "الإشعارات المهمة من tikboost.wh"
            enableVibration(true)
            if (soundUri != null) setSound(soundUri, audioAttributes)
        }

        val reminders = NotificationChannel(
            REMINDERS, "تذكيرات tikboost.wh", NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "تذكير المستخدم بالعودة إلى tikboost.wh"
            enableVibration(true)
            if (soundUri != null) setSound(soundUri, audioAttributes)
        }

        manager.createNotificationChannel(general)
        manager.createNotificationChannel(reminders)
    }
}
