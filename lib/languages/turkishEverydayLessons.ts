import type { LearningLesson } from './types';
import { trLesson, trSentence } from './turkishLessonKit';

/**
 * سطح روزمره (Everyday) — ترکی برای گفت‌وگوی واقعی.
 * زمان حال جاری، گذشته، آینده، مقایسه، نظر، آب‌وهوا، کار و خانه.
 */
export const TURKISH_EVERYDAY_LESSONS: readonly LearningLesson[] = [
  trLesson(
    'tr-l3-present',
    'زمان حال جاری: همین حالا چه می‌کنی؟',
    'از کارهای همین لحظه حرف می‌زنید: مطالعه، کار، قهوه و انتظار.',
    [
      trSentence('tr3-01', 'Şimdi çalışıyorum.', 'الان کار می‌کنم.', 'شیمدی چالیشییوروم', 'çalışmak', 'کار کردن', 'çalış- + -ı- + -yor- + -um'),
      trSentence('tr3-02', 'Ne yapıyorsun?', 'چه می‌کنی؟', 'نِه یاپییورسون', 'yapmak', 'انجام دادن', 'ne + yap-ı-yor-sun'),
      trSentence('tr3-03', 'Kitap okuyorum.', 'کتاب می‌خوانم.', 'کیتاپ اوکوییوروم', 'okumak', 'خواندن', 'oku- + -yor- + -um'),
      trSentence('tr3-04', 'Kahve içiyoruz.', 'قهوه می‌نوشیم.', 'کاهوِه ایچییوروز', 'içmek', 'نوشیدن', 'kahve içiyoruz = قهوه می‌نوشیم'),
      trSentence('tr3-05', 'Nereye gidiyorsun?', 'کجا می‌روی؟', 'نِرِیِه گیدییورسون', 'nereye', 'به کجا', 'nereye = به کجا'),
      trSentence('tr3-06', 'Eve gidiyorum.', 'به خانه می‌روم.', 'اِوِه گیدییوروم', 'ev', 'خانه', 'ev + -e = به خانه'),
      trSentence('tr3-07', 'Telefonla konuşuyor.', 'با تلفن صحبت می‌کند.', 'تِلِفونلا کونوشویور', 'telefon', 'تلفن', 'telefon + -la = با تلفن'),
      trSentence('tr3-08', 'Seni bekliyorum.', 'منتظرت هستم.', 'سِنی بِکلییوروم', 'beklemek', 'منتظر ماندن', 'seni = تو را'),
    ],
    [
      { speaker: 'علی', text: 'Merhaba, ne yapıyorsun?', fa: 'سلام، چه می‌کنی؟' },
      { speaker: 'مریم', text: 'Kitap okuyorum. Sen?', fa: 'کتاب می‌خوانم. تو؟' },
      { speaker: 'علی', text: 'Ben kahve içiyorum ve seni bekliyorum.', fa: 'من قهوه می‌نوشم و منتظرت هستم.' },
      { speaker: 'مریم', text: 'Tamam, eve gidiyorum.', fa: 'باشه، به خانه می‌روم.' },
    ],
    [
      {
        promptFa: 'زمان حال جاری با کدام پسوند ساخته می‌شود؟',
        choices: ['-yor', '-di', '-ecek'],
        correctIndex: 0,
        explanationFa: 'پسوند -yor زمان حال جاری است: gidiyorum (می‌روم).',
      },
      {
        promptFa: '«قهوه می‌نوشیم» کدام است؟',
        choices: ['Kahve içiyorum.', 'Kahve içiyoruz.', 'Kahve içtin.'],
        correctIndex: 1,
        explanationFa: 'پسوند -uz برای «ما» است: içiyoruz.',
      },
    ],
    'ریشه + -yor + پسوند شخصی = حال جاری: oku-yor-um، oku-yor-sun، oku-yor. اگر ریشه به واکه ختم شود یک «-u/-ı/-ü/-i» میانجی می‌آید: oku → okuyorum.',
  ),

  trLesson(
    'tr-l3-past',
    'گذشته: دیروز چه کار کردی؟',
    'دربارهٔ کارهای دیروز، تجربهٔ کوتاه و روزی که گذشت حرف می‌زنید.',
    [
      trSentence('tr3-09', 'Dün sinemaya gittim.', 'دیروز به سینما رفتم.', 'دون سینِمایا گیتیم', 'dün', 'دیروز', 'git- + -ti- + -m = رفتم'),
      trSentence('tr3-10', 'Ne yaptın?', 'چه کار کردی؟', 'نِه یاپتین', 'yapmak', 'انجام دادن', 'yap-tı-n = کردی'),
      trSentence('tr3-11', 'Kitap okudum.', 'کتاب خواندم.', 'کیتاپ اوکودوم', 'okumak', 'خواندن', 'oku-du-m = خواندم'),
      trSentence('tr3-12', 'Çok güzel bir gündü.', 'روز خیلی خوبی بود.', 'چوک گوزل بیر گوندو', 'gündü', 'روز بود', 'gün + -dü = روز بود'),
      trSentence('tr3-13', 'Orada değildim.', 'آن‌جا نبودم.', 'اورادا دِییلدیم', 'değildim', 'نبودم', 'değil + -dim = نبودم'),
      trSentence('tr3-14', 'Nasıldı?', 'چطور بود؟', 'ناصیلدی', 'nasıldı', 'چطور بود', 'nasıl + -dı = چطور بود'),
      trSentence('tr3-15', 'Erken geldim.', 'زود آمدم.', 'اِرکِن گِلدیم', 'erken', 'زود', 'gel-dim = آمدم'),
      trSentence('tr3-16', 'Geç kaldım.', 'دیر کردم.', 'گِچ کالدیم', 'geç', 'دیر', 'geç kalmak = دیر شدن'),
    ],
    [
      { speaker: 'مریم', text: 'Dün ne yaptın?', fa: 'دیروز چه کار کردی؟' },
      { speaker: 'علی', text: 'Sinemaya gittim. Çok güzel bir filmdi.', fa: 'به سینما رفتم. فیلم خیلی خوبی بود.' },
      { speaker: 'مریم', text: 'Nasıldı?', fa: 'چطور بود؟' },
      { speaker: 'علی', text: 'Harikaydı! Ama geç kaldım.', fa: 'عالی بود! ولی دیر کردم.' },
    ],
    [
      {
        promptFa: '«دیروز به سینما رفتم» کدام است؟',
        choices: ['Dün sinemaya gidiyorum.', 'Dün sinemaya gittim.', 'Dün sinemaya gideceğim.'],
        correctIndex: 1,
        explanationFa: 'gittim زمان گذشتهٔ «من» است.',
      },
      {
        promptFa: '«دیر کردم» در ترکی چه می‌شود؟',
        choices: ['Erken geldim.', 'Geç kaldım.', 'Çok güzeldi.'],
        correctIndex: 1,
        explanationFa: 'geç = دیر، kaldım = ماندم/شدم؛ geç kaldım یعنی دیر کردم.',
      },
    ],
    'پسوند گذشته -di/-dı/-du/-dü با هماهنگی واکه‌ها می‌آید: gel-dim (آمدم)، git-tim (رفتم)، oku-dum (خواندم). برای «بود» اسم یا صفت هم -dı می‌گیرد: güzel-di (خوب بود).',
  ),

  trLesson(
    'tr-l3-future',
    'آینده: فردا چه خواهی کرد؟',
    'برنامه و قصد آینده را می‌گویید، قرار می‌گذارید و احتمال را بیان می‌کنید.',
    [
      trSentence('tr3-17', 'Yarın çalışacağım.', 'فردا کار خواهم کرد.', 'یارین چالیشاجاآم', 'çalışmak', 'کار کردن', 'çalış- + -acak- + -ım = کار خواهم کرد'),
      trSentence('tr3-18', 'Ne yapacaksın?', 'چه خواهی کرد؟', 'نِه یاپاجاکسین', 'yapmak', 'انجام دادن', 'yap-acak-sın = خواهی کرد'),
      trSentence('tr3-19', 'Sana telefon edeceğim.', 'به تو تلفن خواهم زد.', 'سانا تِلِفون اِدِجِییم', 'etmek', 'کردن', 'edecek + -im = خواهم زد'),
      trSentence('tr3-20', 'Haftaya tatile gideceğiz.', 'هفتهٔ بعد به تعطیلات می‌رویم.', 'هافتایا تاتیله گیدِجِییز', 'tatil', 'تعطیلات', 'haftaya = هفتهٔ بعد'),
      trSentence('tr3-21', 'Saat üçte gelecek.', 'ساعت سه خواهد آمد.', 'ساعت اوچتِ گِلِجِک', 'gelmek', 'آمدن', 'gel- + -ecek = خواهد آمد'),
      trSentence('tr3-22', 'Planın var mı?', 'برنامه داری؟', 'پلانین وار می', 'plan', 'برنامه', 'plan + -ın = برنامه‌ات'),
      trSentence('tr3-23', 'Belki gelirim.', 'شاید بیایم.', 'بِلکی گِلیریم', 'belki', 'شاید', 'belki = شاید؛ gelirim = می‌آیم'),
      trSentence('tr3-24', 'Görüşürüz!', 'می‌بینمت!', 'گوروشوروز', 'görüşmek', 'دیدار کردن', 'görüşürüz = همدیگر را می‌بینیم'),
    ],
    [
      { speaker: 'مریم', text: 'Yarın ne yapacaksın?', fa: 'فردا چه خواهی کرد؟' },
      { speaker: 'علی', text: 'Yarın çalışacağım. Sonra sana telefon edeceğim.', fa: 'فردا کار خواهم کرد. بعد به تو زنگ می‌زنم.' },
      { speaker: 'مریم', text: 'Haftaya tatile gideceğiz, planın var mı?', fa: 'هفتهٔ بعد به تعطیلات می‌رویم، برنامه داری؟' },
      { speaker: 'علی', text: 'Belki gelirim. Görüşürüz!', fa: 'شاید بیایم. می‌بینمت!' },
    ],
    [
      {
        promptFa: '«فردا کار خواهم کرد» کدام است؟',
        choices: ['Yarın çalıştım.', 'Yarın çalışacağım.', 'Yarın çalışıyorum.'],
        correctIndex: 1,
        explanationFa: 'پسوند -acak/-ecek آینده را می‌سازد.',
      },
      {
        promptFa: 'واژهٔ «belki» چه معنایی دارد؟',
        choices: ['حتماً', 'شاید', 'هرگز'],
        correctIndex: 1,
        explanationFa: 'belki = شاید.',
      },
    ],
    'آینده با -acak/-ecek ساخته می‌شود و «k» پیش از پسوند شخصی به «ğ» تبدیل می‌شود: yapacak + ım → yapacağım. برای احتمال نزدیک، زمان سادهٔ -r (gelirim = می‌آیم) طبیعی‌تر است.',
  ),

  trLesson(
    'tr-l3-comparisons',
    'مقایسه: بهتر، ارزان‌تر، زیباترین',
    'دو چیز را مقایسه می‌کنید و بهترین گزینه را انتخاب می‌کنید.',
    [
      trSentence('tr3-25', 'Bu araba daha hızlı.', 'این ماشین سریع‌تر است.', 'بو آرابا داها هیزلی', 'daha', 'بیشتر / -تر', 'daha + صفت = صفت‌تر'),
      trSentence('tr3-26', 'En güzel şehir İstanbul.', 'زیباترین شهر استانبول است.', 'اِن گوزل شِهیر ایستانبول', 'en', 'ترین', 'en + صفت = صفت‌ترین'),
      trSentence('tr3-27', 'Ben senden daha uzunum.', 'من از تو بلندترم.', 'بِن سِندِن داها اوزونوم', 'uzun', 'بلند', 'senden = از تو'),
      trSentence('tr3-28', 'Bu diğerinden daha ucuz.', 'این از آن یکی ارزان‌تر است.', 'بو دییِرین‌دِن داها اوجوز', 'ucuz', 'ارزان', 'diğeri = آن یکی'),
      trSentence('tr3-29', 'Hangisi daha iyi?', 'کدام بهتر است؟', 'هانگیسی داها ایّی', 'hangi', 'کدام', 'hangisi daha iyi = کدام بهتر'),
      trSentence('tr3-30', 'Çok daha kolay.', 'خیلی آسان‌تر.', 'چوک داها کولای', 'kolay', 'آسان', 'çok daha = خیلی بیشتر'),
      trSentence('tr3-31', 'En iyi cevap bu.', 'بهترین جواب این است.', 'اِن ایّی جِواپ بو', 'cevap', 'جواب', 'en iyi = بهترین'),
      trSentence('tr3-32', 'Biraz daha yavaş.', 'کمی آهسته‌تر.', 'بیراز داها یاواش', 'yavaş', 'آهسته', 'biraz daha = کمی بیشتر'),
    ],
    [
      { speaker: 'مریم', text: 'Hangisi daha iyi? Bu mu, o mu?', fa: 'کدام بهتر است؟ این یا آن؟' },
      { speaker: 'علی', text: 'Bu diğerinden daha ucuz ve daha güzel.', fa: 'این از آن یکی ارزان‌تر و قشنگ‌تر است.' },
      { speaker: 'مریم', text: 'En iyi cevap bu!', fa: 'بهترین جواب همین است!' },
      { speaker: 'علی', text: 'O zaman bunu alalım.', fa: 'پس بیا این را بخریم.' },
    ],
    [
      {
        promptFa: 'برای ساختن صفت برتر («-تر») از کدام واژه استفاده می‌شود؟',
        choices: ['en', 'daha', 'çok'],
        correctIndex: 1,
        explanationFa: 'daha + صفت = صفت‌تر؛ en + صفت = صفت‌ترین.',
      },
      {
        promptFa: '«از تو» در جملهٔ مقایسه‌ای کدام است؟',
        choices: ['sana', 'senden', 'seni'],
        correctIndex: 1,
        explanationFa: 'senden = از تو (پسوند -den/-dan).',
      },
    ],
    'مقایسه دو مرحله دارد: daha güzel (قشنگ‌تر) و en güzel (قشنگ‌ترین). برای «از ...» پسوند -den/-dan به کار می‌رود: senden daha uzun (از تو بلندتر).',
  ),

  trLesson(
    'tr-l3-opinions',
    'نظر، علاقه و موافقت',
    'می‌گویید چه چیزی را دوست دارید، نظرتان را می‌گویید و موافقت یا مخالفت می‌کنید.',
    [
      trSentence('tr3-33', 'Müzik dinlemeyi seviyorum.', 'گوش دادن به موسیقی را دوست دارم.', 'موزیک دینلِمِیی سِوی‌یوروم', 'sevmek', 'دوست داشتن', 'مصدر + -meyi + seviyorum'),
      trSentence('tr3-34', 'Ben de seviyorum.', 'من هم دوست دارم.', 'بِن دِه سِوی‌یوروم', 'ben de', 'من هم', 'ben de = من هم'),
      trSentence('tr3-35', 'Bence bu iyi bir fikir.', 'به نظر من این فکر خوبی است.', 'بِنجِه بو ایّی بیر فیکیر', 'bence', 'به نظر من', 'bence = به نظر من'),
      trSentence('tr3-36', 'Sana katılıyorum.', 'با تو موافقم.', 'سانا کاتیلییوروم', 'katılmak', 'موافقت کردن / پیوستن', 'sana katılıyorum = با تو موافقم'),
      trSentence('tr3-37', 'Ben katılmıyorum.', 'من موافق نیستم.', 'بِن کاتیلمییوروم', 'katılmamak', 'موافق نبودن', 'katıl-mı-yor-um = موافق نیستم'),
      trSentence('tr3-38', 'Ne düşünüyorsun?', 'چه فکر می‌کنی؟', 'نِه دوشونویورسون', 'düşünmek', 'فکر کردن', 'ne düşünüyorsun = چه فکر می‌کنی'),
      trSentence('tr3-39', 'Gerçekten mi?', 'واقعاً؟', 'گِرچِکتِن می', 'gerçekten', 'واقعاً', 'gerçekten mi = واقعاً؟'),
      trSentence('tr3-40', 'Hangisini tercih edersin?', 'کدام را ترجیح می‌دهی؟', 'هانگیسینی تِرْجیح اِدِرسین', 'tercih etmek', 'ترجیح دادن', 'hangisini = کدام را'),
    ],
    [
      { speaker: 'علی', text: 'Ne düşünüyorsun? Bu film nasıl?', fa: 'چه فکر می‌کنی؟ این فیلم چطور است؟' },
      { speaker: 'مریم', text: 'Bence çok güzel. Müzik dinlemeyi seviyorum, müzikleri harika.', fa: 'به نظر من خیلی خوب است. گوش دادن به موسیقی را دوست دارم، موسیقی‌هایش عالی است.' },
      { speaker: 'علی', text: 'Sana katılıyorum!', fa: 'با تو موافقم!' },
      { speaker: 'مریم', text: 'O zaman yarın birlikte izleyelim.', fa: 'پس فردا با هم ببینیم.' },
    ],
    [
      {
        promptFa: 'برای گفتن «به نظر من» کدام واژه به کار می‌رود؟',
        choices: ['bence', 'sence', 'gerçekten'],
        correctIndex: 0,
        explanationFa: 'bence = به نظر من؛ sence = به نظر تو.',
      },
      {
        promptFa: '«با تو موافقم» کدام است؟',
        choices: ['Sana katılıyorum.', 'Seni seviyorum.', 'Sana gidiyorum.'],
        correctIndex: 0,
        explanationFa: 'katılmak یعنی موافقت کردن.',
      },
    ],
    'وقتی بعد از «sevmek» فعلی بیاید، آن فعل به شکل اسم‌مصدر درمی‌آید: müzik dinle-meyi seviyorum (گوش دادن به موسیقی را دوست دارم). برای نظر شخصی «bence» و برای پرسیدن نظر دیگری «sence?» کافی است.',
  ),

  trLesson(
    'tr-l3-weather',
    'آب‌وهوا و فصل‌ها',
    'دربارهٔ هوا، فصل‌ها و لباس مناسب صحبت می‌کنید.',
    [
      trSentence('tr3-41', 'Bugün hava çok sıcak.', 'امروز هوا خیلی گرم است.', 'بوگون هَوا چوک سیجاق', 'hava', 'هوا', 'hava sıcak = هوا گرم است'),
      trSentence('tr3-42', 'Kışın kar yağıyor.', 'در زمستان برف می‌بارد.', 'کیشین کار یاغییور', 'kar', 'برف', 'kış + -ın = در زمستان'),
      trSentence('tr3-43', 'Dışarıda yağmur var.', 'بیرون باران است.', 'دیشاریدا یاغمور وار', 'yağmur', 'باران', 'dışarıda = بیرون'),
      trSentence('tr3-44', 'Yarın güneşli olacak.', 'فردا آفتابی خواهد بود.', 'یارین گونشلی اولاجاک', 'güneşli', 'آفتابی', 'güneşli olacak = آفتابی خواهد بود'),
      trSentence('tr3-45', 'Rüzgâr çok güçlü.', 'باد خیلی شدید است.', 'روزگار چوک گوچلو', 'rüzgâr', 'باد', 'güçlü = قوی / شدید'),
      trSentence('tr3-46', 'Hava soğuk, mont giy.', 'هوا سرد است، کاپشن بپوش.', 'هَوا سوغوک، مونت گی', 'soğuk', 'سرد', 'mont giy = کاپشن بپوش'),
      trSentence('tr3-47', 'En sevdiğim mevsim ilkbahar.', 'فصل مورد علاقه‌ام بهار است.', 'اِن سِودییم مِوسیم ایلک‌باهار', 'mevsim', 'فصل', 'en sevdiğim = مورد علاقه‌ام'),
      trSentence('tr3-48', 'Hava durumu nasıl?', 'هوا چطور است؟', 'هَوا دورومو ناصیل', 'hava durumu', 'وضعیت هوا', 'hava durumu nasıl = هوا چطور است'),
    ],
    [
      { speaker: 'مریم', text: 'Bugün hava durumu nasıl?', fa: 'امروز هوا چطور است؟' },
      { speaker: 'علی', text: 'Hava çok soğuk. Dışarıda kar var.', fa: 'هوا خیلی سرد است. بیرون برف است.' },
      { speaker: 'مریم', text: 'Yarın nasıl olacak?', fa: 'فردا چطور خواهد بود؟' },
      { speaker: 'علی', text: 'Yarın güneşli olacak.', fa: 'فردا آفتابی خواهد بود.' },
    ],
    [
      {
        promptFa: '«هوا سرد است» کدام است؟',
        choices: ['Hava sıcak.', 'Hava soğuk.', 'Hava yağmurlu.'],
        correctIndex: 1,
        explanationFa: 'soğuk = سرد، sıcak = گرم.',
      },
      {
        promptFa: 'واژهٔ «kar» چه معنایی دارد؟',
        choices: ['باران', 'برف', 'باد'],
        correctIndex: 1,
        explanationFa: 'kar = برف، yağmur = باران، rüzgâr = باد.',
      },
    ],
    'فصل‌ها: ilkbahar (بهار)، yaz (تابستان)، sonbahar (پاییز)، kış (زمستان). برای «در تابستان» پسوند -ın/-in به فصل می‌چسبد: yazın، kışın.',
  ),

  trLesson(
    'tr-l3-work',
    'کار، درس و برنامهٔ روز',
    'دربارهٔ شغل، ساعت کاری، جلسه و مرخصی صحبت می‌کنید.',
    [
      trSentence('tr3-49', 'Nerede çalışıyorsun?', 'کجا کار می‌کنی؟', 'نِرِدِه چالیشییورسون', 'çalışmak', 'کار کردن', 'nerede çalışıyorsun = کجا کار می‌کنی'),
      trSentence('tr3-50', 'Bir şirkette çalışıyorum.', 'در یک شرکت کار می‌کنم.', 'بیر شیرکِتتِ چالیشییوروم', 'şirket', 'شرکت', 'şirket + -te = در شرکت'),
      trSentence('tr3-51', 'Ne iş yapıyorsun?', 'چه کاری می‌کنی؟', 'نِه ایش یاپییورسون', 'iş', 'کار', 'ne iş yapıyorsun = شغلت چیست'),
      trSentence('tr3-52', 'Öğrenciyim, Türkçe öğreniyorum.', 'دانشجویم، ترکی یاد می‌گیرم.', 'اویْرِنجی‌ییم، تورکچه اویْرِنییوروم', 'öğrenmek', 'یاد گرفتن', 'öğren- + -iyor- + -um'),
      trSentence('tr3-53', 'Saat dokuzda işe başlıyorum.', 'ساعت نه کار را شروع می‌کنم.', 'ساعت دوکوزدا ایشه باشلییوروم', 'işe başlamak', 'شروع به کار کردن', 'iş + -e = به کار'),
      trSentence('tr3-54', 'Toplantı var mı?', 'جلسه هست؟', 'توپلانتی وار می', 'toplantı', 'جلسه', 'toplantı var mı = جلسه هست؟'),
      trSentence('tr3-55', 'Bugün çok meşgulüm.', 'امروز خیلی سرم شلوغ است.', 'بوگون چوک مِشغولوم', 'meşgul', 'مشغول', 'meşgul + -üm = مشغولم'),
      trSentence('tr3-56', 'İzin alabilir miyim?', 'می‌توانم مرخصی بگیرم؟', 'ایزین آلابیلیر می‌ییم', 'izin', 'مرخصی / اجازه', 'izin almak = مرخصی گرفتن'),
    ],
    [
      { speaker: 'مدیر', text: 'Nerede çalışıyorsun?', fa: 'کجا کار می‌کنی؟' },
      { speaker: 'مریم', text: 'Bir şirkette çalışıyorum ve Türkçe öğreniyorum.', fa: 'در یک شرکت کار می‌کنم و ترکی یاد می‌گیرم.' },
      { speaker: 'مدیر', text: 'Bugün toplantı var mı?', fa: 'امروز جلسه هست؟' },
      { speaker: 'مریم', text: 'Evet, saat dokuzda. Bugün çok meşgulüm.', fa: 'بله، ساعت نه. امروز خیلی سرم شلوغ است.' },
    ],
    [
      {
        promptFa: 'برای پرسیدن شغل («چه کاری می‌کنی؟») کدام جمله است؟',
        choices: ['Nerede yaşıyorsun?', 'Ne iş yapıyorsun?', 'Ne zaman geliyorsun?'],
        correctIndex: 1,
        explanationFa: 'ne iş yapıyorsun = شغلت چیست / چه کاری می‌کنی.',
      },
      {
        promptFa: '«در یک شرکت کار می‌کنم» کدام است؟',
        choices: ['Bir şirkette çalışıyorum.', 'Bir şirkete gidiyorum.', 'Bir şirketim var.'],
        correctIndex: 0,
        explanationFa: 'şirket + -te = در شرکت.',
      },
    ],
    'پسوند مکان -de/-da (و -te/-ta بعد از صامت بی‌واک) جای «در» را می‌گیرد: şirkette، okulda، evde. برای «شروع کردن به ...» ساختار «... -e başlamak» است: işe başlıyorum.',
  ),

  trLesson(
    'tr-l3-home',
    'خانه، خانواده و زندگی روزمره',
    'دربارهٔ خانه، خانواده و کارهای خانه صحبت می‌کنید.',
    [
      trSentence('tr3-57', 'Ailemle yaşıyorum.', 'با خانواده‌ام زندگی می‌کنم.', 'آیِلِمله یاشاییوروم', 'aile', 'خانواده', 'aile + -m + -le = با خانواده‌ام'),
      trSentence('tr3-58', 'Evim şehir merkezinde.', 'خانه‌ام در مرکز شهر است.', 'اِویم شِهیر مِرکِزیندِه', 'ev', 'خانه', 'ev + -im = خانه‌ام'),
      trSentence('tr3-59', 'Mutfakta yemek yapıyorum.', 'در آشپزخانه غذا می‌پزم.', 'موتفاقتا یِمِک یاپییوروم', 'mutfak', 'آشپزخانه', 'mutfak + -ta = در آشپزخانه'),
      trSentence('tr3-60', 'İki çocuğum var.', 'دو فرزند دارم.', 'ایکی چوجوغوم وار', 'çocuk', 'فرزند / کودک', 'çocuk + -um = فرزندم'),
      trSentence('tr3-61', 'Annem ve babam İran\'da.', 'مادرم و پدرم در ایران هستند.', 'آنِم وِه بابام ایران‌دا', 'anne', 'مادر', 'annem = مادرم'),
      trSentence('tr3-62', 'Ev kirası çok yüksek.', 'اجارهٔ خانه خیلی بالاست.', 'اِو کیراسی چوک یوکسِک', 'kira', 'اجاره', 'ev kirası = اجارهٔ خانه'),
      trSentence('tr3-63', 'Odamı temizliyorum.', 'اتاقم را تمیز می‌کنم.', 'اودامی تِمیزلییوروم', 'temizlemek', 'تمیز کردن', 'oda + -m + -ı = اتاقم را'),
      trSentence('tr3-64', 'Çamaşır makinesi bozuk.', 'ماشین لباسشویی خراب است.', 'چاماشیر ماکینِسی بوزوک', 'bozuk', 'خراب', 'bozuk = خراب'),
    ],
    [
      { speaker: 'علی', text: 'Nerede yaşıyorsun?', fa: 'کجا زندگی می‌کنی؟' },
      { speaker: 'مریم', text: 'Ailemle yaşıyorum. Evim şehir merkezinde.', fa: 'با خانواده‌ام زندگی می‌کنم. خانه‌ام در مرکز شهر است.' },
      { speaker: 'علی', text: 'Ev kirası çok yüksek mi?', fa: 'اجارهٔ خانه خیلی بالاست؟' },
      { speaker: 'مریم', text: 'Evet, çok yüksek. Ama mutfak çok güzel.', fa: 'بله، خیلی بالا. ولی آشپزخانه خیلی قشنگ است.' },
    ],
    [
      {
        promptFa: '«با خانواده‌ام زندگی می‌کنم» کدام است؟',
        choices: ['Ailemle yaşıyorum.', 'Ailem var.', 'Ailem İran\'da.'],
        correctIndex: 0,
        explanationFa: 'aile + -m (خانواده‌ام) + -le (با) → ailemle.',
      },
      {
        promptFa: 'واژهٔ «bozuk» یعنی چه؟',
        choices: ['تمیز', 'خراب', 'گران'],
        correctIndex: 1,
        explanationFa: 'bozuk = خراب؛ temiz = تمیز.',
      },
    ],
    'پسوند «با» -le/-la است: ailemle (با خانواده‌ام)، arkadaşımla (با دوستم). برای «مال من» پسوند مالکیت کافی است: evim (خانه‌ام)، odam (اتاقم).',
  ),
];
