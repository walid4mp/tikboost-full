import json, re, importlib, sys
sys.path.insert(0,'/home/claude/gen')
import tr_en, tr_fr, new_tr
importlib.reload(new_tr)
OUT='/home/claude/work/tikboost-full-main/flutter-app/lib/i18n/translations.dart'
def dec(s):
    return s.replace('\\n','\n').replace('\\"','"').replace("\\'","'").replace('\\\\','\\')
def esc(s):
    return s.replace('\\','\\\\').replace("'","\\'").replace('$','\\$').replace('\n','\\n')
static=json.load(open('/tmp/static.json'))
table={}
for a,e,f in zip(static,tr_en.EN,tr_fr.FR):
    table[dec(a)]=(dec(e),dec(f))
for a,(e,f) in new_tr.NEW.items():
    table[a]=(e,f)
rules=[
 (r'^حصلت على (.+)$','You got {1}','Vous avez obtenu {1}'),
 (r'^\+(.+) نقطة$','+{1} points','+{1} points'),
 (r'^(\d[\d,.]*) نقطة$','{1} points','{1} points'),
 (r'^التكلفة الإجمالية: (.+)$','Total cost: {1}','Coût total : {1}'),
 (r'^المكافأة لكل مهمة: (.+)$','Reward per task: {1}','Récompense par tâche : {1}'),
 (r'^الحد المسموح: (.+) - (.+)$','Allowed range: {1} - {2}','Plage autorisée : {1} - {2}'),
 (r'^العدد يجب أن يكون بين (.+) و (.+)$','Quantity must be between {1} and {2}','La quantité doit être comprise entre {1} et {2}'),
 (r'^الاستهداف الحالي: (.+)$','Current targeting: {1}','Ciblage actuel : {1}'),
 (r'^مرحباً، (.+)$','Hello, {1}','Bonjour, {1}'),
 (r'^لديك (.+) رسالة جديدة$','You have {1} new messages','Vous avez {1} nouveaux messages'),
 (r'^الإشعارات \((.+)\)$','Notifications ({1})','Notifications ({1})'),
 (r'^(\d+) عروض$','{1} offers','{1} offres'),
 (r'^(\d+) باقات$','{1} packages','{1} packs'),
 (r'^مدة الاشتراك: (.+) يوم$','Subscription length: {1} days','Durée de l\'abonnement : {1} jours'),
 (r'^رقم الطلب: (.+)$','Order number: {1}','Numéro de commande : {1}'),
 (r'^مكافأة إضافية: (.+) نقطة لكل مهمة وفق إعدادات الخادم$','Extra reward: {1} points per task, per server settings','Récompense supplémentaire : {1} points par tâche selon le serveur'),
 (r'^(.+) يوم • \+(.+)% نقاط لكل مهمة$','{1} days • +{2}% points per task','{1} jours • +{2} % de points par tâche'),
 (r'^تم التنفيذ! ربحت (.+)$','Done! You earned {1}','Terminé ! Vous avez gagné {1}'),
 (r'^مبروك! حصلت على (.+)$','Congratulations! You got {1}','Félicitations ! Vous avez obtenu {1}'),
 (r'^مبروك! ربحت (.+) من الصندوق اليومي$','Congratulations! You won {1} from the daily chest','Félicitations ! Vous avez gagné {1} du coffre quotidien'),
 (r'^تم استلام (.+)$','Received {1}','Reçu : {1}'),
 (r'^تمت إضافة (.+)$','Added: {1}','Ajouté : {1}'),
 (r'^🏆 حصلت على (.+)$','🏆 You got {1}','🏆 Vous avez obtenu {1}'),
 (r'^ربحت (.+)$','You won {1}','Vous avez gagné {1}'),
 (r'^انضم (.+)$','{1} joined','{1} a rejoint'),
 (r'^التقدم: (.+)$','Progress: {1}','Progression : {1}'),
 (r'^عجلة tikboost.wh • (.+)$','tikboost.wh wheel • {1}','Roue tikboost.wh • {1}'),
 (r'^(.+) • مجتمع المكافآت والتفاعل$','{1} • Rewards and engagement community','{1} • Communauté de récompenses et d\'interaction'),
]
for a,e,f in new_tr.RULES: rules.append((a,e,f))
o=["// GENERATED FILE - do not edit by hand. Source: tools/i18n/ (Arabic is the source language).",
   "// ignore_for_file: prefer_single_quotes, unnecessary_string_escapes",
   "import 'i18n.dart';","",
   "/// Arabic -> [English, French].","const Map<String, List<String>> kTr = <String, List<String>>{"]
for a,(e,f) in table.items():
    o.append(f"  '{esc(a)}': ['{esc(e)}', '{esc(f)}'],")
o.append("};\n")
o.append("final List<TrRule> kTrRules = <TrRule>[")
for p,e,f in rules:
    o.append(f"  TrRule(RegExp(r'{p}'), '{esc(e)}', '{esc(f)}'),".replace("r'^\\+","r'^\\+"))
o.append("];\n")
open(OUT,'w',encoding='utf8').write('\n'.join(o))
print(len(table),'entries',len(rules),'rules')
