package com.tikboost.wh.app

import android.util.Log
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        // Channel creation must never be able to take the app down.
        try {
            NotificationChannels.createAll(applicationContext)
        } catch (e: Exception) {
            Log.w("MainActivity", "Could not create notification channels", e)
        }
    }
}
