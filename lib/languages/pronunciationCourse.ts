export type PronunciationLanguage = 'en' | 'de' | 'ru';

export interface PronunciationExample {
  text: string;
  meaningFa: string;
  focusFa: string;
}

export interface PronunciationUnit {
  id: string;
  title: string;
  focusFa: string;
  explanationFa: string;
  examples: readonly PronunciationExample[];
  practiceFa: string;
  practiceText: string;
  practiceMeaningFa: string;
}

/**
 * Short, self-guided pronunciation workshops for Persian-speaking learners.
 * Persian descriptions explain mouth movement and listening focus; they are not
 * phonetic transcriptions or claims that a single accent is the only valid one.
 */
export const PRONUNCIATION_COURSES: Record<PronunciationLanguage, readonly PronunciationUnit[]> = {
  en: [
    {
      id: 'en-vowels-ship-sheep',
      title: 'واکهٔ کوتاه و بلند: ship و sheep',
      focusFa: 'فرق کیفیت صدا را هم بشنو؛ فقط آن را نکش.',
      explanationFa: 'در ship صدای i کوتاه‌تر و کمی بازتر است. در sheep زبان بالاتر و جلوتر می‌رود و واکه کشیده‌تر می‌شود. این دو صدا را با یک «ای» یکسان نخوان.',
      examples: [
        { text: 'ship', meaningFa: 'کشتی', focusFa: 'i کوتاه' },
        { text: 'sheep', meaningFa: 'گوسفند', focusFa: 'ee کشیده' },
        { text: 'sit', meaningFa: 'نشستن', focusFa: 'i کوتاه' },
        { text: 'seat', meaningFa: 'صندلی', focusFa: 'ea کشیده' },
      ],
      practiceFa: 'دو واژهٔ هر جفت را پشت سر هم گوش کنید؛ سپس بدون نگاه‌کردن به ترجمه، تفاوتشان را با صدای خودتان تکرار کنید.',
      practiceText: 'The sheep is on the ship.',
      practiceMeaningFa: 'گوسفند روی کشتی است.',
    },
    {
      id: 'en-vowels-cap-cup',
      title: 'فرق صدای a در cap و cup',
      focusFa: 'دهانِ cap بازتر است؛ cup صدایی مرکزی‌تر دارد.',
      explanationFa: 'در انگلیسی آمریکایی، واکهٔ cap با دهان بازتر و زبان جلوتر ساخته می‌شود. در cup زبان راحت‌تر و نزدیک مرکز دهان است. این دو را با «اَ» و «آ» فارسی جایگزین نکن؛ به نمونهٔ صوتی گوش بده.',
      examples: [
        { text: 'cap', meaningFa: 'کلاه لبه‌دار', focusFa: 'دهان بازتر؛ واکهٔ جلویی' },
        { text: 'cup', meaningFa: 'فنجان', focusFa: 'واکهٔ مرکزی‌تر' },
        { text: 'bat', meaningFa: 'خفاش', focusFa: 'همان واکهٔ cap' },
        { text: 'but', meaningFa: 'اما', focusFa: 'همان واکهٔ cup' },
      ],
      practiceFa: 'لب‌ها را رها نگه دارید و جفت cap/cup را آهسته، سپس در سرعت عادی تکرار کنید؛ حروف را با هم عوض نکنید.',
      practiceText: 'Put the cap beside the cup.',
      practiceMeaningFa: 'کلاه را کنار فنجان بگذار.',
    },
    {
      id: 'en-th-thin-this',
      title: 'دو صدای th در thin و this',
      focusFa: 'نوک زبان را آرام میان دندان‌ها بگذار.',
      explanationFa: 'برای هر دو صدا، نوک زبان کمی میان دندان‌ها می‌آید و هوا از کنارش می‌گذرد. در thin صدا بی‌واک است؛ در this تارهای صوتی هم می‌لرزند. آن را با s، z یا d عوض نکن.',
      examples: [
        { text: 'thin', meaningFa: 'نازک', focusFa: 'هوا جاری است؛ گلو نمی‌لرزد' },
        { text: 'this', meaningFa: 'این', focusFa: 'همان جای زبان؛ گلو می‌لرزد' },
        { text: 'think', meaningFa: 'فکرکردن', focusFa: 'th بی‌واک' },
        { text: 'they', meaningFa: 'آن‌ها', focusFa: 'th واک‌دار' },
      ],
      practiceFa: 'آینه کمک می‌کند جای زبان را ببینید. لازم نیست زبان را زیاد بیرون بیاورید؛ تنها نوکش را به لبهٔ دندان‌ها نزدیک کنید.',
      practiceText: 'I think this is theirs.',
      practiceMeaningFa: 'فکر می‌کنم این مال آن‌هاست.',
    },
    {
      id: 'en-v-w',
      title: 'فرق v و w در vest و west',
      focusFa: 'برای v دندان و لب نزدیک می‌شوند؛ برای w لب‌ها گرد می‌شوند.',
      explanationFa: 'در v دندان‌های بالایی آرام به لب پایین می‌رسند و صدا می‌لرزد. برای w دندان‌ها به لب نمی‌خورند؛ لب‌ها گرد می‌شوند و بعد باز می‌شوند. این دو را با هم جابه‌جا نکن.',
      examples: [
        { text: 'vest', meaningFa: 'جلیقه', focusFa: 'v با تماس آرام دندان و لب' },
        { text: 'west', meaningFa: 'غرب', focusFa: 'w با لب‌های گرد، بدون تماس دندان' },
        { text: 'vet', meaningFa: 'دامپزشک', focusFa: 'v' },
        { text: 'wet', meaningFa: 'خیس', focusFa: 'w' },
      ],
      practiceFa: 'لب پایین را هنگام v لمس کنید؛ برای w تماس را بردارید. هر جفت را گوش کنید و سپس از روی شکل دهان تقلید کنید.',
      practiceText: 'We left the vest by the west door.',
      practiceMeaningFa: 'جلیقه را کنار درِ غربی گذاشتیم.',
    },
    {
      id: 'en-r-l',
      title: 'فرق r و l در right و light',
      focusFa: 'جای نوک زبان در این دو صدا یکی نیست.',
      explanationFa: 'در r آمریکایی زبان به سقف دهان نمی‌چسبد و کمی عقب می‌رود؛ در l نوک زبان به برجستگی پشت دندان‌های بالایی می‌رسد. صدای r انگلیسی را با رِ لرزشی فارسی یکی نکن.',
      examples: [
        { text: 'right', meaningFa: 'راست؛ درست', focusFa: 'r بدون ضربهٔ نوک زبان' },
        { text: 'light', meaningFa: 'نور؛ سبک', focusFa: 'l با تماس نوک زبان' },
        { text: 'grass', meaningFa: 'چمن', focusFa: 'r آمریکایی' },
        { text: 'glass', meaningFa: 'لیوان', focusFa: 'l' },
      ],
      practiceFa: 'کلمه‌ها را آهسته شروع کنید؛ برای r زبان را نلرزانید و برای l تماس نوک زبان را کوتاه و روشن نگه دارید.',
      practiceText: 'Turn right at the light.',
      practiceMeaningFa: 'کنار چراغ به راست بپیچ.',
    },
    {
      id: 'en-word-endings',
      title: 'پایان واژه را کامل بگویید',
      focusFa: 'صدای پایانی را نگه دار؛ میان همخوان‌ها واکه اضافه نکن.',
      explanationFa: 'در rice صدای پایانی s بی‌واک است؛ در rise همان جایگاه با z واک‌دار می‌شود و معنی کلمه عوض می‌شود. در asked نیز خوشهٔ پایانی را حفظ کن؛ بعد از آن یک «ـِ» اضافه نکن.',
      examples: [
        { text: 'rice', meaningFa: 'برنج', focusFa: 'پایان s بی‌واک' },
        { text: 'rise', meaningFa: 'بالارفتن؛ برخاستن', focusFa: 'پایان z واک‌دار' },
        { text: 'asked', meaningFa: 'پرسید', focusFa: 'پایان خوشه‌ای؛ بدون واکهٔ اضافه' },
      ],
      practiceFa: 'پایان کلمه را رها نکنید؛ rice و rise را مقایسه کنید و asked را یک‌تکه بگویید، نه «اَسکِد».',
      practiceText: 'I asked for rice.',
      practiceMeaningFa: 'برنج خواستم.',
    },
    {
      id: 'en-s-ed-endings',
      title: 'پایان‌های s و ed',
      focusFa: 'پسوند نوشته‌شده یکسان است، اما صدایش با صدای پیش از آن هماهنگ می‌شود.',
      explanationFa: 'پایان جمع یا سوم‌شخص s معمولاً بعد از صدای بی‌واک /s/، بعد از صدای واک‌دار /z/ و پس از صداهای شبیه s/sh/ch به صورت هجای کوتاه /ɪz/ شنیده می‌شود. ed هم پس از صدای بی‌واک معمولاً /t/، پس از صدای واک‌دار /d/ و پس از t یا d به صورت /ɪd/ ادا می‌شود.',
      examples: [
        { text: 'cats', meaningFa: 'گربه‌ها', focusFa: 'پایان s بی‌واک' },
        { text: 'bags', meaningFa: 'کیف‌ها', focusFa: 'پایان z واک‌دار' },
        { text: 'watches', meaningFa: 'تماشا می‌کند', focusFa: 'پایان یک هجای کوتاه /ɪz/' },
        { text: 'watched · cleaned · wanted', meaningFa: 'تماشا کرد · تمیز کرد · خواست', focusFa: 'به‌ترتیب: t · d · یک هجای کوتاه /ɪd/' },
      ],
      practiceFa: 'واژه‌ها را دسته‌بندی و گوش کنید؛ در watched یک هجای تازه نسازید، اما wanted را با هجای پایانیِ کوتاه کامل بگویید.',
      practiceText: 'He watched, cleaned, and wanted to play.',
      practiceMeaningFa: 'او تماشا کرد، تمیز کرد و خواست بازی کند.',
    },
    {
      id: 'en-word-stress',
      title: 'تکیهٔ واژه: a present و to present',
      focusFa: 'در بسیاری از واژه‌ها تکیه، معنی یا نقش دستوری را روشن می‌کند.',
      explanationFa: 'هجای تکیه‌دار معمولاً برجسته‌تر و روشن‌تر شنیده می‌شود؛ همهٔ هجاها را با فشار یکسان نگویید. در این دو جمله، جای تکیهٔ present عوض می‌شود: اسم روی هجای اول و فعل روی هجای دوم تکیه دارد.',
      examples: [
        { text: 'I got a present.', meaningFa: 'یک هدیه گرفتم.', focusFa: 'تکیهٔ اسم: PRE-sent' },
        { text: 'I present the award.', meaningFa: 'جایزه را اهدا می‌کنم.', focusFa: 'تکیهٔ فعل: pre-SENT' },
        { text: 'a record', meaningFa: 'یک سابقه؛ یک صفحهٔ موسیقی', focusFa: 'اسم؛ معمولاً تکیهٔ آغازین' },
        { text: 'to record', meaningFa: 'ضبط‌کردن؛ ثبت‌کردن', focusFa: 'فعل؛ معمولاً تکیهٔ هجای دوم' },
      ],
      practiceFa: 'جمله را کامل گوش کنید، هجای برجسته را پیدا کنید و همان بخش را کمی واضح‌تر بگویید؛ لازم نیست آن را فریاد بزنید.',
      practiceText: 'They record the program today.',
      practiceMeaningFa: 'آن‌ها امروز برنامه را ضبط می‌کنند.',
    },
    {
      id: 'en-sentence-rhythm',
      title: 'تکیه و آهنگ جمله',
      focusFa: 'واژه‌های اصلی را برجسته کن؛ سؤال بله/خیر معمولاً آهنگ رو به بالا دارد.',
      explanationFa: 'در گفتار طبیعی، واژه‌های مهم‌تر مثل اسم و فعل برجسته‌ترند و واژه‌های دستوری کوتاه‌تر می‌شوند. سؤال بله/خیر اغلب با آهنگ رو به بالا پایان می‌یابد؛ پرسش‌های واژه‌پرسشی معمولاً آهنگ رو به پایین دارند. آهنگ با توجه به منظور می‌تواند تغییر کند.',
      examples: [
        { text: 'I need a cup of tea, please.', meaningFa: 'لطفاً یک فنجان چای می‌خواهم.', focusFa: 'need، cup و tea را برجسته‌تر بگویید' },
        { text: 'Do you need a cup of tea?', meaningFa: 'یک فنجان چای می‌خواهید؟', focusFa: 'پرسش بله/خیر؛ پایان معمولاً رو به بالا' },
        { text: 'Where is the bus stop?', meaningFa: 'ایستگاه اتوبوس کجاست؟', focusFa: 'پرسش واژه‌پرسشی؛ پایان معمولاً رو به پایین' },
      ],
      practiceFa: 'یک بار جمله‌ها را با صدای نمونه گوش کنید؛ بار دوم فقط واژهٔ مهم را کمی برجسته کنید و آهنگ را با منظور جمله هماهنگ نگه دارید.',
      practiceText: 'Could you help me, please?',
      practiceMeaningFa: 'ممکن است لطفاً به من کمک کنید؟',
    },
  ],
  de: [
    {
      id: 'de-vowel-length',
      title: 'واکهٔ کوتاه و بلند: bitten و bieten',
      focusFa: 'کوتاهی یا کشیدگی واکه در آلمانی می‌تواند معنی را عوض کند.',
      explanationFa: 'در bitten صدای i کوتاه‌تر است؛ در bieten صدای ie کشیده و روشن است. همین تفاوت را در Stadt و Staat هم بشنوید. دو حرف همخوان پشت سر هم یا ie اغلب سرنخ‌اند، اما این راهنما همهٔ املای آلمانی را توضیح نمی‌دهد.',
      examples: [
        { text: 'bitten', meaningFa: 'درخواست‌کردن؛ خواهش‌کردن', focusFa: 'i کوتاه' },
        { text: 'bieten', meaningFa: 'ارائه‌دادن؛ پیشنهادکردن', focusFa: 'ie کشیده' },
        { text: 'Stadt', meaningFa: 'شهر', focusFa: 'a کوتاه' },
        { text: 'Staat', meaningFa: 'کشور؛ دولت', focusFa: 'aa کشیده' },
      ],
      practiceFa: 'هر دو جفت را پشت سر هم گوش کنید. در واکهٔ بلند، صدا را پیوسته نگه دارید؛ بعد تفاوت را در جمله بشنوید.',
      practiceText: 'Sie bieten heute Brot an.',
      practiceMeaningFa: 'امروز نان عرضه می‌کنند.',
    },
    {
      id: 'de-umlauts',
      title: 'Umlautها: ä، ö و ü',
      focusFa: 'گردیِ لب مهم است؛ صدای فارسیِ کاملاً یکسانی برای همه‌شان نداریم.',
      explanationFa: 'برای ö، لب‌ها را گرد کنید و صدایی نزدیک به e بسازید؛ برای ü لب‌ها را گرد نگه دارید و صدایی نزدیک به i بسازید. ä معمولاً جلوتر و بازتر از a است. صدای هر واژه را بشنوید و به نوشتن فارسی تکیه نکنید.',
      examples: [
        { text: 'schon', meaningFa: 'از قبل؛ همین حالا', focusFa: 'o، بدون Umlaut' },
        { text: 'schön', meaningFa: 'زیبا', focusFa: 'ö با لب‌های گرد' },
        { text: 'füllen', meaningFa: 'پرکردن', focusFa: 'ü کوتاه' },
        { text: 'fühlen', meaningFa: 'احساس‌کردن', focusFa: 'ü کشیده' },
        { text: 'Äpfel', meaningFa: 'سیب‌ها', focusFa: 'ä؛ واکه‌ای جلوتر از a' },
      ],
      practiceFa: 'برای ö و ü شکل لب‌ها را روبه‌روی آینه تمرین کنید؛ سپس schon/schön و füllen/fühlen را مقایسه کنید.',
      practiceText: 'Die schöne Küche ist klein.',
      practiceMeaningFa: 'آشپزخانهٔ زیبا کوچک است.',
    },
    {
      id: 'de-ch-sounds',
      title: 'دو صدای ch در ich و Bach',
      focusFa: 'صدای ch به واکهٔ پیش از آن وابسته است.',
      explanationFa: 'در ich و Milch، ch معمولاً صدایی نرم‌تر و جلویی دارد؛ در Bach و Buch صدایی عقب‌تر و سایشی شنیده می‌شود. هیچ‌کدام را با «ش» فارسی یا «ک» جایگزین نکن؛ جای زبان و جریان هوا را از صدای نمونه تقلید کن.',
      examples: [
        { text: 'ich', meaningFa: 'من', focusFa: 'ch جلویی و نرم' },
        { text: 'Milch', meaningFa: 'شیر', focusFa: 'همان ch جلویی' },
        { text: 'Bach', meaningFa: 'جویبار', focusFa: 'ch عقب‌تر' },
        { text: 'Buch', meaningFa: 'کتاب', focusFa: 'همان ch عقب‌تر' },
      ],
      practiceFa: 'اول ich و Bach را مقایسه کنید؛ سپس همان دو جایگاه را در Milch و Buch پیدا کنید. صدای هوا باید ادامه‌دار باشد، نه یک «ک» کوتاه.',
      practiceText: 'Ich suche ein Buch.',
      practiceMeaningFa: 'دنبال یک کتاب می‌گردم.',
    },
    {
      id: 'de-z-w-v',
      title: 'حروف z، w و v',
      focusFa: 'نام حرف همیشه صدای واژه را تعیین نمی‌کند؛ واژهٔ نمونه را به خاطر بسپار.',
      explanationFa: 'z در واژه‌های معمول آلمانی مثل Zeit صدای «تس» دارد؛ w در Wasser شبیه v انگلیسی شنیده می‌شود. در Vater و viel، v معمولاً صدای «ف» دارد؛ در بعضی واژه‌های قرضی ممکن است صدای دیگری داشته باشد.',
      examples: [
        { text: 'Zeit', meaningFa: 'زمان', focusFa: 'z مانند «تس»' },
        { text: 'Wasser', meaningFa: 'آب', focusFa: 'w شبیه v انگلیسی' },
        { text: 'Vater', meaningFa: 'پدر', focusFa: 'v در این واژه مانند «ف»' },
        { text: 'viel', meaningFa: 'زیاد؛ بسیار', focusFa: 'v مانند «ف»' },
      ],
      practiceFa: 'به صدای آغاز هر واژه توجه کنید و حرف را جداگانه از روی نامش نخوانید. Zeit، Wasser و Vater را با سرعت آرام تقلید کنید.',
      practiceText: 'Vater wartet bei der Tür.',
      practiceMeaningFa: 'پدر کنار در منتظر است.',
    },
    {
      id: 'de-sch-sp-st',
      title: 'ترکیب‌های sch، sp و st',
      focusFa: 'در آغاز واژه، sp و st معمولاً با صدای «ش» شروع می‌شوند.',
      explanationFa: 'sch صدایی نزدیک به «ش» می‌دهد. در آغاز واژه، sp را معمولاً «شپ» و st را «شت» می‌شنوید: Sport و Straße. این راهنما دربارهٔ ترکیب‌های آغازین است؛ هر sp یا st در میانهٔ واژه را خودکار همین‌طور نخوانید.',
      examples: [
        { text: 'Schule', meaningFa: 'مدرسه', focusFa: 'sch مانند «ش»' },
        { text: 'Sport', meaningFa: 'ورزش', focusFa: 'sp در آغاز واژه: «شپ»' },
        { text: 'Straße', meaningFa: 'خیابان', focusFa: 'st در آغاز واژه: «شت»' },
        { text: 'sprechen', meaningFa: 'صحبت‌کردن', focusFa: 'sp در آغاز واژه: «شپ»' },
      ],
      practiceFa: 'ابتدا فقط صدای آغاز را تقلید کنید؛ بعد واژه را کامل بگویید. میان s و p یا t واکهٔ اضافه نگذارید.',
      practiceText: 'Wir sprechen später über die Straße.',
      practiceMeaningFa: 'بعدتر دربارهٔ خیابان صحبت می‌کنیم.',
    },
    {
      id: 'de-final-devoicing',
      title: 'صدای پایانی b، d و g',
      focusFa: 'در پایان واژه، صداهای واک‌دار معمولاً بی‌واک شنیده می‌شوند.',
      explanationFa: 'در پایان واژه یا هجا، b معمولاً به p، d به t و g به k نزدیک می‌شود: Tag در پایان شبیه صدای k تمام می‌شود. وقتی پسوندی مثل -e اضافه شود، همان همخوان میان دو واکه می‌آید و تفاوت را در Tage می‌توان شنید.',
      examples: [
        { text: 'Tag', meaningFa: 'روز', focusFa: 'g پایانی شبیه k' },
        { text: 'Tage', meaningFa: 'روزها', focusFa: 'g میان واکه‌ها؛ صدای واک‌دار' },
        { text: 'Rad', meaningFa: 'چرخ', focusFa: 'd پایانی شبیه t' },
        { text: 'Räder', meaningFa: 'چرخ‌ها', focusFa: 'd میان واکه‌ها' },
        { text: 'Bund', meaningFa: 'اتحادیه؛ دسته', focusFa: 'd پایانی شبیه t' },
      ],
      practiceFa: 'گلو را هنگام گفتن واژه‌ها لمس کنید تا لرزش را حس کنید؛ سپس Tag/Tage و Rad/Räder را جفتی بشنوید.',
      practiceText: 'Der Tag ist lang; die Tage sind warm.',
      practiceMeaningFa: 'روز طولانی است؛ روزها گرم‌اند.',
    },
    {
      id: 'de-word-stress',
      title: 'تکیهٔ واژه و پیشوندها',
      focusFa: 'be- و ver- معمولاً بی‌تکیه‌اند؛ پیشوند جداشدنی اغلب برجسته است.',
      explanationFa: 'در فعل‌هایی با پیشوندهای جدا‌نشدنیِ رایج مثل be- و ver-، تکیه اغلب روی بخش اصلی واژه می‌افتد: besuchen، verstehen. پیشوند جداشدنی معمولاً برجسته است: در anrufen، بخش an را روشن‌تر می‌شنوید. این‌ها الگوهای پرکاربردند، نه قانون بی‌استثنا.',
      examples: [
        { text: 'besuchen', meaningFa: 'دیدارکردن؛ بازدیدکردن', focusFa: 'تکیه روی SU' },
        { text: 'verstehen', meaningFa: 'فهمیدن', focusFa: 'تکیه روی STEH' },
        { text: 'anrufen', meaningFa: 'تلفن‌کردن', focusFa: 'پیشوند جداشدنی an برجسته است' },
        { text: 'Ich rufe dich an.', meaningFa: 'به تو تلفن می‌کنم.', focusFa: 'an در پایان جمله برجسته شنیده می‌شود' },
      ],
      practiceFa: 'جمله را کامل بشنوید و بخش برجسته را پیدا کنید؛ فقط همان بخش را کمی روشن‌تر بگویید و باقی واژه را طبیعی نگه دارید.',
      practiceText: 'Ich besuche dich und rufe dich später an.',
      practiceMeaningFa: 'به دیدنت می‌آیم و بعدتر به تو تلفن می‌کنم.',
    },
    {
      id: 'de-weak-endings',
      title: 'پایان‌های کم‌تکیهٔ e و en',
      focusFa: 'هجاهای پایانی کوتاه‌اند، اما در گفتار روشن کاملاً حذفشان نکن.',
      explanationFa: 'e پایانی در واژه‌هایی مثل bitte و Name معمولاً کوتاه و کم‌تکیه است؛ آن را مثل «اِ» کشیده نگو. در پایان -en هم واکه اغلب ضعیف می‌شود. سرعت طبیعی کم‌کم بیشتر می‌شود؛ برای شروع پایان واژه را روشن نگه دارید.',
      examples: [
        { text: 'bitte', meaningFa: 'لطفاً', focusFa: 'e پایانی کوتاه و کم‌تکیه' },
        { text: 'Name', meaningFa: 'نام', focusFa: 'e پایانی کوتاه' },
        { text: 'machen', meaningFa: 'انجام‌دادن؛ ساختن', focusFa: 'پایان -en کم‌تکیه' },
        { text: 'Lehrer', meaningFa: 'معلم', focusFa: 'پایان -er در گفتار معمولاً ضعیف است' },
      ],
      practiceFa: 'پایان هر واژه را آرام و کوتاه بگویید؛ ابتدا هجا را حذف نکنید، سپس به صدای طبیعی دستگاه گوش بدهید.',
      practiceText: 'Bitte sagen Sie meinen Namen.',
      practiceMeaningFa: 'لطفاً نامم را بگویید.',
    },
    {
      id: 'de-sentence-melody',
      title: 'تکیه و آهنگ جمله',
      focusFa: 'واژهٔ مهم را برجسته کن؛ نوع پرسش را از آهنگ جمله بشنو.',
      explanationFa: 'در جملهٔ خبری خنثی، آهنگ معمولاً در پایان پایین می‌آید. پرسش بله/خیر اغلب آهنگ رو به بالا دارد؛ پرسش واژه‌پرسشی مثل Wo? معمولاً پایین می‌آید. واژهٔ مهم را کمی روشن‌تر بگویید و میان واژه‌ها مکث بی‌دلیل نگذارید.',
      examples: [
        { text: 'Ich brauche eine Fahrkarte.', meaningFa: 'یک بلیت لازم دارم.', focusFa: 'Fahrkarte را کمی برجسته‌تر بگویید' },
        { text: 'Haben Sie morgen Zeit?', meaningFa: 'فردا وقت دارید؟', focusFa: 'پرسش بله/خیر؛ پایان معمولاً رو به بالا' },
        { text: 'Wo ist der Bahnhof?', meaningFa: 'ایستگاه راه‌آهن کجاست؟', focusFa: 'پرسش واژه‌پرسشی؛ پایان معمولاً رو به پایین' },
      ],
      practiceFa: 'هر جمله را یک بار گوش کنید؛ بار دوم فقط واژهٔ مهم را برجسته کنید و مکث طبیعی میان عبارت‌ها را حفظ کنید.',
      practiceText: 'Haben Sie morgen Zeit?',
      practiceMeaningFa: 'فردا وقت دارید؟',
    },
  ],
  ru: [
    {
      id: 'ru-stress-reduction',
      title: 'تکیه و کوتاه‌شدن واکه‌ها',
      focusFa: 'واکهٔ بی‌تکیه کوتاه و مبهم می‌شود؛ «о» در هجای بی‌تکیه تقریباً «ا» شنیده می‌شود.',
      explanationFa: 'در روسی فقط یک هجای هر واژه تکیه دارد و همان هجا روشن و کشیده است. بقیهٔ واکه‌ها کوتاه و مبهم می‌شوند؛ به‌ویژه «о» در هجای بی‌تکیه شبیه «ا» تلفظ می‌شود: молоко را «مَلاکو» می‌شنوی، نه «مولوکو». این قانون طبیعی گفتار است و نباید همهٔ واکه‌ها را یک‌اندازه خواند.',
      examples: [
        { text: 'молоко', meaningFa: 'شیر', focusFa: 'تکیه روی КО؛ دو «o»ی نخست کوتاه و شبیه «ا»' },
        { text: 'хорошо', meaningFa: 'خوب', focusFa: 'تکیه روی ШО؛ «о»ی نخست تقریباً «ا»' },
        { text: 'окно', meaningFa: 'پنجره', focusFa: 'تکیه روی НО؛ «о»ی نخست کوتاه' },
        { text: 'молочко', meaningFa: 'شیرکم‌چرب؟ (نوعی نوشیدنی شیر)', focusFa: 'تکیه روی ЧКО؛ بقیه واکه‌ها مبهم' },
      ],
      practiceFa: 'ابتدا فقط هجای تکیه‌دار را روشن و کمی کشیده بگویید؛ بقیهٔ واژه را سریع و مبهم رها کنید. به نمونهٔ صوتی گوش بدهید و سرعت طبیعی را تقلید کنید.',
      practiceText: 'Хорошо, молоко на окне.',
      practiceMeaningFa: 'خوب، شیر روی پنجره است.',
    },
    {
      id: 'ru-hard-soft',
      title: 'همخوان‌های سخت و نرم',
      focusFa: 'همخوان نرم با نزدیک‌شدن میانهٔ زبان به کام گفته می‌شود؛ «ь» و واکه‌های نرم‌کننده نشانه‌اند.',
      explanationFa: 'بیشتر همخوان‌های روسی دو حالت دارند: سخت و نرم. حرف «ь» همخوان پیش از خود را نرم می‌کند و واکه‌های я، ё، ю، е، и هم همخوان پیش از خود را نرم می‌کنند. مثلاً «т» در мать (مادر) نرم است اما در мال (بزرگ) سخت. تفاوت را با گوش‌دادن جفت‌ها تمرین کن؛ فقط «ای» اضافه نخوان.',
      examples: [
        { text: 'мать', meaningFa: 'مادر', focusFa: '«т» نرم؛ میانهٔ زبان به کام نزدیک است' },
        { text: 'мал', meaningFa: 'کوچک است', focusFa: '«л» سخت' },
        { text: 'уголь', meaningFa: 'زغال‌سنگ', focusFa: '«ль» نرم به‌خاطر ь' },
        { text: 'угол', meaningFa: 'زاویه', focusFa: '«л» سخت بدون ь' },
        { text: 'семья', meaningFa: 'خانواده', focusFa: '«м» نرم به‌خاطر я' },
      ],
      practiceFa: 'جفت واژه‌ها را پشت سر هم بشنوید و فقط به نرمیِ همخوان آخر گوش بدهید؛ سپس هر جفت را آرام تکرار کنید. زبان هنگام همخوان نرم کمی جلوتر می‌آید.',
      practiceText: 'Мать ждёт брата.',
      practiceMeaningFa: 'مادر منتظر برادر است.',
    },
    {
      id: 'ru-yerui',
      title: 'تفاوت صدای ы و и',
      focusFa: '«ы» عمیق‌تر و پشت‌تر است؛ «и» جلوتر و روشن‌تر.',
      explanationFa: '«ы» صدایی است که در فارسی نداریم: زبان کمی عقب می‌رود و دهان نیمه‌باز می‌ماند. «и» مثل «ای» فارسی جلوتر ساخته می‌شود. این دو را با هم اشتباه نکن: «мы» (ما) با «ы» است و «мир» (جهان) با «и». بعد از г، к، х در هجای ریشه معمولاً «ы» نمی‌آید و «и» می‌آید.',
      examples: [
        { text: 'мы', meaningFa: 'ما', focusFa: '«ы» عمیق' },
        { text: 'ты', meaningFa: 'تو', focusFa: '«ы» عمیق' },
        { text: 'сын', meaningFa: 'پسر', focusFa: '«ы» عمیق' },
        { text: 'мир', meaningFa: 'جهان؛ صلح', focusFa: '«и» جلو و روشن' },
        { text: 'три', meaningFa: 'سه', focusFa: '«и» جلو' },
      ],
      practiceFa: 'برای «ы» لب‌ها را کمی کشیده نگه دار و صدا را از عقب دهان دربیاور؛ برای «и» زبان را جلو ببر. جفت «мы / ми» را خودت بساز و تفاوت را ضبط کن و بشنو.',
      practiceText: 'Мы и сын сидим тут.',
      practiceMeaningFa: 'ما و پسر اینجا می‌نشینیم.',
    },
    {
      id: 'ru-final-devoicing',
      title: 'بی‌واک‌شدن همخوان پایانی',
      focusFa: 'همخوان واک‌دار در پایان واژه معمولاً بی‌واک شنیده می‌شود: д→т، г→к، ز→س.',
      explanationFa: 'در پایان واژه، همخوان‌های واک‌دار معمولاً بی‌واک ادا می‌شوند: «д» مثل «т»، «г» مثل «к» و «ж» مثل «ش» شنیده می‌شوند. به همین دلیل «друг» (دوست) را تقریباً «دروک» می‌شنوی. اگر همان همخوان میان دو واکه بیاید، دوباره واک‌دار می‌شود: «в саду» صدای «д» روشن دارد.',
      examples: [
        { text: 'друг', meaningFa: 'دوست', focusFa: '«г» پایانی تقریباً «к»' },
        { text: 'сад', meaningFa: 'باغ', focusFa: '«д» پایانی تقریباً «т»' },
        { text: 'нож', meaningFa: 'چاقو', focusFa: '«ж» پایانی تقریباً «ش»' },
        { text: 'в саду', meaningFa: 'در باغ', focusFa: '«д» میان واکه‌ها؛ واک‌دار' },
      ],
      practiceFa: 'گلو را هنگام گفتن واژه‌های پایانی لمس کنید تا نبودِ لرزش را حس کنید؛ سپس همان واژه را در میان جمله بشنوید و تفاوت را مقایسه کنید.',
      practiceText: 'Наш друг сидит в саду.',
      practiceMeaningFa: 'دوست ما در باغ نشسته است.',
    },
    {
      id: 'ru-shch-ch',
      title: 'صداهای щ و ч',
      focusFa: '«щ» مثل «ش» کشیده و نرم است؛ «چ» همان «چ» فارسی است.',
      explanationFa: 'حرف «щ» صدایی کشیده و نرم است — تقریباً «شْ» بلند — و در واژه‌هایی مثل щука و ещё می‌آید. «ч» همیشه «چ» است و هرگز «ک» نمی‌شود. در «счастье» هر دو را کنار هم تمرین کن: آغاز «سچ» و ادامهٔ «استیه».',
      examples: [
        { text: 'щука', meaningFa: 'شاه‌ماهی', focusFa: '«щ» کشیده و نرم' },
        { text: 'час', meaningFa: 'ساعت', focusFa: '«ч» مثل «چ»' },
        { text: 'ещё', meaningFa: 'هنوز؛ باز هم', focusFa: '«щ» کشیده' },
        { text: 'счастье', meaningFa: 'خوشبختی', focusFa: '«сч» = «سچ»' },
        { text: 'дочка', meaningFa: 'دختر', focusFa: '«ч» میانی' },
      ],
      practiceFa: '«щ» را با نگه‌داشتن زبان در حالت نرم کمی بکشید؛ «ч» را کوتاه و روشن بگویید. واژهٔ щука را سه بار آهسته، سپس با سرعت طبیعی تکرار کنید.',
      practiceText: 'Дочка ждёт час, а щука ещё тут.',
      practiceMeaningFa: 'دختر یک ساعت منتظر است و شاه‌ماهی هنوز اینجاست.',
    },
    {
      id: 'ru-soft-sign',
      title: 'نقش «ь» در نرم‌کردن همخوان',
      focusFa: '«ь» صدای مستقل ندارد؛ فقط همخوان پیش از خود را نرم می‌کند.',
      explanationFa: 'حرف «ь» (نشانهٔ نرمی) خودش خوانده نمی‌شود؛ فقط همخوان قبلی را نرم می‌کند: «день» روز، «конь» اسب، «письмо» نامه. در واژه‌هایی مثل «семья» هم «я» نقش نرم‌کننده دارد. گاهی «ь» کلمه را از کلمهٔ دیگر جدا می‌کند: «угол» زاویه در برابر «уголь» زغال.',
      examples: [
        { text: 'день', meaningFa: 'روز', focusFa: '«нь» نرم' },
        { text: 'конь', meaningFa: 'اسب', focusFa: '«нь» نرم' },
        { text: 'письмо', meaningFa: 'نامه', focusFa: '«сь» نرم' },
        { text: 'семья', meaningFa: 'خانواده', focusFa: '«м» نرم پیش از я' },
      ],
      practiceFa: 'پیش از گفتن واژه، یک «ی» کوتاه و بی‌صدا در ذهن تصور کن تا همخوان نرم شود؛ سپس همان واژه را با نمونهٔ صوتی مقایسه کنید.',
      practiceText: 'В семь часов семья пишет письмо.',
      practiceMeaningFa: 'ساعت هفت، خانواده نامه می‌نویسد.',
    },
    {
      id: 'ru-intonation',
      title: 'آهنگ جمله: خبری و پرسشی',
      focusFa: 'پرسش بله/خیر با بالا رفتن آهنگ در پایان ساخته می‌شود؛ پرسش‌واژه‌ای معمولاً پایین می‌آید.',
      explanationFa: 'در جملهٔ خبری، آهنگ صدا در پایان پایین می‌آید. پرسش بله/خیر همان جمله است با آهنگ رو به بالا در واژهٔ آخر. پرسش با واژهٔ پرسشی (Где؟ Что؟ Кто؟) معمولاً آهنگ پایانی پایین‌تری دارد و روی واژهٔ پرسشی تکیه می‌افتد. همین تغییر آهنگ، معنی جمله را عوض می‌کند.',
      examples: [
        { text: 'Это дом.', meaningFa: 'این خانه است.', focusFa: 'خبری؛ پایان پایین' },
        { text: 'Это дом?', meaningFa: 'این خانه است؟', focusFa: 'پرسش بله/خیر؛ پایان بالا' },
        { text: 'Где дом?', meaningFa: 'خانه کجاست؟', focusFa: 'پرسش واژه‌ای؛ تکیه روی «Где»' },
      ],
      practiceFa: 'یک جمله را دو بار بگویید: بار اول خبری، بار دوم با آهنگ پرسشی. فقط آهنگ را عوض کنید و واژه‌ها را تغییر ندهید.',
      practiceText: 'Это дом? Это дом.',
      practiceMeaningFa: 'این خانه است؟ این خانه است.',
    },
    {
      id: 'ru-stress-pairs',
      title: 'تکیه، معنی را عوض می‌کند',
      focusFa: 'در بعضی واژه‌های دوهجایی، جای تکیه معنی را تغییر می‌دهد.',
      explanationFa: 'در روسی جای تکیه ثابت نیست و گاهی معنی واژه را عوض می‌کند: «замок» با تکیه روی هجای اول یعنی قلعه، و با تکیه روی هجای دوم یعنی قفل. همین‌طور «мука» می‌تواند آرد یا رنج باشد. هنگام یادگیری هر واژهٔ نو، جای تکیه را هم از همان اول یاد بگیر.',
      examples: [
        { text: 'замок', meaningFa: 'قلعه', focusFa: 'تکیه روی ЗА' },
        { text: 'замок', meaningFa: 'قفل', focusFa: 'تکیه روی МОК' },
        { text: 'мука', meaningFa: 'آرد', focusFa: 'تکیه روی МУ' },
        { text: 'мука', meaningFa: 'رنج و عذاب', focusFa: 'تکیه روی КА' },
      ],
      practiceFa: 'هر جفت را دو بار با تکیهٔ متفاوت بگویید و به تغییر معنی گوش بدهید. برای یادگیری واژه‌های نو، همیشه تکیه را همراه واژه حفظ کنید.',
      practiceText: 'В этом замке новый замок.',
      practiceMeaningFa: 'در این قلعه، قفل تازه‌ای هست.',
    },
  ],
};

export function isPronunciationLanguage(value: string | undefined): value is PronunciationLanguage {
  return value === 'en' || value === 'de' || value === 'ru';
}
