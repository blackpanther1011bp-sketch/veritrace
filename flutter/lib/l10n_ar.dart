// القاموس العربي للتطبيق (العربية الفصحى المعاصرة، للمغرب). المفاتيح : النصوص الفرنسية (lib/l10n.dart).
// Dictionnaire arabe de l'application : clés = textes français passés à tr() / tn() ; vérifié par
// test/l10n_test.dart (aucun texte sans traduction, mêmes {valeurs}, aucune traduction orpheline).
// Mêmes traductions que le site (web/src/lib/i18n-ar.ts) pour les textes communs.
//
// مسرد المصطلحات (نفس الصيغة في كل الواجهة وعلى الموقع) :
//   note VeriTrace        → تقييم VeriTrace   (لا نقول أبدًا « شهادة » أو « علامة » : ليس علامة جودة)
//   coût environnemental  → الكلفة البيئية
//   points d'impact       → نقاط الأثر   (pts → نقطة)
//   coût officiel         → كلفة رسمية
//   estimation            → تقدير
//   alternative           → بديل (بدائل)
//   fiabilité             → الموثوقية
// الأرقام تبقى بالأرقام الغربية (0-9). أسماء المواد والبلدان القادمة من قاعدة البيانات تبقى بالفرنسية.
// À faire relire par une personne arabophone avant la mise en production.

