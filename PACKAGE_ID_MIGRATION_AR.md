# تحديث اسم الحزمة إلى com.tikboost.wh.app

تم تحديث applicationId وnamespace وتعريفات Kotlin/Java ومسارات ملفات Android وإعدادات Google Play في المشروع.

## مطلوب قبل تسجيل الدخول والإشعارات الفعلية
1. افتح Firebase Console للمشروع الذي يستخدمه TikBoost.
2. أضف تطبيق Android جديدًا بالمعرّف `com.tikboost.wh.app`.
3. أضف SHA-1 وSHA-256 من شهادة التوقيع التي ستستخدمها، ثم فعّل Google Sign-In في Authentication إذا كان مستخدمًا.
4. نزّل `google-services.json` الجديد واستبدل `flutter-app/android/app/google-services.json`. لا تعدّل الملف القديم يدويًا باعتباره بديلًا عن تسجيل التطبيق الجديد.
5. حدّث إعدادات OAuth/Google Sign-In المرتبطة بالحزمة الجديدة إذا طلبت Firebase ذلك.
6. في Render، اضبط `GOOGLE_PLAY_PACKAGE_NAME=com.tikboost.wh.app`.
7. أنشئ/استخدم تطبيق Google Play Console المسجل بالمعرّف نفسه، ثم أعد بناء AAB واختبره.

اسم الحزمة لا يمكن تغييره لتطبيق Play Console الذي تم إنشاؤه بالفعل؛ إن أنشأت التطبيق بمعرّف مختلف، يجب إنشاء تطبيق جديد أو متابعة المعرف الذي سجلته.
