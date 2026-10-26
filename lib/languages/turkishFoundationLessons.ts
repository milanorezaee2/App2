import type { LearningLesson } from './types';
import { trLesson, trSentence } from './turkishLessonKit';

/**
 * سطح پایه (Foundation) دورهٔ ترکی استانبولی — ۸ درس نخست.
 * تمرکز: سلام و معرفی، ادب کلامی، عدد و قیمت، فعل «بودن»، پرسش‌های پایه،
 * نفی و نخستین آشنایی با صداهای ترکی.
 */
export const TURKISH_FOUNDATION_LESSONS: readonly LearningLesson[] = [
  trLesson(
    'tr-l1-hello',
    'سلام و احوال‌پرسی',
    'کسی را می‌بینید و می‌خواهید سلام کنید، حالش را بپرسید و اسمتان را بگویید.',
    [
      trSentence('tr1-01', 'Merhaba!', 'سلام!', 'مِرهابا', 'merhaba', 'سلام', 'Merhaba! = سلام (در هر ساعتی از روز)'),
      trSentence('tr1-02', 'Günaydın.', 'صبح بخیر.', 'گون‌آیدِن', 'günaydın', 'صبح بخیر', 'gün (روز) + aydın (روشن) = صبح بخیر'),
      trSentence('tr1-03', 'İyi akşamlar.', 'عصر بخیر.', 'ایّی آکشاملار', 'akşam', 'عصر', 'iyi + اسم + -ler/-lar = ... بخیر'),
      trSentence('tr1-04', 'Nasılsın?', 'چطوری؟', 'ناصِلسِن', 'nasıl', 'چطور', 'nasıl + پسوند شخصی -sın = چطوری؟'),
      trSentence('tr1-05', 'İyiyim, teşekkürler.', 'خوبم، ممنون.', 'ایّی‌ییم، تشکّورلَر', 'teşekkürler', 'ممنون', 'iyi + y (میانجی) + -im = خوبم'),
      trSentence('tr1-06', 'Sen nasılsın?', 'تو چطوری؟', 'سِن ناصِلسِن', 'sen', 'تو', 'sen + nasıl + -sın = تو چطوری؟'),
      trSentence('tr1-07', 'Adın ne?', 'اسمت چیست؟', 'آدِن نِه', 'ad', 'اسم', 'ad + -ın (مالکیت «ـَت») + ne = اسمت چیست؟'),
      trSentence('tr1-08', 'Benim adım Meryem.', 'اسم من مریم است.', 'بِنیم آدِم مِریِم', 'benim', 'مالِ من', 'benim + ad + -ım = اسم من'),
    ],
    [
      { speaker: 'علی', text: 'Merhaba! Nasılsın?', fa: 'سلام! چطوری؟' },
      { speaker: 'مریم', text: 'İyiyim, teşekkürler. Sen nasılsın?', fa: 'خوبم، ممنون. تو چطوری؟' },
      { speaker: 'علی', text: 'Ben de iyiyim. Adın ne?', fa: 'من هم خوبم. اسمت چیست؟' },
      { speaker: 'مریم', text: 'Benim adım Meryem. Senin adın ne?', fa: 'اسم من مریم است. اسم تو چیست؟' },
    ],
    [
      {
        promptFa: 'برای سلام کردن در هر ساعتی از روز کدام واژه مناسب است؟',
        choices: ['Günaydın', 'Merhaba', 'İyi geceler'],
        correctIndex: 1,
        explanationFa: 'Merhaba در هر ساعتی درست است؛ Günaydın فقط صبح و İyi geceler شب بخیر است.',
      },
      {
        promptFa: 'کدام جمله یعنی «اسم من علی است»؟',
        choices: ['Adın ne?', 'Benim adım Ali.', 'Sen nasılsın?'],
        correctIndex: 1,
        explanationFa: 'Benim adım Ali یعنی «اسم من علی است».',
      },
    ],
    'در ترکی معمولاً ضمیر را می‌شود حذف کرد، چون شخص از پسوند فعل پیدا است: (Ben) iyiyim = خوبم. پسوند «ـیم» یعنی «هستم»، «ـسِن» یعنی «هستی».',
  ),

  trLesson(
    'tr-l1-introduce',
    'معرفی خود و دیگران',
    'می‌خواهید خودتان، دوستتان، ملیت و سنتان را معرفی کنید.',
    [
      trSentence('tr1-09', 'Bu benim arkadaşım.', 'این دوست من است.', 'بو بِنیم آرکاداشِم', 'arkadaş', 'دوست', 'bu + benim + اسم + -ım = این ... من است'),
      trSentence('tr1-10', 'O kim?', 'او کیست؟', 'او کیم', 'kim', 'کی', 'O kim? = او کیست؟'),
      trSentence('tr1-11', 'O benim kardeşim.', 'او خواهر/برادر من است.', 'او بِنیم کاردِشیم', 'kardeş', 'خواهر یا برادر', 'kardeş در ترکی هم خواهر و هم برادر را می‌گوید'),
      trSentence('tr1-12', 'Nerelisin?', 'اهل کجایی؟', 'نِرِلیسین', 'nere', 'کجا', 'nere + -li (اهلِ) + -sin = اهل کجایی؟'),
      trSentence('tr1-13', 'Ben İranlıyım.', 'من ایرانی هستم.', 'بِن ایرانلی‌ییم', 'İranlı', 'ایرانی', 'نام کشور + -lı/-li = اهل آن کشور'),
      trSentence('tr1-14', 'Kaç yaşındasın?', 'چند سالت است؟', 'کاچ یاشِنداسِن', 'yaş', 'سن', 'kaç yaşında + -sın = چند سالت است؟'),
      trSentence('tr1-15', 'Ben otuz yaşındayım.', 'من سی سال دارم.', 'بِن اوتوز یاشِنداییِم', 'otuz', 'سی', 'عدد + yaşında + -yım = ... سال دارم'),
      trSentence('tr1-16', 'Tanıştığımıza memnun oldum.', 'از آشنایی با شما خوشوقتم.', 'تانیشتیییمیزا مِمون اولدوم', 'tanışmak', 'آشنا شدن', 'tanıştığımıza memnun oldum = از آشنایی خوشوقتم'),
    ],
    [
      { speaker: 'کارمند', text: 'Merhaba, ben Ayşe. Siz kimsiniz?', fa: 'سلام، من عایشه هستم. شما کی هستید؟' },
      { speaker: 'مریم', text: 'Ben Meryem. Bu benim arkadaşım Ali.', fa: 'من مریم هستم. این دوست من علی است.' },
      { speaker: 'کارمند', text: 'Nerelisiniz?', fa: 'اهل کجا هستید؟' },
      { speaker: 'علی', text: 'Ben İranlıyım, Tebrizliyim.', fa: 'من ایرانی هستم، اهل تبریز.' },
      { speaker: 'کارمند', text: 'Tanıştığımıza memnun oldum!', fa: 'از آشنایی با شما خوشوقتم!' },
    ],
    [
      {
        promptFa: 'برای پرسیدن «اهل کجایی؟» کدام جمله درست است؟',
        choices: ['Nerelisin?', 'Kaç yaşındasın?', 'O kim?'],
        correctIndex: 0,
        explanationFa: 'Nerelisin یعنی «اهل کجایی؟»؛ Kaç yaşındasın یعنی «چند سالت است؟».',
      },
      {
        promptFa: 'واژهٔ «kardeş» به چه معناست؟',
        choices: ['دوست', 'خواهر یا برادر', 'معلم'],
        correctIndex: 1,
        explanationFa: 'kardeş هم برای خواهر و هم برای برادر به کار می‌رود؛ arkadaş یعنی دوست.',
      },
    ],
    'ترکی زبان جنسیت دستوری ندارد: «o» هم «او» برای مرد است و هم برای زن. برای نسبت‌های خانوادگی معمولاً واژهٔ جدا داریم: abla (خواهر بزرگ‌تر)، ağabey (برادر بزرگ‌تر)، anne (مادر)، baba (پدر).',
  ),

  trLesson(
    'tr-l1-courtesy',
    'لطفاً، ممنون، بله و نه',
    'درخواست مؤدبانه می‌کنید، تشکر می‌کنید، عذرخواهی می‌کنید و پاسخ می‌دهید.',
    [
      trSentence('tr1-17', 'Lütfen.', 'لطفاً.', 'لوتفِن', 'lütfen', 'لطفاً', 'lütfen در پایان یا آغاز درخواست می‌آید'),
      trSentence('tr1-18', 'Çok teşekkür ederim.', 'خیلی ممنونم.', 'چوک تشکّور اِدِریم', 'teşekkür etmek', 'تشکر کردن', 'çok + teşekkür ederim = خیلی ممنونم'),
      trSentence('tr1-19', 'Bir şey değil.', 'خواهش می‌کنم / قابلی نداشت.', 'بیر شِی دِییل', 'bir şey değil', 'چیزی نیست', 'bir şey değil = پاسخ تشکر'),
      trSentence('tr1-20', 'Evet, lütfen.', 'بله، لطفاً.', 'اِوِت، لوتفِن', 'evet', 'بله', 'evet = بله'),
      trSentence('tr1-21', 'Hayır, teşekkürler.', 'نه، ممنون.', 'هایِر، تشکّورلَر', 'hayır', 'نه', 'hayır = نه'),
      trSentence('tr1-22', 'Özür dilerim.', 'عذر می‌خواهم.', 'اوزور دیلِریم', 'özür dilemek', 'عذرخواهی کردن', 'özür dilerim = عذر می‌خواهم'),
      trSentence('tr1-23', 'Affedersiniz.', 'ببخشید (خطاب مؤدبانه).', 'آففِدِرسینیز', 'affetmek', 'بخشیدن', 'affedersiniz = ببخشید (شما)'),
      trSentence('tr1-24', 'Sorun değil.', 'مشکلی نیست.', 'سورون دِییل', 'sorun', 'مشکل', 'sorun değil = مشکلی نیست'),
    ],
    [
      { speaker: 'مشتری', text: 'Affedersiniz, bir bardak su alabilir miyim?', fa: 'ببخشید، می‌توانم یک لیوان آب بگیرم؟' },
      { speaker: 'پیشخدمت', text: 'Tabii, buyurun.', fa: 'البته، بفرمایید.' },
      { speaker: 'مشتری', text: 'Çok teşekkür ederim.', fa: 'خیلی ممنونم.' },
      { speaker: 'پیشخدمت', text: 'Bir şey değil.', fa: 'خواهش می‌کنم.' },
    ],
    [
      {
        promptFa: 'کسی به شما کمک می‌کند؛ پاسخ مؤدبانه کدام است؟',
        choices: ['Çok teşekkür ederim.', 'Hayır.', 'Özür dilerim.'],
        correctIndex: 0,
        explanationFa: 'Çok teşekkür ederim یعنی «خیلی ممنونم».',
      },
      {
        promptFa: 'وقتی کسی از شما تشکر می‌کند چه می‌گویید؟',
        choices: ['Lütfen.', 'Bir şey değil.', 'Evet.'],
        correctIndex: 1,
        explanationFa: 'Bir şey değil یعنی «قابلی نداشت / خواهش می‌کنم».',
      },
    ],
    '«Affedersiniz» رسمی است و «Affedersin» دوستانه. در فروشگاه و تاکسی همین یک واژه برای جلب توجه کافی است؛ لازم نیست جملهٔ بلند بسازید.',
  ),

  trLesson(
    'tr-l1-numbers',
    'اعداد، قیمت و زمان',
    'تعداد و قیمت می‌پرسید، سفارش می‌دهید و زمان کوتاه را می‌گویید.',
    [
      trSentence('tr1-25', 'Bir kahve, lütfen.', 'یک قهوه، لطفاً.', 'بیر کاهوِه، لوتفِن', 'bir', 'یک', 'عدد + اسم + lütfen = سفارش'),
      trSentence('tr1-26', 'İki bilet lütfen.', 'دو بلیت لطفاً.', 'ایکی بیلِت لوتفِن', 'iki', 'دو', 'در ترکی بعد از عدد اسم جمع نمی‌شود'),
      trSentence('tr1-27', 'Kaç tane?', 'چند تا؟', 'کاچ تانِه', 'tane', 'دانه / واحد شمارش', 'kaç tane = چند تا'),
      trSentence('tr1-28', 'Bu kaç lira?', 'این چند لیر است؟', 'بو کاچ لیرا', 'lira', 'لیر', 'bu kaç lira? = این چند است؟'),
      trSentence('tr1-29', 'Yüz lira.', 'صد لیر.', 'یوز لیرا', 'yüz', 'صد', 'yüz = صد'),
      trSentence('tr1-30', 'Beş dakika.', 'پنج دقیقه.', 'بِش داکیکا', 'dakika', 'دقیقه', 'beş dakika = پنج دقیقه'),
      trSentence('tr1-31', 'Saat üç.', 'ساعت سه.', 'ساعت اوچ', 'saat', 'ساعت', 'saat + عدد = ساعت ...'),
      trSentence('tr1-32', 'On beş dakika sonra.', 'پانزده دقیقه بعد.', 'اون بِش داکیکا سونرا', 'sonra', 'بعد', 'مدت + sonra = ... بعد'),
    ],
    [
      { speaker: 'مشتری', text: 'Bir çay ve iki simit, lütfen.', fa: 'یک چای و دو نان سیمیت، لطفاً.' },
      { speaker: 'فروشنده', text: 'Tabii. Başka bir şey?', fa: 'البته. چیز دیگری هم می‌خواهید؟' },
      { speaker: 'مشتری', text: 'Hayır, teşekkürler. Kaç lira?', fa: 'نه، ممنون. چند لیر؟' },
      { speaker: 'فروشنده', text: 'Kırk lira.', fa: 'چهل لیر.' },
    ],
    [
      {
        promptFa: 'در ترکی «دو بلیت» درست کدام است؟',
        choices: ['İki biletler', 'İki bilet', 'İkiler bilet'],
        correctIndex: 1,
        explanationFa: 'بعد از عدد، اسم مفرد می‌آید: iki bilet.',
      },
      {
        promptFa: '«چند تا؟» چگونه پرسیده می‌شود؟',
        choices: ['Kaç tane?', 'Kaç lira?', 'Ne zaman?'],
        correctIndex: 0,
        explanationFa: 'Kaç tane یعنی «چند تا»؛ kaç lira یعنی «چند لیر».',
      },
    ],
    'اعداد پایه: bir ۱، iki ۲، üç ۳، dört ۴، beş ۵، altı ۶، yedi ۷، sekiz ۸، dokuz ۹، on ۱۰، yirmi ۲۰، otuz ۳۰، kırk ۴۰، elli ۵۰، yüz ۱۰۰. عددها همیشه پیش از اسم می‌آیند و اسم مفرد می‌ماند.',
  ),

  trLesson(
    'tr-l1-to-be',
    'هستم، هستی، است',
    'می‌خواهید بگویید چه کسی هستید، کجا هستید و حال‌تان چگونه است.',
    [
      trSentence('tr1-33', 'Ben öğrenciyim.', 'من دانش‌آموزم.', 'بِن اویْرِنجی‌ییم', 'öğrenci', 'دانش‌آموز / دانشجو', 'اسم + y + -im = من ... هستم'),
      trSentence('tr1-34', 'Sen öğretmensin.', 'تو معلمی.', 'سِن اویْرِتمِنسین', 'öğretmen', 'معلم', 'اسم + -sin = تو ... هستی'),
      trSentence('tr1-35', 'O doktor.', 'او پزشک است.', 'او دوکتور', 'doktor', 'پزشک', 'برای سوم‌شخص مفرد پسوند نمی‌آید'),
      trSentence('tr1-36', 'Biz hazırız.', 'ما آماده‌ایم.', 'بیز هازیریز', 'hazır', 'آماده', 'صفت + -ız = ما ... هستیم'),
      trSentence('tr1-37', 'Siz nerelisiniz?', 'شما اهل کجایید؟', 'سیز نِرِلیسینیز', 'siz', 'شما', 'siz + nere + -li + -siniz'),
      trSentence('tr1-38', 'Onlar evde.', 'آن‌ها در خانه‌اند.', 'اونلار اِودِه', 'ev', 'خانه', 'ev + -de = در خانه'),
      trSentence('tr1-39', 'Ben yorgunum.', 'من خسته‌ام.', 'بِن یورگونوم', 'yorgun', 'خسته', 'صفت + -um = من ... هستم'),
      trSentence('tr1-40', 'Sen haklısın.', 'حق با توست.', 'سِن هاکلیسین', 'haklı', 'حق‌به‌جانب', 'haklı + -sın = حق با توست'),
    ],
    [
      { speaker: 'معلم', text: 'Merhaba, ben Ayşe. Siz öğrenci misiniz?', fa: 'سلام، من عایشه هستم. شما دانش‌آموز هستید؟' },
      { speaker: 'دانش‌آموز', text: 'Evet, ben öğrenciyim. O da öğrenci.', fa: 'بله، من دانش‌آموزم. او هم دانش‌آموز است.' },
      { speaker: 'معلم', text: 'Neredesiniz?', fa: 'کجا هستید؟' },
      { speaker: 'دانش‌آموز', text: 'Biz sınıftayız.', fa: 'ما در کلاس هستیم.' },
    ],
    [
      {
        promptFa: 'کدام جمله درست است؟',
        choices: ['Ben öğrenci.', 'Ben öğrenciyim.', 'Ben öğrencisin.'],
        correctIndex: 1,
        explanationFa: 'برای «من» پسوند -yim می‌آید: ben öğrenciyim.',
      },
      {
        promptFa: '«ما آماده‌ایم» کدام است؟',
        choices: ['Biz hazırız.', 'Biz hazırsın.', 'Biz hazır.'],
        correctIndex: 0,
        explanationFa: 'برای «ما» پسوند -ız/-iz می‌آید: biz hazırız.',
      },
    ],
    'ترکی فعل «بودن» مستقل ندارد؛ پسوند شخصی به اسم یا صفت می‌چسبد: iyi + yim، yorgun + um، hazır + ız. اگر واژه به واکه ختم شود یک «y» میانجی می‌آید (öğrenci-y-im).',
  ),

  trLesson(
    'tr-l1-questions',
    'پرسش‌های پایه',
    'دنبال جا، زمان، دلیل و انتخاب هستید.',
    [
      trSentence('tr1-41', 'Bu ne?', 'این چیست؟', 'بو نِه', 'ne', 'چه', 'ne = چه / چیست'),
      trSentence('tr1-42', 'Bu kim?', 'این کیست؟', 'بو کیم', 'bu', 'این', 'bu = این'),
      trSentence('tr1-43', 'Tuvalet nerede?', 'دستشویی کجاست؟', 'تووالِت نِرِدِه', 'nerede', 'کجا', 'مکان + nerede? = ... کجاست؟'),
      trSentence('tr1-44', 'Ne zaman açılıyor?', 'چه ساعتی باز می‌شود؟', 'نِه زامان آچیلییور', 'ne zaman', 'چه وقت', 'ne zaman = چه وقت'),
      trSentence('tr1-45', 'Neden geç kaldın?', 'چرا دیر کردی؟', 'نِدِن گِچ کالدین', 'neden', 'چرا', 'neden = چرا'),
      trSentence('tr1-46', 'Bu nasıl çalışıyor?', 'این چطور کار می‌کند؟', 'بو ناصِل چالیشییور', 'nasıl', 'چگونه', 'nasıl = چگونه'),
      trSentence('tr1-47', 'Kaç para?', 'چند است؟', 'کاچ پارا', 'para', 'پول', 'kaç para = چند پول'),
      trSentence('tr1-48', 'Hangisi daha iyi?', 'کدام‌یک بهتر است؟', 'هانگیسی داها ایّی', 'hangisi', 'کدام‌یک', 'hangisi = کدام‌یک'),
    ],
    [
      { speaker: 'گردشگر', text: 'Affedersiniz, tuvalet nerede?', fa: 'ببخشید، دستشویی کجاست؟' },
      { speaker: 'فروشنده', text: 'Arkada, sağda.', fa: 'عقب، سمت راست.' },
      { speaker: 'گردشگر', text: 'Ne zaman kapanıyor?', fa: 'چه ساعتی بسته می‌شود؟' },
      { speaker: 'فروشنده', text: 'Saat dokuzda.', fa: 'ساعت نه.' },
    ],
    [
      {
        promptFa: 'برای پرسیدن مکان («کجاست؟») از کدام واژه استفاده می‌کنید؟',
        choices: ['ne zaman', 'nerede', 'neden'],
        correctIndex: 1,
        explanationFa: 'nerede یعنی «کجا»؛ ne zaman «چه وقت» و neden «چرا» است.',
      },
      {
        promptFa: 'کدام پرسش برای انتخاب بین دو چیز است؟',
        choices: ['Hangisi?', 'Kim?', 'Kaç para?'],
        correctIndex: 0,
        explanationFa: 'Hangisi یعنی «کدام‌یک».',
      },
    ],
    'واژهٔ پرسش در ترکی معمولاً اول جمله می‌آید: Ne zaman açılıyor? برای پرسش بله/نه، ذرهٔ پرسشی mı/mi/mu/mü به پایان جمله می‌چسبد: Öğrenci misin? (دانش‌آموزی؟)',
  ),

  trLesson(
    'tr-l1-negative',
    'نفی و «نمی‌فهمم»',
    'چیزی را نمی‌فهمید و می‌خواهید مؤدبانه بگویید که زبان ترکی‌تان کم است.',
    [
      trSentence('tr1-49', 'Anlamıyorum.', 'نمی‌فهمم.', 'آنلامییوروم', 'anlamak', 'فهمیدن', 'anla- + -mı- + -yor- + -um = نمی‌فهمم'),
      trSentence('tr1-50', 'Bilmiyorum.', 'نمی‌دانم.', 'بیلمییوروم', 'bilmek', 'دانستن', 'bil- + -mi- + -yor- + -um'),
      trSentence('tr1-51', 'Türkçe konuşmuyorum.', 'ترکی صحبت نمی‌کنم.', 'تورکچه کونوشمییوروم', 'konuşmak', 'صحبت کردن', 'konuş- + -mu- + -yor- + -um'),
      trSentence('tr1-52', 'İngilizce biliyor musunuz?', 'انگلیسی می‌دانید؟', 'اینگلیزجه بیلییور موسونوز', 'İngilizce', 'انگلیسی', 'فعل + mu + پسوند شخصی = پرسش بله/نه'),
      trSentence('tr1-53', 'Biraz Türkçe biliyorum.', 'کمی ترکی می‌دانم.', 'بیراز تورکچه بیلییوروم', 'biraz', 'کمی', 'biraz = کمی'),
      trSentence('tr1-54', 'Bu doğru değil.', 'این درست نیست.', 'بو دوغرو دِییل', 'doğru', 'درست', 'değil = نیست'),
      trSentence('tr1-55', 'Lütfen yavaş konuşun.', 'لطفاً آهسته صحبت کنید.', 'لوتفِن یاواش کونوشون', 'yavaş', 'آهسته', 'yavaş = آهسته'),
      trSentence('tr1-56', 'Tekrar eder misiniz?', 'تکرار می‌کنید؟', 'تِکرار اِدِر میسینیز', 'tekrar etmek', 'تکرار کردن', 'tekrar eder misiniz = دوباره می‌گویید؟'),
    ],
    [
      { speaker: 'مریم', text: 'Affedersiniz, anlamıyorum.', fa: 'ببخشید، نمی‌فهمم.' },
      { speaker: 'کارمند', text: 'İngilizce biliyor musunuz?', fa: 'انگلیسی می‌دانید؟' },
      { speaker: 'مریم', text: 'Biraz. Lütfen yavaş konuşun.', fa: 'کمی. لطفاً آهسته صحبت کنید.' },
      { speaker: 'کارمند', text: 'Tabii, tekrar ederim.', fa: 'البته، تکرار می‌کنم.' },
    ],
    [
      {
        promptFa: '«نمی‌فهمم» در ترکی کدام است؟',
        choices: ['Anlamıyorum.', 'Bilmiyorum.', 'Konuşmuyorum.'],
        correctIndex: 0,
        explanationFa: 'Anlamıyorum یعنی «نمی‌فهمم»؛ bilmiyorum یعنی «نمی‌دانم».',
      },
      {
        promptFa: 'برای درخواست «آهسته‌تر صحبت کنید» چه می‌گویید؟',
        choices: ['Tekrar eder misiniz?', 'Lütfen yavaş konuşun.', 'Bu doğru değil.'],
        correctIndex: 1,
        explanationFa: 'Lütfen yavaş konuşun یعنی «لطفاً آهسته صحبت کنید».',
      },
    ],
    'نفی در زمان حالِ جاری با میانجی -mı-/-mi-/-mu-/-mü- ساخته می‌شود: anlı-yor-um → anla-mı-yor-um. «değil» برای نفی اسم و صفت است: doğru değil (درست نیست).',
  ),

  trLesson(
    'tr-l1-sounds',
    'صداها و حروف ویژه',
    'حروفی مثل ç، ş، ğ، ı، ö، ü را در جمله‌های کوتاه تمرین می‌کنید.',
    [
      trSentence('tr1-57', 'Şekerli çay istiyorum.', 'چای شیرین می‌خواهم.', 'شِکِرلی چای ایستییوروم', 'çay', 'چای', 'ş = «ش»، ç = «چ»'),
      trSentence('tr1-58', 'Bu göl çok güzel.', 'این دریاچه خیلی قشنگ است.', 'بو گُل چوک گوزِل', 'göl', 'دریاچه', 'ö = «اُ» با لب گرد'),
      trSentence('tr1-59', 'Gül bahçede.', 'گل در باغ است.', 'گول باهچِدِه', 'gül', 'گل سرخ', 'ü = «او»ی باریک، مثل «ü» آلمانی'),
      trSentence('tr1-60', 'Kız kardeşim iyi.', 'خواهرم خوب است.', 'کیز کاردِشیم ایّی', 'kız', 'دختر', 'ı = «ـِ» کوتاه بدون لب گرد'),
      trSentence('tr1-61', 'Öğretmen çok iyi.', 'معلم خیلی خوب است.', 'اویْرِتمِن چوک ایّی', 'öğretmen', 'معلم', 'ğ نوشته می‌شود اما کشیده تلفظ می‌شود'),
      trSentence('tr1-62', 'Üç gün sonra.', 'سه روز بعد.', 'اوچ گون سونرا', 'gün', 'روز', 'ü + n؛ gün = روز'),
      trSentence('tr1-63', 'İki kişi, lütfen.', 'دو نفر، لطفاً.', 'ایکی کیشی، لوتفِن', 'kişi', 'نفر', 'ş = «ش»'),
      trSentence('tr1-64', 'Bu harf nasıl okunur?', 'این حرف چطور خوانده می‌شود؟', 'بو هارف ناصِل اوکونور', 'harf', 'حرف', 'harf = حرف الفبا'),
    ],
    [
      { speaker: 'مریم', text: 'Bu harf nasıl okunur?', fa: 'این حرف چطور خوانده می‌شود؟' },
      { speaker: 'معلم', text: 'Ş harfi «ş» okunur, ç harfi «ç».', fa: 'حرف Ş «ش» و Ç «چ» خوانده می‌شود.' },
      { speaker: 'مریم', text: 'Anladım, teşekkürler!', fa: 'فهمیدم، ممنون!' },
      { speaker: 'معلم', text: 'Çok iyi! Yarın tekrar ederiz.', fa: 'خیلی خوب! فردا دوباره تمرین می‌کنیم.' },
    ],
    [
      {
        promptFa: 'حرف «ş» در ترکی چه صدایی می‌دهد؟',
        choices: ['س', 'ش', 'چ'],
        correctIndex: 1,
        explanationFa: 'ş = ش، ç = چ و s = س.',
      },
      {
        promptFa: 'کدام واژه یعنی «روز»؟',
        choices: ['gün', 'gül', 'göl'],
        correctIndex: 0,
        explanationFa: 'gün روز، gül گل و göl دریاچه است.',
      },
    ],
    'الفبای ترکی استانبولی ۲۹ حرف دارد و کاملاً آوایی است. حروف مهم برای فارسی‌زبان: ç=چ، ş=ش، ğ کشیده، ı شبیه «ـِ»، ö و ü با لب گرد. قانون هماهنگی واکه‌ها تعیین می‌کند پسوند با کدام واکه بیاید (‑ler/‑lar، ‑de/‑da).',
  ),
];