const arStrings = <String, String>{
  // api.dart
  'Le calcul prend trop de temps : réessayez dans un instant.':
      'الحساب يستغرق وقتًا طويلًا: أعد المحاولة بعد لحظات.',
  'Le service ne répond pas correctement : réessayez dans un instant.':
      'الخدمة لا تستجيب بشكل صحيح: أعد المحاولة بعد لحظات.',

  // compare.dart
  "{ratio} fois moins d'impact que le moins bon ({grade})":
      'أثر أقل بـ {ratio} مرة من الأسوأ ({grade})',
  'Notes proches : tous notés {grade}':
      'تقييمات متقاربة: كلها {grade}',
  'Note {best}, contre {worst} pour le moins bon':
      'التقييم {best}، مقابل {worst} للأسوأ',

  // config.dart
  'Tarif à définir':
      'السعر قيد التحديد',

  // contribute.dart
  "Recopiez la composition écrite sur l'étiquette.":
      'انسخ التركيب المكتوب على الملصق.',
  'Indiquez aussi les matières (coton, polyester…).':
      'أضف أيضًا أسماء المواد (coton، polyester…).',
  'Ajoutez le signe % après chaque pourcentage.':
      'أضف علامة % بعد كل نسبة مئوية.',
  'Les pourcentages font {n} % au lieu de 100 %.':
      'مجموع النسب {n} % بدلًا من 100 %.',

  // l10n.dart
  'Réessayer':
      'إعادة المحاولة',

  // native_ar.dart
  "Caméra : la note des vêtements s'affiche en 3D sur leur code-barres":
      'الكاميرا: يظهر تقييم القطع بالأبعاد الثلاثة فوق رموزها الشريطية',
  'Fermer la réalité augmentée':
      'إغلاق الواقع المعزز',
  'Réalité augmentée 3D':
      'الواقع المعزز ثلاثي الأبعاد',
  'Démarrage de la réalité augmentée…':
      'جارٍ تشغيل الواقع المعزز…',
  "La réalité augmentée 3D n'est pas disponible sur cet appareil.":
      'الواقع المعزز ثلاثي الأبعاد غير متاح على هذا الجهاز.',
  "Ce téléphone n'est pas compatible avec la réalité augmentée 3D. Le scanner classique reste disponible.":
      'هذا الهاتف غير متوافق مع الواقع المعزز ثلاثي الأبعاد. الماسح العادي يبقى متاحًا.',
  'La réalité augmentée 3D a besoin de « Services Google Play pour la RA » (gratuit, sur le Play Store).':
      'يحتاج الواقع المعزز ثلاثي الأبعاد إلى « خدمات Google Play للواقع المعزز » (مجانية، على Play Store).',
  'Installez ou mettez à jour « Services Google Play pour la RA » depuis le Play Store, puis réessayez.':
      'ثبّت « خدمات Google Play للواقع المعزز » أو حدّثها من Play Store، ثم أعد المحاولة.',
  'Mettez à jour VeriTrace pour utiliser la réalité augmentée 3D.':
      'حدّث VeriTrace لاستعمال الواقع المعزز ثلاثي الأبعاد.',
  "La réalité augmentée 3D n'a pas pu démarrer sur ce téléphone.":
      'تعذّر تشغيل الواقع المعزز ثلاثي الأبعاد على هذا الهاتف.',
  'La caméra est occupée ou indisponible : réessayez dans un instant.':
      'الكاميرا مشغولة أو غير متاحة: أعد المحاولة بعد لحظات.',
  "Autorisez l'accès à la caméra pour utiliser la réalité augmentée.":
      'اسمح بالوصول إلى الكاميرا لاستعمال الواقع المعزز.',
  'Caméra indisponible : fermez puis rouvrez la réalité augmentée.':
      'الكاميرا غير متاحة: أغلق الواقع المعزز ثم أعد فتحه.',
  "Pas assez de lumière : rapprochez-vous d'un éclairage.":
      'الإضاءة غير كافية: اقترب من مصدر ضوء.',
  'Bougez le téléphone plus lentement.':
      'حرّك الهاتف ببطء أكثر.',
  'Visez des vêtements ou des étiquettes, pas un mur uni.':
      'وجِّه الكاميرا نحو الملابس أو الملصقات، لا نحو جدار أملس.',
  'Bougez doucement le téléphone de gauche à droite pour démarrer.':
      'حرّك الهاتف برفق من اليسار إلى اليمين للبدء.',
  "Visez le code-barres d'un vêtement : sa note se pose dessus en 3D.":
      'وجِّه الكاميرا نحو الرمز الشريطي لقطعة ملابس: يُثبَّت تقييمها فوقه بالأبعاد الثلاثة.',
  'Touchez une note pour ouvrir la fiche.':
      'المس تقييمًا لفتح البطاقة.',
  'Touchez une note pour ouvrir la fiche. Tournez autour : elle reste en place.':
      'المس تقييمًا لفتح البطاقة. تجوّل حوله: يبقى في مكانه.',
  'Couronne : le mieux noté ici.':
      'التاج: الأفضل تقييمًا هنا.',
  'Marque non indiquée':
      'العلامة التجارية غير مذكورة',
  'fictif':
      'وهمي',
  'Vêtement':
      'قطعة ملابس',
  'Recherche…':
      'جارٍ البحث…',
  'Code':
      'الرمز',
  'Nouveau vêtement':
      'قطعة جديدة',
  'Connexion impossible':
      'تعذّر الاتصال',
  'Le mieux noté ici':
      'الأفضل تقييمًا هنا',
  'Note {grade}':
      'التقييم {grade}',
  'Recherche de la fiche…':
      'جارٍ البحث عن البطاقة…',
  'Pas encore noté':
      'لم يُقيَّم بعد',
  'Fiche non chargée':
      'لم تُحمَّل البطاقة',
  'Coût environnemental':
      'الكلفة البيئية',
  'Climat':
      'المناخ',
  'Carbone':
      'الكربون',
  'Social':
      'اجتماعي',
  'Non évalué':
      'غير مُقيَّم',
  'Lisez son étiquette pour obtenir sa note.':
      'اقرأ ملصقها للحصول على تقييمها.',
  'Vérifiez la connexion Internet.':
      'تحقّق من الاتصال بالإنترنت.',
  'Touchez pour la fiche':
      'المس لعرض البطاقة',
  'Touchez pour continuer':
      'المس للمتابعة',
  'Touchez pour réessayer':
      'المس لإعادة المحاولة',
  'pts':
      'نقطة',
  'kg CO₂e':
      'كغ مكافئ CO₂',
  "La réalité augmentée 3D n'a pas pu s'ouvrir. Le scanner classique reste disponible.":
      'تعذّر فتح الواقع المعزز ثلاثي الأبعاد. الماسح العادي يبقى متاحًا.',

  // reliability.dart
  'Données fictives (démo)':
      'بيانات وهمية (عرض توضيحي)',
  'Transmises par la marque':
      'مقدَّمة من العلامة التجارية',
  "Relevées sur l'étiquette":
      'مقروءة من الملصق',
  'Estimation (valeurs par défaut)':
      'تقدير (قيم افتراضية)',
  'Déclarées par la marque (registre officiel)':
      'مُصرَّح بها من العلامة التجارية (السجل الرسمي)',
  'Haute':
      'عالية',
  'Moyenne':
      'متوسطة',
  'Faible|fiabilité':
      'ضعيفة',
  'Composition, poids et pays de fabrication fournis par la marque.':
      'التركيب والوزن وبلدان الصنع مقدَّمة من العلامة التجارية.',
  "Composition et pays de confection connus ; le reste suit les valeurs par défaut d'Ecobalyse.":
      'التركيب وبلد الخياطة معروفان؛ والباقي يتبع القيم الافتراضية لـ Ecobalyse.',
  "Peu d'informations connues : le calcul utilise surtout les valeurs par défaut d'Ecobalyse, volontairement pénalisantes.":
      'المعلومات المعروفة قليلة: يعتمد الحساب أساسًا على القيم الافتراضية لـ Ecobalyse، وهي متشدّدة عن قصد.',

  // sources_card.dart
  'Démo':
      'عرض توضيحي',
  'Coût officiel':
      'كلفة رسمية',
  "Impossible d'ouvrir le lien":
      'تعذّر فتح الرابط',
  "Produit fictif de démonstration : ses notes illustrent l'application et ne décrivent aucun vêtement réel. Les produits réels sont calculés avec Ecobalyse, la méthode officielle française d'affichage environnemental des vêtements.":
      'منتج وهمي للعرض التوضيحي: تقييماته توضّح طريقة عمل التطبيق ولا تصف أي قطعة حقيقية. المنتجات الحقيقية تُحسب بواسطة Ecobalyse، المنهجية الفرنسية الرسمية للإفصاح البيئي عن الملابس.',
  'Méthode':
      'المنهجية',
  'Ecobalyse, déclarée par la marque':
      'Ecobalyse، مُصرَّح بها من العلامة التجارية',
  'Ecobalyse (officielle, France)':
      'Ecobalyse (رسمية، فرنسا)',
  '{n} points':
      '{n} نقطة',
  'Impact climat':
      'الأثر المناخي',
  '{n} kg CO₂e':
      '{n} كغ مكافئ CO₂',
  'Données':
      'البيانات',
  'Fiabilité':
      'الموثوقية',
  'Déclaré le':
      'تاريخ التصريح',
  'Calculé le':
      'تاريخ الحساب',
  "Coût déclaré par la marque sur le portail officiel de l'affichage environnemental (ministère de la Transition écologique). Le registre ne publie pas la composition ni les pays de fabrication.":
      'كلفة صرّحت بها العلامة التجارية على البوابة الرسمية للإفصاح البيئي (وزارة التحول البيئي الفرنسية). لا ينشر السجل التركيب ولا بلدان الصنع.',
  'Hypothèses du calcul :':
      'افتراضات الحساب:',
  "Note environnement : coût Ecobalyse à poids égal, comparé aux vêtements du même type déclarés au registre officiel. A : parmi les 10 % les mieux placés ; E : parmi les 20 % les moins bien placés.":
      'التقييم البيئي: كلفة Ecobalyse بوزن متساوٍ، مقارنةً بقطع الملابس من النوع نفسه المُصرَّح بها في السجل الرسمي. A: ضمن أفضل 10٪؛ E: ضمن أسوأ 20٪.',
  'Voir le passeport numérique':
      'عرض الجواز الرقمي',
  'Voir la fiche officielle':
      'عرض البطاقة الرسمية',
  'Voir le calcul sur Ecobalyse':
      'عرض الحساب على Ecobalyse',
  'Voir la source des données ({date})':
      'عرض مصدر البيانات ({date})',
  'Voir la source des données':
      'عرض مصدر البيانات',
  'Source : {source}, {date}':
      'المصدر: {source}، {date}',
  'Source : {source}':
      'المصدر: {source}',

  // storage.dart
  "à l'instant":
      'الآن',
  'il y a {n} min':
      'منذ {n} دقيقة',
  'il y a {n} h':
      'منذ {n} ساعة',
  'hier':
      'أمس',
  'il y a {n} jours':
      'منذ {n} أيام',

  // theme.dart
  'Excellent choix':
      'اختيار ممتاز',
  'Parmi les mieux notés pour ce type de vêtement.':
      'من بين الأفضل تقييمًا لهذا النوع من الملابس.',
  'Bon choix':
      'اختيار جيد',
  'Impact maîtrisé, avec quelques points à améliorer.':
      'أثر مضبوط، مع بعض النقاط التي يمكن تحسينها.',
  'Impact moyen':
      'أثر متوسط',
  'Correct, mais des options mieux notées existent.':
      'مقبول، لكن توجد خيارات أفضل تقييمًا.',
  'Impact élevé':
      'أثر مرتفع',
  'Des options nettement mieux notées existent pour ce vêtement.':
      'توجد خيارات أفضل تقييمًا بوضوح لهذه القطعة.',
  'Impact très élevé':
      'أثر مرتفع جدًا',
  'À éviter : de bien meilleures options existent.':
      'يُستحسن تجنّبها: توجد خيارات أفضل بكثير.',
  'Faible':
      'ضعيف',
  'Moyen':
      'متوسط',
  'Fort':
      'قوي',
  'Oui':
      'نعم',
  'Partielle':
      'جزئيًا',
  'Non':
      'لا',
  'Non communiqué':
      'غير مُصرَّح به',
  'Non démontré':
      'غير مُثبَت',

  // widgets.dart
  'Pas de note':
      'لا يوجد تقييم',
  'Pas encore de note':
      'لا يوجد تقييم بعد',
  'Note {grade} sur une échelle de A à E':
      'التقييم {grade} على سلّم من A إلى E',
  'Exemple':
      'مثال',
  'Vérifiez votre connexion internet, puis réessayez.':
      'تحقّق من اتصالك بالإنترنت، ثم أعد المحاولة.',

  // screens/alternatives_screen.dart
  'Seconde main':
      'مستعمل',
  'Coton bio':
      'قطن عضوي',
  'Fibres recyclées':
      'ألياف معاد تدويرها',
  'Lin':
      'كتّان',
  'Fabriqué au Maroc':
      'صُنع في المغرب',
  'Alternatives':
      'البدائل',
  'Au lieu de : {name} · {brand}':
      'بدلًا من: {name} · {brand}',
  'Déjà parmi les meilleurs : aucune alternative mieux notée dans cette catégorie.':
      'ضمن الأفضل أصلًا: لا يوجد بديل أفضل تقييمًا في هذه الفئة.',
  'Scanner un autre article':
      'مسح قطعة أخرى',
  'Même usage, meilleur impact.':
      'الاستعمال نفسه، بأثر أفضل.',
  'Friperie solidaire':
      'متجر تضامني للملابس المستعملة',
  'Registre officiel':
      'السجل الرسمي',
  'Fabriqué : {country}':
      'بلد الصنع: {country}',
  'Premium activé (simulation de démo)':
      'تمّ تفعيل Premium (محاكاة للعرض التوضيحي)',
  'Comparez toutes les options mieux notées, en ligne et près de chez vous.':
      'قارن كل الخيارات الأفضل تقييمًا، عبر الإنترنت وبالقرب منك.',
  'Débloquer avec Premium':
      'فتح البدائل مع Premium',
  'Toutes les alternatives pour chaque article':
      'كل البدائل لكل قطعة',
  'Historique complet de vos scans':
      'السجل الكامل لعمليات المسح',
  'Alertes sur vos marques préférées':
      'تنبيهات حول علاماتك التجارية المفضّلة',
  "Commencer l'essai gratuit":
      'بدء التجربة المجانية',
  'Plus tard':
      'لاحقًا',
  "Démo : aucun paiement n'est demandé.":
      'عرض توضيحي: لا يُطلب أي أداء.',
  '{n} autre alternative':
      'بدائل أخرى: {n}',
  '{n} autres alternatives':
      'بدائل أخرى: {n}',

  // screens/ar_scan_screen.dart
  'Comparaison du rayon':
      'مقارنة الرفّ',
  'Articles scannés pendant votre visite, du mieux au moins bien noté.':
      'القطع التي مسحتها أثناء زيارتك، من الأفضل تقييمًا إلى الأقل.',
  '{n} pts':
      '{n} نقطة',
  'Vider la comparaison':
      'إفراغ المقارنة',
  'Continuer à scanner':
      'متابعة المسح',
  'Retour':
      'رجوع',
  "Visez l'étiquette":
      'وجِّه الكاميرا نحو الملصق',
  'Éteindre la lampe':
      'إطفاء المصباح',
  'Allumer la lampe':
      'تشغيل المصباح',
  'Visez un ou plusieurs codes-barres : la note apparaît dessus. Bouton 3D : elle reste posée sur le vêtement.':
      'وجِّه الكاميرا نحو رمز شريطي أو أكثر: يظهر التقييم فوقها. زر 3D: يبقى التقييم مثبّتًا على القطعة.',
  'Visez un ou plusieurs codes-barres : la note apparaît dessus, et le meilleur du rayon reçoit une couronne.':
      'وجِّه الكاميرا نحو رمز شريطي أو أكثر: يظهر التقييم فوقها، ويحصل أفضلها في الرفّ على تاج.',
  'Analyse du code…':
      'جارٍ تحليل الرمز…',
  'EAN {code}':
      'EAN {code}',
  '{brand} · touchez pour la fiche enrichie':
      '{brand} · المس لعرض البطاقة المفصّلة',
  'Article pas encore référencé':
      'قطعة غير مُدرَجة بعد',
  'Touchez pour le signaler':
      'المس للإبلاغ عنها',
  'Le meilleur ici : {name} ({grade})':
      'الأفضل هنا: {name} ({grade})',
  'Comparer {n}':
      'مقارنة {n}',
  "Recherche d'alternatives…":
      'جارٍ البحث عن بدائل…',
  "Pas d'alternative mieux notée connue":
      'لا يوجد بديل معروف أفضل تقييمًا',
  'Mieux noté : {name} ({grade})':
      'أفضل تقييمًا: {name} ({grade})',
  '{n} alternatives':
      'البدائل: {n}',
  'Fermer la fiche':
      'إغلاق البطاقة',
  'Composition et pays non communiqués':
      'التركيب والبلد غير مُصرَّح بهما',
  'Fiche complète':
      'البطاقة الكاملة',
  'Analyse…':
      'جارٍ التحليل…',
  '{n} pts · note VeriTrace {grade}':
      '{n} نقطة · تقييم VeriTrace {grade}',
  'Carbone {carbon} · Social {social}':
      'الكربون {carbon} · اجتماعي {social}',
  'non évaluée':
      'غير مُقيَّم',
  'Non référencé':
      'غير مُدرَج',
  'Hors connexion':
      'غير متصل',
  'Le meilleur des articles scannés':
      'الأفضل بين القطع الممسوحة',
  'Analyse en cours':
      'جارٍ التحليل',
  '{name}, note {grade}. Touchez pour voir la fiche':
      '{name}، التقييم {grade}. المس لعرض البطاقة',
  'Article non référencé. Touchez pour le signaler':
      'قطعة غير مُدرَجة. المس للإبلاغ عنها',
  'Hors connexion. Touchez pour réessayer':
      'غير متصل. المس لإعادة المحاولة',
  'Réalité augmentée 3D : la note reste posée sur le vêtement':
      'الواقع المعزز ثلاثي الأبعاد: يبقى التقييم مثبّتًا على القطعة',
  "L'accès à la caméra est refusé. Autorisez-le dans les réglages du téléphone, ou saisissez le code à la main.":
      'تمّ رفض الوصول إلى الكاميرا. اسمح به في إعدادات الهاتف، أو أدخل الرمز يدويًا.',
  'Aucune caméra disponible sur cet appareil. Saisissez le code à la main.':
      'لا توجد كاميرا متاحة على هذا الجهاز. أدخل الرمز يدويًا.',
  'Impossible de démarrer la caméra. Réessayez ou saisissez le code à la main.':
      'تعذّر تشغيل الكاميرا. أعد المحاولة أو أدخل الرمز يدويًا.',

  // screens/contribute_screen.dart
  "La photo n'a pas pu être prise. Réessayez.":
      'تعذّر التقاط الصورة. أعد المحاولة.',
  'Ajouter ce vêtement':
      'إضافة هذه القطعة',
  "Recopiez l'étiquette cousue à l'intérieur du vêtement. Nous vérifions chaque ajout avant de le noter.":
      'انسخ معلومات الملصق المخيط داخل القطعة. نتحقّق من كل إضافة قبل تقييمها.',
  'Marque':
      'العلامة التجارية',
  'Ex. Defacto, Zara, Marwa…':
      'مثال: Defacto، Zara، Marwa…',
  'Indiquez la marque.':
      'أدخل العلامة التجارية.',
  'Nom du vêtement':
      'اسم القطعة',
  'Ex. T-shirt col rond noir':
      'مثال: تي شيرت أسود بياقة دائرية',
  'Donnez un nom au vêtement.':
      'أعطِ القطعة اسمًا.',
  'Catégorie':
      'الفئة',
  'Choisir…':
      'اختر…',
  'Choisissez une catégorie.':
      'اختر فئة.',
  'Composition':
      'التركيب',
  'Ex. 60 % coton, 40 % polyester':
      '60 % coton, 40 % polyester',
  "Telle qu'écrite sur l'étiquette, avec les pourcentages.":
      'كما هو مكتوب على الملصق، مع النسب المئوية.',
  'Fabriqué en (facultatif)':
      'بلد الصنع (اختياري)',
  'Ex. Maroc, Turquie, Bangladesh…':
      'مثال: Maroc، Turquie، Bangladesh…',
  "Photo de l'étiquette (facultatif)":
      'صورة الملصق (اختياري)',
  'Reprendre':
      'إعادة الالتقاط',
  "Prendre l'étiquette en photo":
      'تصوير الملصق',
  'Elle sert uniquement à vérifier votre saisie.':
      'تُستعمل فقط للتحقّق من إدخالك.',
  "L'envoi a échoué. Vérifiez votre connexion puis réessayez.":
      'تعذّر الإرسال. تحقّق من اتصالك ثم أعد المحاولة.',
  'Envoi…':
      'جارٍ الإرسال…',
  'Envoyer pour vérification':
      'إرسال للتحقّق',
  "Merci, c'est envoyé !":
      'شكرًا، تمّ الإرسال!',
  "L'équipe VeriTrace vérifie votre ajout, puis le vêtement est noté avec Ecobalyse, la méthode officielle française.":
      'يتحقّق فريق VeriTrace من إضافتك، ثم تُقيَّم القطعة بواسطة Ecobalyse، المنهجية الفرنسية الرسمية.',

  // screens/details_screen.dart
  'Comprendre la note':
      'فهم التقييم',
  'Carbone · {grade}':
      'الكربون · {grade}',
  'Social · {grade}':
      'اجتماعي · {grade}',
  'Voir les alternatives':
      'عرض البدائل',
  "D'où vient le coût environnemental de ce vêtement (registre officiel) :":
      'من أين تأتي الكلفة البيئية لهذه القطعة (السجل الرسمي):',
  "D'où vient l'impact climat de ce vêtement :":
      'من أين يأتي الأثر المناخي لهذه القطعة:',
  "D'où vient l'impact climat de ce vêtement (calcul Ecobalyse) :":
      'من أين يأتي الأثر المناخي لهذه القطعة (حساب Ecobalyse):',
  "Évaluation incomplète : tous les critères n'ont pas encore été vérifiés, la note sociale n'est donc pas attribuée. La note globale reflète uniquement l'environnement.":
      'تقييم غير مكتمل: لم يُتحقَّق بعدُ من كل المعايير، لذلك لا يُمنح التقييم الاجتماعي. التقييم العام يعكس الجانب البيئي فقط.',
  "Note sociale non évaluée : aucune source publique vérifiable pour cette marque. La note globale reflète donc uniquement l'environnement.":
      'التقييم الاجتماعي غير مُنجَز: لا يوجد مصدر عمومي يمكن التحقق منه لهذه العلامة التجارية. لذلك يعكس التقييم العام الجانب البيئي فقط.',
  "Données d'exemple, fictives et sans source : elles ne suivent pas la méthode de la note sociale sourcée.":
      'بيانات مثال، وهمية وبدون مصدر: لا تتبع منهجية التقييم الاجتماعي المستند إلى المصادر.',
  'barème':
      'سُلَّم التنقيط',
  '{points} points sur {max}':
      '{points} من {max}',
  "Note sociale VeriTrace : {total} d'après les preuves publiques ci-dessus. Elle mesure ce que la marque rend public et vérifiable (usines, contrôles, certification), pas les conditions de travail dans chaque usine. « Non démontré » : aucune preuve trouvée par VeriTrace.":
      'تقييم VeriTrace الاجتماعي: {total} بناءً على الأدلة العمومية أعلاه. يقيس ما تجعله العلامة التجارية عموميًا وقابلًا للتحقق (المصانع، المراقبة، الشهادات)، وليس ظروف العمل في كل مصنع. « غير مُثبَت »: لم تجد VeriTrace أي دليل.',
  'vérifié le {date}':
      'تم التحقق في {date}',
  'Source :':
      'المصدر:',
  'voir la source':
      'عرض المصدر',
  'Engagements sociaux de la marque {brand} :':
      'الالتزامات الاجتماعية للعلامة التجارية {brand}:',
  'Une preuve manque ? Écrivez-nous':
      'هل ينقص دليل؟ راسلونا',

  // screens/label_live_screen.dart
  "L'accès à la caméra est refusé. Autorisez-le dans les réglages du téléphone, ou prenez une photo de l'étiquette.":
      'تمّ رفض الوصول إلى الكاميرا. اسمح به في إعدادات الهاتف، أو التقط صورة للملصق.',
  "Impossible de démarrer la caméra. Prenez plutôt une photo de l'étiquette.":
      'تعذّر تشغيل الكاميرا. التقط صورة للملصق بدلًا من ذلك.',
  "Aucune caméra disponible. Prenez plutôt une photo de l'étiquette.":
      'لا توجد كاميرا متاحة. التقط صورة للملصق بدلًا من ذلك.',
  "Lecture imprécise : rapprochez-vous et gardez l'étiquette bien à plat.":
      'قراءة غير دقيقة: اقترب واحرص على أن يبقى الملصق مسطّحًا.',
  'Pas de connexion : vérifiez Internet puis réessayez.':
      'لا يوجد اتصال: تحقّق من الإنترنت ثم أعد المحاولة.',
  'Ouverture de la caméra…':
      'جارٍ فتح الكاميرا…',
  'Composition lue : calcul de la note avec Ecobalyse…':
      'تمّت قراءة التركيب: جارٍ حساب التقييم بواسطة Ecobalyse…',
  'Composition lue : {composition}. Choisissez le type de vêtement.':
      'التركيب المقروء: {composition}. اختر نوع القطعة.',
  "Lecture en cours… Rapprochez-vous et gardez l'étiquette nette.":
      'جارٍ القراءة… اقترب واحرص على أن يبقى الملصق واضحًا.',
  "Visez l'étiquette de composition (ex. « 100 % coton »). La note s'affiche dessus.":
      'وجِّه الكاميرا نحو ملصق التركيب (مثال: « 100 % coton »). يظهر التقييم فوقه.',
  'Calcul de la note…':
      'جارٍ حساب التقييم…',
  "Visez l'étiquette cousue":
      'وجِّه الكاميرا نحو الملصق المخيط',
  'touchez pour voir la fiche':
      'المس لعرض البطاقة',
  'Lire une autre étiquette':
      'قراءة ملصق آخر',
  'Erreur inattendue.':
      'خطأ غير متوقع.',
  'Prendre une photo à la place':
      'التقاط صورة بدلًا من ذلك',

  // screens/label_scan_screen.dart
  'La lecture du texte a échoué : reprenez la photo.':
      'فشلت قراءة النص: أعد التقاط الصورة.',
  "Lire l'étiquette":
      'قراءة الملصق',
  "Photographiez l'étiquette cousue à l'intérieur du vêtement : celle qui indique la composition (ex. « 100 % coton ») et le pays de fabrication. Le texte est lu sur votre téléphone, puis la note est calculée avec la méthode officielle Ecobalyse.":
      'صوِّر الملصق المخيط داخل القطعة: الذي يبيّن التركيب (مثال: « 100 % coton ») وبلد الصنع. يُقرأ النص على هاتفك، ثم يُحسب التقييم بالمنهجية الرسمية Ecobalyse.',
  "Viser l'étiquette en direct (sans photo)":
      'توجيه الكاميرا نحو الملصق مباشرةً (بدون صورة)',
  "Photo de l'étiquette":
      'صورة الملصق',
  'Reprendre la photo':
      'إعادة التقاط الصورة',
  'Prendre la photo':
      'التقاط الصورة',
  "Ajoutez la photo de l'étiquette.":
      'أضف صورة الملصق.',
  'Type de vêtement':
      'نوع القطعة',
  'Choisissez le type de vêtement.':
      'اختر نوع القطعة.',
  'Marque (facultatif)':
      'العلامة التجارية (اختياري)',
  'Ex. Defacto, LC Waikiki, Marwa…':
      'مثال: Defacto، LC Waikiki، Marwa…',
  'Saisir la composition à la main':
      'إدخال التركيب يدويًا',
  "Conseils : étiquette bien à plat, sans reflet, texte net. Le résultat est une estimation : poids et lieux de tissage ou de teinture ne sont pas écrits sur l'étiquette, Ecobalyse applique alors ses valeurs par défaut.":
      'نصائح: ملصق مسطّح جيدًا، بدون انعكاس، ونص واضح. النتيجة تقدير: الوزن وأماكن النسج أو الصباغة غير مكتوبة على الملصق، فتطبّق Ecobalyse قيمها الافتراضية.',
  "Lecture de l'étiquette…":
      'جارٍ قراءة الملصق…',
  'Calculer la note':
      'حساب التقييم',

  // screens/not_found_screen.dart
  'Résultat du scan':
      'نتيجة المسح',
  "Ce code-barres n'est pas encore dans notre base. Photographiez l'étiquette cousue du vêtement : sa note est calculée tout de suite.":
      'هذا الرمز الشريطي غير موجود بعد في قاعدة بياناتنا. صوِّر الملصق المخيط للقطعة: يُحسب تقييمها فورًا.',
  "Viser l'étiquette : note en direct":
      'وجِّه الكاميرا نحو الملصق: تقييم مباشر',
  "Ou prendre une photo de l'étiquette":
      'أو التقط صورة للملصق',
  "Ou saisir l'étiquette à la main":
      'أو أدخل معلومات الملصق يدويًا',
  'Cet article rejoint la liste des produits à analyser.':
      'تنضمّ هذه القطعة إلى قائمة المنتجات التي سيتم تحليلها.',
  'Pas le temps ? Signalez-le simplement.':
      'ليس لديك وقت؟ يكفي أن تُبلغ عنها.',
  "Celle écrite sur l'étiquette":
      'كما هي مكتوبة على الملصق',
  'Signaler cet article':
      'الإبلاغ عن هذه القطعة',

  // screens/product_screen.dart
  'Évaluation incomplète : non notée':
      'تقييم غير مكتمل: بدون تقييم',
  'Non évaluée : aucune source publique vérifiable':
      'غير مُقيَّم: لا يوجد مصدر عمومي يمكن التحقق منه',
  '{points} points sur {max} · sources publiques':
      'النقاط: {points} من {max} · مصادر عمومية',
  '{label} : {status}':
      '{label}: {status}',
  '{label} : partielle':
      '{label}: جزئيًا',
  'Engagements sociaux vérifiés':
      'التزامات اجتماعية مُتحقَّق منها',
  'Réf. {ref}':
      'المرجع {ref}',
  'Sans code-barres · étiquette lue':
      'بدون رمز شريطي · ملصق مقروء',
  'NOTE VERITRACE':
      'تقييم VeriTrace',
  'Note environnement seule : note sociale non évaluée.':
      'التقييم البيئي فقط: الجانب الاجتماعي غير مُقيَّم.',
  "points d'impact":
      'نقطة أثر',
  'Coût environnemental officiel, déclaré par la marque. La note VeriTrace le compare aux vêtements du même type.':
      'كلفة بيئية رسمية صرّحت بها العلامة التجارية. يقارنها تقييم VeriTrace بقطع الملابس من النوع نفسه.',
  'Coût environnemental estimé par VeriTrace avec Ecobalyse (non déclaré par la marque). La note VeriTrace le compare aux vêtements du même type.':
      'كلفة بيئية قدّرتها VeriTrace بواسطة Ecobalyse (لم تصرّح بها العلامة التجارية). يقارنها تقييم VeriTrace بقطع الملابس من النوع نفسه.',
  'Voir en réalité augmentée':
      'العرض بالواقع المعزز',
  'Posez le panneau 3D de la note dans la pièce':
      'ضع لوحة التقييم ثلاثية الأبعاد في الغرفة',
  'Pays de fabrication':
      'بلد الصنع',
  'Transport':
      'النقل',
  'Fiabilité des données':
      'موثوقية البيانات',
  'Voir {n} alternative mieux notée':
      'عرض البدائل الأفضل تقييمًا ({n})',
  'Voir {n} alternatives mieux notées':
      'عرض البدائل الأفضل تقييمًا ({n})',

  // screens/scan_screen.dart
  'Rapport de test envoyé au suivi des erreurs.': 'تم إرسال تقرير تجريبي إلى نظام تتبع الأخطاء.',
  'Suivi des erreurs désactivé dans cette version de développement.': 'تتبع الأخطاء معطَّل في نسخة التطوير هذه.',
  'Ce code ne ressemble pas à un code-barres valide (8, 12 ou 13 chiffres).':
      'هذا الرمز لا يبدو رمزًا شريطيًا صالحًا (8 أو 12 أو 13 رقمًا).',
  "Visez l'étiquette d'un vêtement : sa note s'affiche directement sur l'image de la caméra.":
      'وجّه الكاميرا نحو ملصق قطعة الملابس: يظهر تقييمها مباشرةً على صورة الكاميرا.',
  "Scanner l'article":
      'مسح القطعة',
  "Pas de code-barres ? Lire l'étiquette":
      'لا يوجد رمز شريطي؟ اقرأ الملصق',
  'Saisir le code à la main':
      'إدخال الرمز يدويًا',
  'DERNIERS SCANS':
      'آخر عمليات المسح',
  'EXEMPLES À TESTER':
      'أمثلة للتجربة',
  'Étiquette lue':
      'ملصق مقروء',
  '{brand} · produit fictif':
      '{brand} · منتج وهمي',
  'Réinitialiser la démo':
      'إعادة ضبط العرض التوضيحي',
  'Vous êtes fabricant ? Créez le passeport numérique de vos vêtements':
      'هل أنت مُصنِّع؟ أنشئ الجواز الرقمي لملابسك',
  'Confidentialité · Mentions légales · Conditions':
      'السرّية · الإشعارات القانونية · الشروط',
  'Code-barres':
      'الرمز الشريطي',
  'Ex. : {code}':
      'مثال: {code}',
  'Valider':
      'تأكيد',
  "Aperçu : la note du vêtement s'affiche au-dessus de son code-barres":
      'معاينة: يظهر تقييم القطعة فوق رمزها الشريطي',
  'Langue':
      'اللغة',
};

