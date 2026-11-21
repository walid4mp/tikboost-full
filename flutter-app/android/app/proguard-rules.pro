# Only used if minifyEnabled is turned back on in app/build.gradle.

# Room / WorkManager (AdMob) create *_Impl classes reflectively through their no-arg constructor.
-keep class * extends androidx.room.RoomDatabase { void <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { void <init>(); }
-keep class * extends androidx.startup.Initializer { void <init>(); }

# flutter_local_notifications (Gson reflection)
-keep class com.dexterous.flutterlocalnotifications.** { *; }
-keepattributes Signature,*Annotation*,InnerClasses,EnclosingMethod

# Firebase messaging service declared in the manifest
-keep class com.tikboost.wh.app.** { *; }
