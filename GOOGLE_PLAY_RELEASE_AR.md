# النشر على Google Play — خطوات جاهزة

## ما تم إصلاحه في البناء
- **فشل البناء** (`Gradle 8.14.3 lower than Flutter's minimum 9.3.1`): رُفع Gradle إلى **9.3.1** والـ Android Gradle Plugin إلى **9.1.1** و Kotlin إلى **2.3.20** (نفس قالب Flutter الرسمي، مع بقاء `android.builtInKotlin=false` و `android.newDsl=false`).
- **التوقيع**: نسخة release لم تعد موقّعة بمفتاح debug. التوقيع يُقرأ من `android/key.properties` (محلياً) أو من أسرار GitHub (CI).
- **android-apk.yml**: كان تنسيق YAML مكسوراً في خطوتَي البناء، ومسار `TikBoostMessagingService.java` خاطئاً فتفشل خطوة التحقق.
- `android:allowBackup="false"` (استعادة النسخ الاحتياطي تُتلف مفاتيح `flutter_secure_storage` وتسبب تعطل التطبيق).
- رموز تصحيح الأخطاء الأصلية (`debugSymbolLevel`) لتقارير الأعطال في Play Console.
- رقم الإصدار صار `1.3.0+6` (يجب زيادة الرقم بعد `+` عند كل رفع جديد إلى Play).

## 1) إضافة أسرار GitHub (مرة واحدة)
المستودع ← Settings ← Secrets and variables ← Actions ← New repository secret:

| الاسم | القيمة |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | محتوى الملف `keystore.base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | كلمة مرور المفتاح (في `SIGNING_SECRETS_PRIVATE.txt`) |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | نفس كلمة المرور |
| `ADMOB_APP_ID` | *(اختياري)* معرّف تطبيق AdMob الحقيقي `ca-app-pub-XXXX~YYYY` |

> ملفات المفتاح **ليست** داخل مشروع الـ zip عمداً. لا ترفعها إلى GitHub أبداً، واحتفظ بنسخة احتياطية آمنة.
> إن فقدتَ المفتاح: Play Console ← App integrity ← طلب إعادة تعيين مفتاح الرفع (Play App Signing).

## 2) إنشاء إصدار جاهز لـ Google Play
```bash
git tag v1.3.0 && git push origin v1.3.0
```
عند وسم `v*` يُفرض التوقيع بالمفتاح الحقيقي (يفشل البناء إن لم تُضبط الأسرار)، وتجد `app-release.aab` في Artifacts أو في GitHub Release.

## 3) Play Console
1. أنشئ التطبيق بحزمة `com.tikboost.wh.app`، وفعّل **Play App Signing**.
2. ارفع `app-release.aab` إلى مسار Internal testing أولاً.
3. أكمل: سياسة الخصوصية، Data safety (الحساب، الإشعارات، الإعلانات، المشتريات)، تصنيف المحتوى، الإعلانات = نعم.
4. للمشتريات داخل التطبيق: أنشئ المنتجات بنفس `PointPackage.slug` وفق `GOOGLE_PLAY_BILLING_SETUP_AR.md`.

## بناء محلي موقّع
```bash
cd flutter-app/android
cp key.properties.example key.properties   # عدّل القيم
cp /path/to/tikboost-upload-keystore.jks app/upload-keystore.jks
cd .. && flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://tikboost-api-v2.onrender.com/api \
  --dart-define=SOCKET_URL=https://tikboost-api-v2.onrender.com
```