/// Catégories et pays proposés (valeurs envoyées en français au serveur), affichés en arabe.
const arValues = <String, String>{
  'T-shirt': 'تي شيرت',
  'Polo': 'قميص بولو',
  'Chemise': 'قميص',
  'Blouse': 'بلوزة',
  'Robe': 'فستان',
  'Jupe': 'تنّورة',
  'Jean': 'جينز',
  'Pantalon': 'سروال',
  'Short': 'سروال قصير',
  'Pull': 'كنزة صوفية',
  'Sweat': 'سترة رياضية',
  'Gilet': 'صدرية مفتوحة',
  'Veste': 'سترة',
  'Manteau': 'معطف',
  'Maillot de bain': 'لباس سباحة',
  'Chaussettes': 'جوارب',
  'Boxer / Slip': 'سروال داخلي',
  'Maroc': 'المغرب',
  'Turquie': 'تركيا',
  'Chine': 'الصين',
  'Bangladesh': 'بنغلاديش',
  'Inde': 'الهند',
  'Pakistan': 'باكستان',
  'Vietnam': 'فيتنام',
  'Cambodge': 'كمبوديا',
  'Tunisie': 'تونس',
  'Égypte': 'مصر',
  'Sri Lanka': 'سريلانكا',
  'Indonésie': 'إندونيسيا',
  'Myanmar': 'ميانمار',
  'Portugal': 'البرتغال',
  'Espagne': 'إسبانيا',
  'Italie': 'إيطاليا',
  'France': 'فرنسا',
};

