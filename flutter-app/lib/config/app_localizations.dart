import 'package:flutter/material.dart';

class AppLocalizations {
  final Locale locale;
  const AppLocalizations(this.locale);

  static const supportedLocales = [Locale('ar'), Locale('fr'), Locale('en')];

  static const _values = <String, Map<String, String>>{
    'settings': {'ar':'الإعدادات','en':'Settings','fr':'Paramètres'},
    'dark_mode': {'ar':'الوضع الداكن','en':'Dark mode','fr':'Mode sombre'},
    'change_language': {'ar':'تغيير اللغة','en':'Change language','fr':'Changer de langue'},
    'language_subtitle': {'ar':'العربية / Français / English','en':'Arabic / French / English','fr':'Arabe / Français / Anglais'},
    'sounds': {'ar':'أصوات التطبيق','en':'App sounds','fr':'Sons de l’application'},
    'sounds_subtitle': {'ar':'صوت الإشعارات وعجلة الحظ','en':'Notification and lucky wheel sounds','fr':'Sons des notifications et de la roue'},
    'push': {'ar':'الإشعارات الفورية','en':'Push notifications','fr':'Notifications push'},
    'push_subtitle': {'ar':'مفعّلة عبر Socket.io','en':'Enabled via Socket.io','fr':'Activées via Socket.io'},
    'notifications_permission': {'ar':'السماح بإشعارات TikBoost','en':'Allow TikBoost notifications','fr':'Autoriser les notifications TikBoost'},
    'notifications_permission_subtitle': {'ar':'ستصلك الإشعارات حتى عندما يكون التطبيق مغلقًا. سيظهر الآن طلب السماح من النظام.','en':'You can receive notifications even when the app is closed. The system permission prompt will appear now.','fr':'Vous recevrez les notifications même lorsque l’application est fermée. La demande d’autorisation du système va apparaître.'},
    'notifications_allowed': {'ar':'الإشعارات مفعّلة','en':'Notifications enabled','fr':'Notifications activées'},
    'notifications_denied': {'ar':'الإشعارات غير مفعّلة','en':'Notifications are disabled','fr':'Notifications désactivées'},
    'allow_notifications': {'ar':'السماح بالإشعارات','en':'Allow notifications','fr':'Autoriser les notifications'},
    'privacy': {'ar':'سياسة الخصوصية','en':'Privacy policy','fr':'Politique de confidentialité'},
    'terms': {'ar':'الشروط والأحكام','en':'Terms and conditions','fr':'Conditions générales'},
    'contact': {'ar':'اتصل بنا','en':'Contact us','fr':'Nous contacter'},
    'logout': {'ar':'تسجيل الخروج','en':'Log out','fr':'Se déconnecter'},
    'home': {'ar':'الرئيسية','en':'Home','fr':'Accueil'},
    'earn': {'ar':'اكسب','en':'Earn','fr':'Gagner'},
    'campaign': {'ar':'حملة','en':'Campaign','fr':'Campagne'},
    'vip': {'ar':'VIP','en':'VIP','fr':'VIP'},
    'account': {'ar':'حسابي','en':'My account','fr':'Mon compte'},
    'login': {'ar':'تسجيل الدخول','en':'Log in','fr':'Connexion'},
    'signup': {'ar':'إنشاء حساب','en':'Create account','fr':'Créer un compte'},
    'new_account': {'ar':'إنشاء حساب جديد','en':'Create a new account','fr':'Créer un nouveau compte'},
    'email': {'ar':'البريد الإلكتروني','en':'Email','fr':'E-mail'},
    'password': {'ar':'كلمة المرور','en':'Password','fr':'Mot de passe'},
    'confirm_password': {'ar':'تأكيد كلمة المرور الجديدة','en':'Confirm new password','fr':'Confirmer le nouveau mot de passe'},
    'full_name': {'ar':'الاسم الكامل','en':'Full name','fr':'Nom complet'},
    'forgot_password': {'ar':'نسيت كلمة المرور؟','en':'Forgot password?','fr':'Mot de passe oublié ?'},
    'show_password': {'ar':'إظهار كلمة المرور','en':'Show password','fr':'Afficher le mot de passe'},
    'hide_password': {'ar':'إخفاء كلمة المرور','en':'Hide password','fr':'Masquer le mot de passe'},
    'update': {'ar':'تحديث','en':'Refresh','fr':'Actualiser'},
    'retry': {'ar':'إعادة المحاولة','en':'Retry','fr':'Réessayer'},
    'cancel': {'ar':'إلغاء','en':'Cancel','fr':'Annuler'},
    'start': {'ar':'ابدأ','en':'Start','fr':'Commencer'},
    'all': {'ar':'الكل','en':'All','fr':'Tous'},
    'country': {'ar':'الدولة','en':'Country','fr':'Pays'},
    'choose_country': {'ar':'اختر الدولة','en':'Choose country','fr':'Choisir un pays'},
    'type': {'ar':'النوع','en':'Type','fr':'Type'},
    'choose_type': {'ar':'اختر النوع','en':'Choose type','fr':'Choisir le type'},
    'points': {'ar':'النقاط','en':'Points','fr':'Points'},
    'balance': {'ar':'الرصيد','en':'Balance','fr':'Solde'},
    'shop': {'ar':'المتجر','en':'Shop','fr':'Boutique'},
    'referrals': {'ar':'الإحالات','en':'Referrals','fr':'Parrainage'},
    'notifications': {'ar':'الإشعارات','en':'Notifications','fr':'Notifications'},
    'no_notifications': {'ar':'لا توجد إشعارات','en':'No notifications','fr':'Aucune notification'},
    'open_details': {'ar':'اضغط لفتح التفاصيل','en':'Tap to open details','fr':'Appuyez pour ouvrir les détails'},
    'contact_us': {'ar':'تواصل معنا','en':'Contact us','fr':'Nous contacter'},
    'save': {'ar':'حفظ','en':'Save','fr':'Enregistrer'},
    'saving': {'ar':'جاري الحفظ...','en':'Saving...','fr':'Enregistrement...'},
    'loading': {'ar':'جاري التحميل...','en':'Loading...','fr':'Chargement...'},
    'processing': {'ar':'جاري التحقق...','en':'Verifying...','fr':'Vérification...'},
    'create_campaign': {'ar':'إنشاء حملة','en':'Create campaign','fr':'Créer une campagne'},
    'new_campaign': {'ar':'حملة جديدة','en':'New campaign','fr':'Nouvelle campagne'},
    'start_campaign': {'ar':'بدء الحملة','en':'Start campaign','fr':'Démarrer la campagne'},
    'campaigns': {'ar':'حملاتي','en':'My campaigns','fr':'Mes campagnes'},
    'no_campaigns': {'ar':'لا توجد حملات','en':'No campaigns','fr':'Aucune campagne'},
    'earn_points': {'ar':'جمع النقاط','en':'Earn points','fr':'Gagner des points'},
    'no_tasks': {'ar':'لا توجد مهام حالياً','en':'No tasks available','fr':'Aucune tâche disponible'},
    'complete_task': {'ar':'أكمل المهمة','en':'Complete task','fr':'Terminer la tâche'},
    'claim_reward': {'ar':'استلام المكافأة','en':'Claim reward','fr':'Récupérer la récompense'},
    'daily_reward': {'ar':'مكافأة اليوم','en':'Daily reward','fr':'Récompense quotidienne'},
    'welcome_reward': {'ar':'مكافأة ترحيب','en':'Welcome reward','fr':'Récompense de bienvenue'},
    'lucky_wheel': {'ar':'عجلة الحظ','en':'Lucky wheel','fr':'Roue de la chance'},
    'spin': {'ar':'لف الآن','en':'Spin now','fr':'Tourner maintenant'},
    'extra_spin': {'ar':'استخدم لفة إضافية','en':'Use an extra spin','fr':'Utiliser un tour supplémentaire'},
    'payment_history': {'ar':'طلبات الدفع وحالتها','en':'Payment requests and status','fr':'Demandes de paiement et statut'},
    'no_payments': {'ar':'لا توجد طلبات دفع حتى الآن','en':'No payment requests yet','fr':'Aucune demande de paiement pour le moment'},
    'payment_method': {'ar':'اختر طريقة الدفع','en':'Choose payment method','fr':'Choisir le mode de paiement'},
    'deposit': {'ar':'إيداع / شحن','en':'Deposit / Top up','fr':'Dépôt / Recharge'},
    'paypal_card': {'ar':'الدفع عبر PayPal / البطاقة','en':'PayPal / card payment','fr':'Paiement PayPal / carte'},
    'attach_proof': {'ar':'إرفاق صورة إثبات الدفع','en':'Attach payment proof','fr':'Joindre la preuve de paiement'},
    'send_payment': {'ar':'إرسال طلب الدفع','en':'Send payment request','fr':'Envoyer la demande de paiement'},
    'transaction_id': {'ar':'رقم المعاملة / Transaction ID','en':'Transaction ID','fr':'ID de transaction'},
    'reviewed_later': {'ar':'سيتم مراجعة إثبات الدفع وتحديث حسابك بعد الموافقة.','en':'Your payment proof will be reviewed and your account updated after approval.','fr':'Votre preuve de paiement sera vérifiée et votre compte mis à jour après approbation.'},
    'language_ar': {'ar':'العربية','en':'Arabic','fr':'Arabe'},
    'language_fr': {'ar':'Français','en':'French','fr':'Français'},
    'language_en': {'ar':'English','en':'English','fr':'Anglais'},
    'choose_language': {'ar':'اختر اللغة','en':'Choose language','fr':'Choisir la langue'},
    'arabic': {'ar':'العربية','en':'Arabic','fr':'Arabe'},
    'french': {'ar':'الفرنسية','en':'French','fr':'Français'},
    'english': {'ar':'الإنجليزية','en':'English','fr':'Anglais'},
    'welcome': {'ar':'مرحبًا بعودتك 👋','en':'Welcome back 👋','fr':'Bon retour 👋'},
    'continue': {'ar':'متابعة','en':'Continue','fr':'Continuer'},
    'or': {'ar':'أو','en':'or','fr':'ou'},
    'google': {'ar':'متابعة باستخدام Google','en':'Continue with Google','fr':'Continuer avec Google'},
    'no_account': {'ar':'ليس لديك حساب؟ إنشاء حساب','en':'Don’t have an account? Create one','fr':'Vous n’avez pas de compte ? Créez-en un'},
    'already_account': {'ar':'لديك حساب؟ تسجيل الدخول','en':'Already have an account? Log in','fr':'Vous avez déjà un compte ? Connectez-vous'},
    'security': {'ar':'حماية الحساب','en':'Account security','fr':'Sécurité du compte'},
    'change_password': {'ar':'تغيير كلمة المرور','en':'Change password','fr':'Changer le mot de passe'},
    'restore_code': {'ar':'طلب رمز الاستعادة','en':'Request recovery code','fr':'Demander le code de récupération'},
    'success': {'ar':'تم بنجاح','en':'Success','fr':'Réussi'},
    'error': {'ar':'حدث خطأ غير متوقع','en':'An unexpected error occurred','fr':'Une erreur inattendue est survenue'},
    'try_again': {'ar':'حدث خطأ، حاول مرة أخرى.','en':'Something went wrong. Try again.','fr':'Une erreur est survenue. Réessayez.'},
  };

  String get(String key, [String? fallback]) {
    final lang = locale.languageCode;
    return _values[key]?[lang] ?? _values[key]?['en'] ?? fallback ?? key;
  }
}

class AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const AppLocalizationsDelegate();
  @override
  bool isSupported(Locale locale) => ['ar', 'fr', 'en'].contains(locale.languageCode);
  @override
  Future<AppLocalizations> load(Locale locale) async => AppLocalizations(locale);
  @override
  bool shouldReload(AppLocalizationsDelegate old) => false;
}

extension AppLocalizationContext on BuildContext {
  AppLocalizations get l10n => Localizations.of<AppLocalizations>(this, AppLocalizations)!;
  String tr(String key, [String? fallback]) => l10n.get(key, fallback);
}
