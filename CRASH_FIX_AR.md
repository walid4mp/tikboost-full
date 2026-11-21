# إصلاح انهيار التطبيق عند التشغيل (1.3.0) — "tikboost.wh يستمر في التوقف"

## السبب (تم التأكد منه داخل ملف APK نفسه)
- بعد الترقية إلى AGP 9 صار مضغِّط الكود R8 يحذف **المُنشئ الافتراضي** للصنف `androidx.work.impl.WorkDatabase_Impl`.
- مكتبة WorkManager (تأتي مع AdMob) تنشئ هذا الصنف بالانعكاس عبر `androidx.startup` **قبل أن يبدأ Flutter**، فينهار التطبيق فور فتحه.
- فحص الـ APK أظهر الصنف موجوداً بدون `<init>` (المُنشئ).

## الإصلاح
1. `android/app/build.gradle`: `minifyEnabled false` و `shrinkResources false` لنسخة release (يمنع هذه الفئة من الأخطاء كلها، ويحفظ `res/raw/notify`).
2. `android/gradle.properties`: `android.r8.strictFullModeForKeepRules=false` لاستعادة سلوك R8 القديم إن أُعيد تفعيل التقليص.
3. `android/app/proguard-rules.pro`: قواعد Room/WorkManager/الإشعارات جاهزة لأي تفعيل لاحق للتقليص.
4. `MainActivity.kt`: إنشاء قنوات الإشعارات داخل `try/catch` وعبر `NotificationChannels` الموحّدة (تتعامل مع غياب ملف الصوت).
5. الإصدار صار `1.3.1+7` (لازم رقم أعلى كي يُثبَّت فوق 1.3.0 المنهار).

## ملاحظة
حجم APK يزيد قليلاً بدون التقليص، وهذا مقبول وآمن لـ Google Play.