/// Messages d'erreur du serveur (en français), traduits d'après leur code.
const arServer = <String, String>{
  'quota':
      'تمّ بلوغ الحدّ اليومي: أعد المحاولة غدًا.',
  'illisible':
      'الملصق غير مقروء: أعد التقاط الصورة عن قرب، مسطّحًا وبدون انعكاس.',
  'composition_introuvable':
      'لم يتمّ العثور على التركيب: صوِّر الملصق الذي تظهر فيه النسب المئوية (مثال: « 100 % coton »).',
  'composition_incomplete':
      'التركيب المقروء لا يساوي 100 %: أعد التقاط الصورة عن قرب، والملصق مسطّح.',
  'matiere_non_prise_en_charge':
      'إحدى المواد غير مدعومة في المنهجية الرسمية (مثل الحرير أو الجلد أو الكشمير).',
  'pas_une_etiquette':
      'هذا ليس ملصق تركيب: صوِّر الملصق المخيط داخل القطعة.',
  'categorie':
      'نوع القطعة غير مدعوم: اختر نوعًا من القائمة.',
  'image':
      'تعذّرت قراءة الصورة: أعد المحاولة.',
  'ia_indisponible':
      'القراءة الآلية غير متاحة حاليًا: أعد المحاولة لاحقًا.',
  'ecobalyse_indisponible':
      'الحساب الرسمي (Ecobalyse) لا يستجيب حاليًا: أعد المحاولة بعد لحظات.',
  'reseau':
      'لا يوجد اتصال: تحقّق من الإنترنت ثم أعد المحاولة.',
  'serveur':
      'الخدمة لا تستجيب بشكل صحيح: أعد المحاولة بعد لحظات.',
};
