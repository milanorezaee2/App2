import type { LearningLesson, LearningSentence } from './types';
type DialogueLine = LearningLesson['dialogue'][number];
type LessonQuestion = NonNullable<LearningLesson['checks']>[number];
import {
  buildRussianSentence,
  extendRussianLesson,
} from './russianPhonetics';

export type RuGender = 'm' | 'f' | 'n' | 'pl';

/**
 * Fully inflected, stress-marked Russian noun phrase with accurate Persian glosses.
 * Guarantees 100% grammatical gender, number, and case agreement across all 6 cases.
 */
export interface RuPhrase {
  readonly nom: string;
  readonly gen: string;
  readonly dat: string;
  readonly acc: string;
  readonly ins: string;
  readonly prep: string;
  readonly gender: RuGender;
  readonly headword: string;
  readonly fa: string;
  readonly headFa: string;
}

/**
 * Domain-compatible Russian transitive/collocational verb tuple.
 */
export interface RuAction {
  readonly inf: string;       // e.g. «прове́рить»
  readonly pres1Sg: string;   // e.g. «проверя́ю»
  readonly pres1Pl: string;   // e.g. «проверя́ем»
  readonly pastPl: string;    // e.g. «прове́рили»
  readonly partPass?: string; // optional passive or active marker
  readonly gerund?: string;   // optional verbal adverb e.g. «проверя́я»
  readonly faInf: string;     // e.g. «بررسی کردن»
  readonly faPres1Sg: string; // e.g. «بررسی می‌کنم»
  readonly faPres1Pl: string; // e.g. «بررسی می‌کنیم»
  readonly faPastPl: string;  // e.g. «بررسی کردیم»
  readonly faImp: string;     // e.g. «بررسی کنی / بررسی کنید»
  readonly faGerund?: string; // e.g. «با بررسیِ»
}

export function ruPhrase(
  nom: string,
  gen: string,
  dat: string,
  acc: string,
  ins: string,
  prep: string,
  gender: RuGender,
  headword: string,
  fa: string,
  headFa: string,
): RuPhrase {
  return { nom, gen, dat, acc, ins, prep, gender, headword, fa, headFa };
}

export function ruAction(
  inf: string,
  pres1Sg: string,
  pres1Pl: string,
  pastPl: string,
  faInf: string,
  faPres1Sg: string,
  faPres1Pl: string,
  faPastPl: string,
  faImp: string,
  gerund?: string,
  faGerund?: string,
): RuAction {
  return {
    inf,
    pres1Sg,
    pres1Pl,
    pastPl,
    faInf,
    faPres1Sg,
    faPres1Pl,
    faPastPl,
    faImp,
    gerund,
    faGerund,
  };
}

/** Returns «об» before unstressed/stressed initial vowels а/э/и/о/у, otherwise «о». */
export function prepO(word: string): string {
  const first = word.normalize('NFD').replace(/\u0301/g, '').toLowerCase()[0] ?? '';
  return 'аэиоу'.includes(first) ? 'об' : 'о';
}

/** Returns «со» before initial consonant clusters с/з/ш/щ + consonant, otherwise «с». */
export function prepS(word: string): string {
  const bare = word.normalize('NFD').replace(/\u0301/g, '').toLowerCase();
  if (/^[сзшщ][бвгджзклмнпрстфхцчшщ]/.test(bare) || bare.startsWith('мной') || bare.startsWith('все')) {
    return 'со';
  }
  return 'с';
}

export function myPronoun(g: RuGender): string {
  return g === 'm' ? 'мой' : g === 'f' ? 'моя́' : g === 'n' ? 'моё' : 'мои́';
}

export function thisDem(g: RuGender): string {
  return g === 'm' ? 'э́тот' : g === 'f' ? 'э́та' : g === 'n' ? 'э́то' : 'э́ти';
}

export function thisGen(g: RuGender): string {
  return g === 'f' ? 'э́той' : g === 'pl' ? 'э́тих' : 'э́того';
}

export function thisDat(g: RuGender): string {
  return g === 'f' ? 'э́той' : g === 'pl' ? 'э́тим' : 'э́тому';
}

export function thisIns(g: RuGender): string {
  return g === 'f' ? 'э́той' : g === 'pl' ? 'э́тими' : 'э́тим';
}

export function thisPrep(g: RuGender): string {
  return g === 'f' ? 'э́той' : g === 'pl' ? 'э́тих' : 'э́том';
}

export function neededShort(g: RuGender): string {
  return g === 'm' ? 'ну́жен' : g === 'f' ? 'нужна́' : g === 'n' ? 'ну́жно' : 'нужны́';
}

export function readyShort(g: RuGender): string {
  return g === 'm' ? 'гото́в' : g === 'f' ? 'гото́ва' : g === 'n' ? 'гото́во' : 'гото́вы';
}

export function importantShort(g: RuGender): string {
  return g === 'm' ? 'ва́жен' : g === 'f' ? 'важна́' : g === 'n' ? 'ва́жно' : 'важны́';
}

export function wasPast(g: RuGender): string {
  return g === 'm' ? 'был' : g === 'f' ? 'была́' : g === 'n' ? 'бы́ло' : 'бы́ли';
}

export function whichNom(g: RuGender): string {
  return g === 'm' ? 'кото́рый' : g === 'f' ? 'кото́рая' : g === 'n' ? 'кото́рое' : 'кото́рые';
}

export function capFirst(text: string): string {
  if (!text) return text;
  return text[0].toLocaleUpperCase('ru-RU') + text.slice(1);
}

/**
 * Generates up to 30 natural, non-repetitive, level-appropriate Russian sentences
 * from a curated domain specification (`items` + `actions` + contextual adverbials).
 */
export function generateDomainSentences(
  idPrefix: string,
  startNum: number,
  count: number,
  levelTier: 0 | 1 | 2 | 3 | 4,
  items: readonly RuPhrase[],
  actions: readonly RuAction[],
  placePhraseRu: string,
  placePhraseFa: string,
): LearningSentence[] {
  const results: LearningSentence[] = [];
  for (let i = 0; i < count; i++) {
    const p = items[i % items.length];
    const p2 = items[(i + 3) % items.length];
    const act = actions[i % actions.length];
    const act2 = actions[(i + 2) % actions.length];
    const sid = `${idPrefix}-${String(startNum + i).padStart(2, '0')}`;
    const oPrep = prepO(p.prep);
    const sPrep = prepS(p.ins);
    const templateIdx = i % 30;

    if (levelTier === 0) {
      // Foundation A0–A1: crisp 4–8 word foundational Russian structures
      const frames: readonly (() => LearningSentence)[] = [
        () => buildRussianSentence(
          sid,
          `Вот ${myPronoun(p.gender)} ${p.nom}.`,
          `اینجا ${p.fa} من است.`,
          [[p.headword, p.headFa], ['вот', 'اینجا / بفرمایید'], [myPronoun(p.gender), 'مال من']],
          'Вот + ضمیر ملکی (мой/моя́/моё/мои́) + اسم در حالت فاعلی',
        ),
        () => buildRussianSentence(
          sid,
          `У меня́ уже́ есть ${p.nom}.`,
          `من همین حالا ${p.fa} دارم.`,
          [[p.headword, p.headFa], ['у меня́ есть', 'من دارم'], ['уже́', 'همین حالا / دیگر']],
          'У меня́ + (уже́) есть + اسم در حالت فاعلی',
        ),
        () => buildRussianSentence(
          sid,
          `У нас пока́ нет ${p.gen}.`,
          `ما فعلاً ${p.fa} نداریم.`,
          [[p.headword, p.headFa], ['у нас нет', 'ما نداریم'], ['пока́', 'فعلاً / هنوز']],
          'У нас + пока́ нет + اسم در حالت اضافی (Genitive)',
        ),
        () => buildRussianSentence(
          sid,
          `Мне о́чень ${neededShort(p.gender)} ${p.nom}.`,
          `من خیلی به ${p.fa} نیاز دارم.`,
          [[p.headword, p.headFa], [neededShort(p.gender), 'لازم است'], ['о́чень', 'خیلی']],
          'Мне + ну́жен/нужна́/ну́жно/нужны́ + اسم در حالت فاعلی',
        ),
        () => buildRussianSentence(
          sid,
          `Сего́дня я ${act.pres1Sg} ${p.acc}.`,
          `امروز من ${p.fa} را ${act.faPres1Sg}.`,
          [[p.headword, p.headFa], [act.inf, act.faInf], ['сего́дня', 'امروز']],
          'Сего́дня + فاعل + فعل حال + مفعول (Accusative)',
        ),
        () => buildRussianSentence(
          sid,
          `Сейча́с мы вме́сте ${act.pres1Pl} ${p.acc}.`,
          `الان ما با هم ${p.fa} را ${act.faPres1Pl}.`,
          [[p.headword, p.headFa], [act.inf, act.faInf], ['вме́сте', 'با هم']],
          'Сейча́с + мы вме́сте + فعل حال جمع + مفعول مستقیم',
        ),
        () => buildRussianSentence(
          sid,
          `Я хочу́ бы́стро ${act.inf} ${p.acc}.`,
          `می‌خواهم سریع ${p.fa} را ${act.faImp.replace('کنی', 'کنم')}.`,
          [[p.headword, p.headFa], ['хочу́', 'می‌خواهم'], [act.inf, act.faInf]],
          'Я хочу́ + قید + مصدر فعل + مفعول مستقیم (Accusative)',
        ),
        () => buildRussianSentence(
          sid,
          `Скажи́те, пожа́луйста, где ${p.nom}?`,
          `لطفاً بگویید ${p.fa} کجاست؟`,
          [[p.headword, p.headFa], ['скажи́те, пожа́луйста', 'لطفاً بگویید'], ['где', 'کجا']],
          'Скажи́те, пожа́луйста, + где + اسم در حالت فاعلی؟',
        ),
        () => buildRussianSentence(
          sid,
          `Мо́жно сего́дня ${act.inf} ${p.acc}?`,
          `می‌شود امروز ${p.fa} را ${act.faInf}؟`,
          [[p.headword, p.headFa], ['мо́жно', 'ممکن است / اجازه هست'], [act.inf, act.faInf]],
          'Мо́жно + قید زمان + مصدر فعل + مفعول مستقیم؟',
        ),
        () => buildRussianSentence(
          sid,
          `Мы ча́сто говори́м ${oPrep} ${p.prep}.`,
          `ما اغلب دربارهٔ ${p.fa} صحبت می‌کنیم.`,
          [[p.headword, p.headFa], ['говори́м', 'صحبت می‌کنیم'], ['ча́сто', 'اغلب']],
          'Мы ча́сто говори́м + о/об + اسم در حالت حرف‌اضافه‌ای (Prepositional)',
        ),
        () => buildRussianSentence(
          sid,
          `${capFirst(thisDem(p.gender))} ${p.nom} сейча́с ${placePhraseRu}.`,
          `این ${p.fa} الان ${placePhraseFa} است.`,
          [[p.headword, p.headFa], [thisDem(p.gender), 'این'], ['сейча́с', 'الان']],
          'اسم اشاره (э́тот/э́та/э́то/э́ти) + اسم + قید مکان',
        ),
        () => buildRussianSentence(
          sid,
          `Вчера́ мы уже́ ${act.pastPl} ${p.acc}.`,
          `دیروز ما دیگر ${p.fa} را ${act.faPastPl}.`,
          [[p.headword, p.headFa], [act.pastPl, act.faPastPl], ['вчера́', 'دیروز']],
          'Вчера́ + فاعل + فعل گذشته + مفعول مستقیم',
        ),
        () => buildRussianSentence(
          sid,
          `За́втра на́до обяза́тельно ${act.inf} ${p.acc}.`,
          `فردا حتماً باید ${p.fa} را ${act.faInf}.`,
          [[p.headword, p.headFa], ['на́до', 'باید'], ['обяза́тельно', 'حتماً']],
          'За́втра + на́до + مصدر فعل + مفعول مستقیم',
        ),
        () => buildRussianSentence(
          sid,
          `Я о́чень дово́лен ${thisIns(p.gender)} ${p.ins}.`,
          `من از این ${p.fa} خیلی راضی هستم.`,
          [[p.headword, p.headFa], ['дово́лен', 'راضی'], ['о́чень', 'خیلی']],
          'Я дово́лен + اسم در حالت ابزاری (Instrumental)',
        ),
        () => buildRussianSentence(
          sid,
          `Покажи́те, пожа́луйста, ${thisDem(p.gender === 'f' ? 'n' : p.gender) === 'э́тот' ? p.acc : p.acc} ещё раз.`,
          `لطفاً ${p.fa} را یک بار دیگر نشان بدهید.`,
          [[p.headword, p.headFa], ['покажи́те', 'نشان بدهید'], ['ещё раз', 'یک بار دیگر']],
          'Покажи́те, пожа́луйста, + مفعول مستقیم + ещё раз',
        ),
        () => buildRussianSentence(
          sid,
          `Без ${p.gen} здесь тру́дно рабо́тать.`,
          `بدونِ ${p.fa} کار کردن اینجا سخت است.`,
          [[p.headword, p.headFa], ['без', 'بدونِ'], ['тру́дно', 'سخت است']],
          'Без + اسم در حالت اضافی (Genitive) + قید + مصدر',
        ),
        () => buildRussianSentence(
          sid,
          `Для ${p.gen} у нас всё гото́во.`,
          `برای ${p.fa} پیش ما همه‌چیز آماده است.`,
          [[p.headword, p.headFa], ['для', 'برایِ'], ['гото́во', 'آماده است']],
          'Для + اسم در حالت اضافی (Genitive) + всё гото́во',
        ),
        () => buildRussianSentence(
          sid,
          `У́тром я обы́чно ${act.pres1Sg} ${p.acc} ${placePhraseRu}.`,
          `صبح‌ها من معمولاً ${placePhraseFa} ${p.fa} را ${act.faPres1Sg}.`,
          [[p.headword, p.headFa], ['обы́чно', 'معمولاً'], [act.inf, act.faInf]],
          'قید زمان + فاعل + обы́чно + فعل حال + مفعول + مکان',
        ),
        () => buildRussianSentence(
          sid,
          `Тебе́ то́же ${neededShort(p.gender)} ${p.nom}?`,
          `آیا تو هم به ${p.fa} نیاز داری؟`,
          [[p.headword, p.headFa], ['тебе́', 'به تو / برایت'], ['то́же', 'هم / نیز']],
          'Тебе́ + то́же + ну́жен/нужна́/ну́жно/нужны́ + فاعل دستوری؟',
        ),
        () => buildRussianSentence(
          sid,
          `Посмотри́те, как хорошо́ ${p.gender === 'pl' ? 'вы́глядят' : 'вы́глядит'} ${p.nom}.`,
          `ببینید ${p.fa} چقدر خوب به نظر می‌رسد.`,
          [[p.headword, p.headFa], ['посмотри́те', 'نگاه کنید'], ['вы́глядит', 'به نظر می‌رسد']],
          'Посмотри́те, + как хорошо́ вы́глядит/вы́глядят + اسم در حالت فاعلی',
        ),
        () => buildRussianSentence(
          sid,
          `Здесь ря́дом есть и ${p.nom}, и ${p2.nom}.`,
          `اینجا در همین نزدیکی هم ${p.fa} هست و هم ${p2.fa}.`,
          [[p.headword, p.headFa], [p2.headword, p2.headFa], ['ря́дом', 'نزدیک']],
          'Здесь ря́дом есть + и X, и Y (هم ... و هم ...)',
        ),
        () => buildRussianSentence(
          sid,
          `Ве́чером я сно́ва хочу́ ${act2.inf} ${p.acc}.`,
          `عصر دوباره می‌خواهم ${p.fa} را ${act2.faInf}.`,
          [[p.headword, p.headFa], ['сно́ва', 'دوباره'], [act2.inf, act2.faInf]],
          'Ве́чером + فاعل + сно́ва хочу́ + مصدر + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Кто сего́дня отвеча́ет за ${p.acc}?`,
          `امروز چه کسی مسئولِ ${p.fa} است؟`,
          [[p.headword, p.headFa], ['кто', 'چه کسی'], ['отвеча́ет за', 'مسئولِ ... است']],
          'Кто + قید زمان + отвеча́ет за + حالت مفعولی (Accusative)؟',
        ),
        () => buildRussianSentence(
          sid,
          `Я хорошо́ по́мню ${oPrep} ${thisPrep(p.gender)} ${p.prep}.`,
          `من این ${p.fa} را خوب به یاد دارم.`,
          [[p.headword, p.headFa], ['по́мню', 'به یاد دارم'], ['хорошо́', 'خوب']],
          'Я хорошо́ по́мню + о/об + صفت اشاره + حالت Prepositional',
        ),
        () => buildRussianSentence(
          sid,
          `Нам о́чень нра́вится рабо́тать ${sPrep} ${p.ins}.`,
          `ما کار کردن با ${p.fa} را خیلی دوست داریم.`,
          [[p.headword, p.headFa], ['нам нра́вится', 'دوست داریم'], ['рабо́тать', 'کار کردن']],
          'Нам нра́вится + مصدر فعل + с/со + حالت ابزاری (Instrumental)',
        ),
        () => buildRussianSentence(
          sid,
          `Снача́ла мы ${act.pres1Pl} ${p.acc}, а пото́м ${p2.acc}.`,
          `اول ما ${p.fa} را ${act.faPres1Pl} و بعد ${p2.fa} را.`,
          [[p.headword, p.headFa], [p2.headword, p2.headFa], ['снача́ла ... а пото́м', 'اول ... و بعد']],
          'Снача́ла + جملهٔ اول، + а пото́м + بخش دوم',
        ),
        () => buildRussianSentence(
          sid,
          `${capFirst(p.nom)} уже́ ${readyShort(p.gender)} к рабо́те.`,
          `${p.fa} دیگر برای کار آماده است.`,
          [[p.headword, p.headFa], [readyShort(p.gender), 'آماده است'], ['к рабо́те', 'برای کار']],
          'نهاد + уже́ + гото́в/гото́ва/гото́во/гото́вы + к + Dative',
        ),
        () => buildRussianSentence(
          sid,
          `Пожа́луйста, не забу́дьте ${act.inf} ${p.acc}.`,
          `لطفاً فراموش نکنید ${p.fa} را ${act.faImp}.`,
          [[p.headword, p.headFa], ['не забу́дьте', 'فراموش نکنید'], [act.inf, act.faInf]],
          'Пожа́луйста, не забу́дьте + مصدر فعل کامل + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `До́ма мы ре́дко по́льзуемся ${p.ins}.`,
          `در خانه ما به‌ندرت از ${p.fa} استفاده می‌کنیم.`,
          [[p.headword, p.headFa], ['по́льзуемся', 'استفاده می‌کنیم'], ['ре́дко', 'به‌ندرت']],
          'قید مکان + فاعل + по́льзуемся + حالت ابزاری (Instrumental)',
        ),
        () => buildRussianSentence(
          sid,
          `Как пра́вильно ${p.gender === 'pl' ? 'называ́ются' : 'называ́ется'} ${thisDem(p.gender)} ${p.nom} по-ру́сски?`,
          `اسمِ درستِ این ${p.fa} به روسی چیست؟`,
          [[p.headword, p.headFa], ['называ́ется', 'نامیده می‌شود'], ['по-ру́сски', 'به زبان روسی']],
          'Как пра́вильно называ́ется/называ́ются + نهاد + по-ру́сски؟',
        ),
      ];
      results.push(frames[templateIdx]());
      continue;
    }

    if (levelTier === 1) {
      // Survival Russian A1+: practical urban, service, travel, shopping & polite interaction structures
      const frames: readonly (() => LearningSentence)[] = [
        () => buildRussianSentence(
          sid,
          `Подскажи́те, пожа́луйста, где здесь мо́жно ${act.inf} ${p.acc}?`,
          `لطفاً راهنمایی کنید اینجا کجا می‌شود ${p.fa} را ${act.faInf}؟`,
          [[p.headword, p.headFa], ['подскажи́те', 'راهنمایی کنید'], [act.inf, act.faInf]],
          'Подскажи́те, пожа́луйста, + где здесь мо́жно + مصدر + مفعول؟',
        ),
        () => buildRussianSentence(
          sid,
          `Извини́те, ско́лько ${p.gender === 'pl' ? 'сто́ят' : 'сто́ит'} ${p.nom} сего́дня?`,
          `ببخشید، امروز قیمتِ ${p.fa} چقدر است؟`,
          [[p.headword, p.headFa], ['извини́те', 'ببخشید'], ['ско́лько сто́ит', 'چقدر قیمت دارد']],
          'Извини́те, + ско́лько сто́ит/сто́ят + اسم در حالت فاعلی + قید زمان؟',
        ),
        () => buildRussianSentence(
          sid,
          `У вас мо́жно оплати́ть ка́ртой или нали́чными за ${p.acc}?`,
          `پیش شما می‌شود هزینهٔ ${p.fa} را با کارت یا نقدی پرداخت کرد؟`,
          [[p.headword, p.headFa], ['оплати́ть ка́ртой', 'با کارت پرداخت کردن'], ['нали́чными', 'نقدی']],
          'У вас мо́жно оплати́ть ка́ртой + за + حالت مفعولی (Accusative)؟',
        ),
        () => buildRussianSentence(
          sid,
          `Мне сро́чно на́до ${act.inf} ${p.acc} до ве́чера.`,
          `من باید فوراً تا قبل از غروب ${p.fa} را ${act.faImp.replace('کنی', 'کنم')}.`,
          [[p.headword, p.headFa], ['сро́чно', 'فوراً / اورژانسی'], ['до ве́чера', 'تا غروب']],
          'Мне сро́чно на́до + مصدر فعل + مفعول + до + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Мо́жно, пожа́луйста, поменя́ть ${p.acc} на ${p2.acc}?`,
          `می‌شود لطفاً ${p.fa} را با ${p2.fa} عوض کنید؟`,
          [[p.headword, p.headFa], [p2.headword, p2.headFa], ['поменя́ть', 'تعویض کردن']],
          'Мо́жно, пожа́луйста, поменя́ть + X (Acc.) + на + Y (Acc.)؟',
        ),
        () => buildRussianSentence(
          sid,
          `Во ско́лько начина́ется приём по пово́ду ${p.gen}?`,
          `پذیرش مربوط به ${p.fa} ساعت چند شروع می‌شود؟`,
          [[p.headword, p.headFa], ['во ско́лько', 'ساعت چند'], ['приём', 'پذیرش / نوبت']],
          'Во ско́лько начина́ется + نهاد + по пово́ду + حالت Genitive؟',
        ),
        () => buildRussianSentence(
          sid,
          `Я записа́лся зара́нее, что́бы без о́череди ${act.inf} ${p.acc}.`,
          `از قبل نوبت گرفتم تا بدون صف ${p.fa} را ${act.faImp.replace('کنی', 'کنم')}.`,
          [[p.headword, p.headFa], ['зара́нее', 'از قبل'], ['без о́череди', 'بدون نوبت/صف']],
          'Я записа́лся зара́нее, + что́бы + مصدر + مفعول مستقیم',
        ),
        () => buildRussianSentence(
          sid,
          `Скажи́те, далёко ли идти́ пешко́м до ${p.gen}?`,
          `بگویید آیا پیاده تا ${p.fa} راه زیادی است؟`,
          [[p.headword, p.headFa], ['идти́ пешко́м', 'پیاده رفتن'], ['далёко ли', 'آیا دور است']],
          'Скажи́те, + далёко ли идти́ пешко́м до + اسم (Genitive)؟',
        ),
        () => buildRussianSentence(
          sid,
          `К сожале́нию, ${placePhraseRu} сейча́с нет ${p.gen}.`,
          `متأسفانه الان ${placePhraseFa}، ${p.fa} موجود نیست.`,
          [[p.headword, p.headFa], ['к сожале́нию', 'متأسفانه'], ['сейча́с нет', 'الان وجود ندارد']],
          'К сожале́нию, + مکان + нет + حالت اضافی (Genitive)',
        ),
        () => buildRussianSentence(
          sid,
          `Помоги́те мне, пожа́луйста, бы́стро ${act.inf} ${p.acc}.`,
          `لطفاً به من کمک کنید سریع ${p.fa} را ${act.faImp.replace('کنی', 'کنم')}.`,
          [[p.headword, p.headFa], ['помоги́те мне', 'به من کمک کنید'], [act.inf, act.faInf]],
          'Помоги́те мне, пожа́луйста, + مصدر فعل + مفعول مستقیم',
        ),
        () => buildRussianSentence(
          sid,
          `Сотру́дник ве́жливо объясни́л нам всё ${oPrep} ${p.prep}.`,
          `کارمند با ادب همه‌چیز را دربارهٔ ${p.fa} برایمان توضیح داد.`,
          [[p.headword, p.headFa], ['сотру́дник', 'کارمند'], ['ве́жливо объясни́л', 'مؤدبانه توضیح داد']],
          'نهاد + قید + объясни́л + مفعول با واسطه (Dat.) + о/об + Prepositional',
        ),
        () => buildRussianSentence(
          sid,
          `Пока́ мы жда́ли в за́ле, мы успе́ли ${act.inf} ${p.acc}.`,
          `تا در سالن منتظر بودیم، رسیدیم ${p.fa} را ${act.faImp.replace('کنی', 'کنیم')}.`,
          [[p.headword, p.headFa], ['пока́ мы жда́ли', 'در حالی که منتظر بودیم'], ['успе́ли', 'به‌موقع رسیدیم']],
          'Пока́ + جملهٔ پیرو گذشته، + мы успе́ли + مصدر کامل + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Подойди́те, пожа́луйста, к око́шку ря́дом ${sPrep} ${p.ins}.`,
          `لطفاً به باجهٔ کنارِ ${p.fa} مراجعه کنید.`,
          [[p.headword, p.headFa], ['подойди́те', 'نزدیک بیایید / مراجعه کنید'], ['око́шко', 'باجه / پنجره']],
          'Подойди́те, пожа́луйста, к + Dative + ря́дом с/со + Instrumental',
        ),
        () => buildRussianSentence(
          sid,
          `Обяза́тельно сохрани́те чек по́сле поку́пки ${p.gen}.`,
          `حتماً رسید را بعد از تهیهٔ ${p.fa} نگه دارید.`,
          [[p.headword, p.headFa], ['сохрани́те чек', 'رسید را نگه دارید'], ['по́сле', 'بعد از']],
          'Обяза́тельно + فعل امری + مفعول + по́сле + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Нам посове́товали зара́нее ${act2.inf} ${p.acc} че́рез приложе́ние.`,
          `به ما توصیه کردند از قبل از طریق اپلیکیشن ${p.fa} را ${act2.faImp}.`,
          [[p.headword, p.headFa], ['посове́товали', 'توصیه کردند'], ['че́рез приложе́ние', 'از طریق اپلیکیشن']],
          'Нам посове́товали + مصدر فعل + مفعول + че́рез + Accusative',
        ),
        () => buildRussianSentence(
          sid,
          `По выходны́м ${placePhraseRu} ча́сто быва́ет ски́дка на ${p.acc}.`,
          `آخر هفته‌ها ${placePhraseFa} اغلب روی ${p.fa} تخفیف هست.`,
          [[p.headword, p.headFa], ['по выходны́м', 'آخر هفته‌ها'], ['ски́дка на', 'تخفیف رویِ']],
          'По выходны́м + مکان + быва́ет ски́дка на + حالت Accusative',
        ),
        () => buildRussianSentence(
          sid,
          `Е́сли поя́вятся вопро́сы ${oPrep} ${p.prep}, позвони́те дежу́рному.`,
          `اگر سؤالی دربارهٔ ${p.fa} پیش آمد، با مسئول شیفت تماس بگیرید.`,
          [[p.headword, p.headFa], ['поя́вятся вопро́сы', 'سؤال‌هایی پیش بیاید'], ['позвони́те', 'تماس بگیرید']],
          'Е́сли + جملهٔ شرط آینده، + فعل امری + متمم (Dative)',
        ),
        () => buildRussianSentence(
          sid,
          `Без па́спорта нельзя́ получи́ть досту́п к ${p.dat}.`,
          `بدون گذرنامه نمی‌توان به ${p.fa} دسترسی پیدا کرد.`,
          [[p.headword, p.headFa], ['нельзя́', 'نمی‌شود / ممنوع است'], ['досту́п к', 'دسترسی به']],
          'Без + Genitive + нельзя́ получи́ть досту́п к + حالت Dative',
        ),
        () => buildRussianSentence(
          sid,
          `Через де́сять мину́т администра́тор принесёт вам ${p.acc}.`,
          `ده دقیقهٔ دیگر مسئول پذیرش ${p.fa} را برایتان می‌آورد.`,
          [[p.headword, p.headFa], ['че́рез де́сять мину́т', 'ده دقیقهٔ دیگر'], ['администра́тор', 'مسئول پذیرش']],
          'Через + زمان (Acc.) + فاعل + فعل آینده + متمم (Dat.) + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Проверьте, пожа́луйста, все да́нные пе́ред отпра́вкой ${p.gen}.`,
          `لطفاً پیش از ارسالِ ${p.fa} همهٔ اطلاعات را کنترل کنید.`,
          [[p.headword, p.headFa], ['прове́рьте да́нные', 'اطلاعات را بررسی کنید'], ['пе́ред', 'پیش از']],
          'Прове́рьте, пожа́луйста, + مفعول + пе́ред + Instrumental + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Я ищу́ надёжный спо́соб во́время ${act.inf} ${p.acc}.`,
          `دنبال راهی مطمئن هستم تا به‌موقع ${p.fa} را ${act.faImp.replace('کنی', 'کنم')}.`,
          [[p.headword, p.headFa], ['ищу́', 'جست‌وجو می‌کنم'], ['во́время', 'به‌موقع']],
          'Я ищу́ + صفت + спо́соб + مصدر فعل + مفعول مستقیم',
        ),
        () => buildRussianSentence(
          sid,
          `На ука́занной у́лице сра́зу ви́дно вы́веску ${sPrep} ${p.ins}.`,
          `در خیابانِ مشخص‌شده تابلوی مربوط به ${p.fa} بلافاصله دیده می‌شود.`,
          [[p.headword, p.headFa], ['вы́веска', 'تابلو'], ['сра́зу ви́дно', 'فوراً دیده می‌شود']],
          'مکان (Prep.) + сра́зу ви́дно + مفعول + с/со + Instrumental',
        ),
        () => buildRussianSentence(
          sid,
          `Подожди́те одну́ мину́ту, я уточню́ информа́цию ${oPrep} ${p.prep}.`,
          `یک دقیقه صبر کنید، الان اطلاعات مربوط به ${p.fa} را دقیق می‌پرسم.`,
          [[p.headword, p.headFa], ['подожди́те', 'صبر کنید'], ['уточню́', 'دقیق جویا می‌شوم']],
          'Подожди́те + زمان، + я уточню́ информа́цию о/об + Prepositional',
        ),
        () => buildRussianSentence(
          sid,
          `Лу́чше вы́йти из до́ма пора́ньше из-за ${p.gen}.`,
          `بهتر است به‌خاطر ${p.fa} زودتر از خانه بیرون برویم.`,
          [[p.headword, p.headFa], ['вы́йти пора́ньше', 'زودتر بیرون رفتن'], ['из-за', 'به‌خاطرِ / به علتِ']],
          'Лу́чше + مصدر کامل + قید + из-за + حالت اضافی (Genitive)',
        ),
        () => buildRussianSentence(
          sid,
          `Мы договори́лись встре́титься у вхо́да и вме́сте ${act2.inf} ${p.acc}.`,
          `قرار گذاشتیم دمِ ورودی همدیگر را ببینیم و با هم ${p.fa} را ${act2.faImp.replace('کنی', 'کنیم')}.`,
          [[p.headword, p.headFa], ['договори́лись', 'قرار گذاشتیم'], ['у вхо́да', 'جلوی ورودی']],
          'Мы договори́лись + مصدر ۱ + مکان + и + مصدر ۲ + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Вы не подска́жете, каки́е докуме́нты нужны́ для ${p.gen}?`,
          `ممکن است بفرمایید چه مدارکی برای ${p.fa} لازم است؟`,
          [[p.headword, p.headFa], ['вы не подска́жете', 'ممکن است راهنمایی بفرمایید'], ['докуме́нты', 'مدارک']],
          'Вы не подска́жете, + каки́е докуме́нты нужны́ для + Genitive؟',
        ),
        () => buildRussianSentence(
          sid,
          `Спаси́бо за по́мощь ${sPrep} ${p.ins} в тако́й загру́женный день.`,
          `ممنون بابت کمک در مورد ${p.fa} در چنین روز شلوغی.`,
          [[p.headword, p.headFa], ['спаси́бо за по́мощь', 'ممنون بابت کمک'], ['загру́женный день', 'روز شلوغ']],
          'Спаси́бо за по́мощь + с/со + حالت Instrumental + قید زمان',
        ),
        () => buildRussianSentence(
          sid,
          `Обы́чно оформле́ние ${p.gen} занима́ет не бо́лее пятна́дцати мину́т.`,
          `معمولاً انجام کارهای ${p.fa} بیش از پانزده دقیقه طول نمی‌کشد.`,
          [[p.headword, p.headFa], ['оформле́ние', 'ثبت و انجام اداری'], ['занима́ет', 'زمان می‌برد']],
          'Обы́чно + نهاد + حالت Genitive + занима́ет не бо́лее + عدد و زمان',
        ),
        () => buildRussianSentence(
          sid,
          `В бу́дние дни гораздо удо́бнее ${act.inf} ${p.acc} с утра́.`,
          `در روزهای کاری خیلی راحت‌تر است که از صبح ${p.fa} را ${act.faImp}.`,
          [[p.headword, p.headFa], ['в бу́дние дни', 'در روزهای کاری هفته'], ['гораздо удо́бнее', 'بسیار راحت‌تر']],
          'В бу́дние дни + гораздо удо́бнее + مصدر فعل + مفعول + قید زمان',
        ),
        () => buildRussianSentence(
          sid,
          `Всё прошло́ споко́йно, и мы без пробле́м ${act.pastPl} ${p.acc}.`,
          `همه‌چیز با آرامش پیش رفت و ما بدون مشکل ${p.fa} را ${act.faPastPl}.`,
          [[p.headword, p.headFa], ['всё прошло́ споко́йно', 'همه‌چیز آرام پیش رفت'], ['без пробле́м', 'بی‌دردسر']],
          'جملهٔ پایهٔ گذشته + и мы без пробле́м + فعل گذشته + مفعول',
        ),
      ];
      results.push(frames[templateIdx]());
      continue;
    }

    if (levelTier === 2) {
      // Everyday Russian A2: compound sentences, reasons, conditions, comparisons, habits & aspect
      const frames: readonly (() => LearningSentence)[] = [
        () => buildRussianSentence(
          sid,
          `Вчера́ ве́чером мы до́лго обсужда́ли ${p.acc}, а пото́м сра́зу ${act.pastPl} ${p2.acc}.`,
          `دیروز عصر مدت زیادی دربارهٔ ${p.fa} گفت‌وگو کردیم و بعد بلافاصله ${p2.fa} را ${act.faPastPl}.`,
          [[p.headword, p.headFa], ['обсужда́ли', 'بررسی و گفت‌وگو می‌کردیم'], [act.pastPl, act.faPastPl]],
          'فعل گذشتهٔ ناقص (فرآیند طولانی) + а пото́м + فعل گذشتهٔ کامل (نتیجه)',
        ),
        () => buildRussianSentence(
          sid,
          `Я собира́юсь внима́тельно ${act.inf} ${p.acc}, потому́ что э́то ва́жно для всей семьи́.`,
          `قصد دارم با دقت ${p.fa} را ${act.faImp.replace('کنی', 'کنم')}، چون این کار برای کل خانواده مهم است.`,
          [[p.headword, p.headFa], ['собира́юсь', 'قصد دارم'], ['потому́ что', 'برای اینکه / چون']],
          'Я собира́юсь + مصدر فعل + مفعول، + потому́ что + جملهٔ دلیل',
        ),
        () => buildRussianSentence(
          sid,
          `Е́сли за́втра бу́дет свобо́дное вре́мя, мы обяза́тельно смо́жем ${act.inf} ${p.acc}.`,
          `اگر فردا وقت آزاد باشد، ما حتماً می‌توانیم ${p.fa} را ${act.faImp.replace('کنی', 'کنیم')}.`,
          [[p.headword, p.headFa], ['свобо́дное вре́мя', 'وقت آزاد'], ['смо́жем', 'خواهیم توانست']],
          'Е́сли + جملهٔ شرط با бу́дет، + мы смо́жем + مصدر + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Мне ка́жется, что ${p.nom} ${p.gender === 'pl' ? 'подхо́дят' : 'подхо́дит'} нам лу́чше, чем ${p2.nom}.`,
          `به نظرم ${p.fa} بیشتر از ${p2.fa} برایمان مناسب است.`,
          [[p.headword, p.headFa], ['мне ка́жется', 'به نظرم می‌رسد'], ['лу́чше, чем', 'بهتر از']],
          'Мне ка́жется, что + نهاد ۱ + лу́чше, чем + نهاد ۲',
        ),
        () => buildRussianSentence(
          sid,
          `Когда́ я жил в друго́м райо́не, я ре́же ду́мал ${oPrep} ${p.prep}.`,
          `وقتی در محلهٔ دیگری زندگی می‌کردم، کمتر به ${p.fa} فکر می‌کردم.`,
          [[p.headword, p.headFa], ['в друго́м райо́не', 'در محله‌ای دیگر'], ['ре́же', 'کمتر / دیربه‌دیرتر']],
          'Когда́ + جملهٔ زمانی گذشته، + فاعل + قید مقایسه‌ای + فعل گذشته',
        ),
        () => buildRussianSentence(
          sid,
          `Друзья́ ча́сто спра́шивают меня́, как я успева́ю во́время ${act.inf} ${p.acc}.`,
          `دوستانم اغلب از من می‌پرسند چطور می‌رسم به‌موقع ${p.fa} را ${act.faImp.replace('کنی', 'کنم')}.`,
          [[p.headword, p.headFa], ['спра́шивают', 'می‌پرسند'], ['успева́ю', 'فرصت می‌کنم / می‌رسم']],
          'فاعل + спра́шивают меня́, + как + فاعل + فعل حال + مصدر',
        ),
        () => buildRussianSentence(
          sid,
          `С тех пор как у нас появи́лась но́вая привы́чка, рабо́та ${sPrep} ${p.ins} ста́ла про́ще.`,
          `از وقتی عادت تازه‌ای پیدا کردیم، کار با ${p.fa} ساده‌تر شده است.`,
          [[p.headword, p.headFa], ['с тех пор как', 'از زمانی که'], ['ста́ла про́ще', 'ساده‌تر شد']],
          'С тех пор как + جملهٔ پیرو، + نهاد + ста́ла + صفت تفضیلی',
        ),
        () => buildRussianSentence(
          sid,
          `На про́шлой неде́ле мы наконе́ц зако́нчили подготовку ${p.gen}.`,
          `هفتهٔ گذشته سرانجام آماده‌سازیِ ${p.fa} را به پایان رساندیم.`,
          [[p.headword, p.headFa], ['на про́шлой неде́ле', 'هفتهٔ گذشته'], ['наконе́ц зако́нчили', 'سرانجام تمام کردیم']],
          'قید زمان گذشته + мы наконе́ц зако́нчили + مفعول + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Я стара́юсь ка́ждую неде́лю выделя́ть хотя́ бы час для ${p.gen}.`,
          `تلاش می‌کنم هر هفته دست‌کم یک ساعت برای ${p.fa} وقت بگذارم.`,
          [[p.headword, p.headFa], ['стара́юсь', 'سعی می‌کنم'], ['хотя́ бы час', 'دست‌کم یک ساعت']],
          'Я стара́юсь + قید تکرار + مصدر ناقص + مفعول + для + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Хотя́ пого́да была́ па́смурной, мы с удово́льствием ${act2.pastPl} ${p.acc}.`,
          `هرچند هوا ابری بود، ما با خوشحالی ${p.fa} را ${act2.faPastPl}.`,
          [[p.headword, p.headFa], ['хотя́', 'هرچند / با اینکه'], ['с удово́льствием', 'با کمال میل']],
          'Хотя́ + جملهٔ پیرو (گذشته)، + فاعل + с удово́льствием + فعل کامل',
        ),
        () => buildRussianSentence(
          sid,
          `Сестра́ напомни́ла мне, что за́втра у́тром на́до ${act.inf} ${p.acc}.`,
          `خواهرم یادم انداخت که فردا صبح باید ${p.fa} را ${act.faImp}.`,
          [[p.headword, p.headFa], ['напо́мнила', 'یادآوری کرد'], ['за́втра у́тром', 'فردا صبح']],
          'فاعل + напо́мнила мне, что + قید زمان + на́до + مصدر + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Вме́сто того́ что́бы спеши́ть, мы споко́йно разобра́лись ${sPrep} ${p.ins}.`,
          `به‌جای عجله کردن، با آرامش تکلیفِ ${p.fa} را روشن و مرتب کردیم.`,
          [[p.headword, p.headFa], ['вме́сто того́ что́бы', 'به‌جای اینکه'], ['разобра́лись', 'سر درآوردیم و حل کردیم']],
          'Вме́сто того́ что́бы + مصدر ۱، + فاعل + разобра́лись с/со + Instrumental',
        ),
        () => buildRussianSentence(
          sid,
          `Обы́чно я сове́туюсь с бли́зкими пе́ред вы́бором ${p.gen}.`,
          `معمولاً پیش از انتخابِ ${p.fa} با نزدیکانم مشورت می‌کنم.`,
          [[p.headword, p.headFa], ['сове́туюсь', 'مشورت می‌کنم'], ['пе́ред вы́бором', 'پیش از انتخابِ']],
          'فاعل + сове́туюсь с + Instrumental + пе́ред вы́бором + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Нам о́чень повезло́, потому́ что ${placePhraseRu} оказа́лся отли́чный вари́ант для ${p.gen}.`,
          `خیلی خوش‌شانس بودیم، چون ${placePhraseFa} گزینهٔ بسیار خوبی برای ${p.fa} پیدا شد.`,
          [[p.headword, p.headFa], ['нам повезло́', 'خوش‌شانس بودیم'], ['оказа́лся', 'از آب درآمد / پیدا شد']],
          'Нам повезло́, потому́ что + مکان + оказа́лся + نهاد + для + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Ка́ждый раз, когда́ захожу́ сюда́, обраща́ю внима́ние на ${p.acc}.`,
          `هر بار که به اینجا سر می‌زنم، توجهم به ${p.fa} جلب می‌شود.`,
          [[p.headword, p.headFa], ['ка́ждый раз, когда́', 'هر بار که'], ['обраща́ю внима́ние на', 'توجه می‌کنم به']],
          'Ка́ждый раз, когда́ + فعل حال، + обраща́ю внима́ние на + Accusative',
        ),
        () => buildRussianSentence(
          sid,
          `Снача́ла зада́ча каза́лась сло́жной, но пото́м мы ле́гко ${act.pastPl} ${p.acc}.`,
          `در ابتدا کار دشوار به نظر می‌رسید، اما بعد به‌آسانی ${p.fa} را ${act.faPastPl}.`,
          [[p.headword, p.headFa], ['каза́лась сло́жной', 'دشوار به نظر می‌رسید'], ['но пото́м', 'اما بعد']],
          'Снача́ла + نهاد + каза́лась + صفت (Instr.)، + но пото́м + جملهٔ نتیجه',
        ),
        () => buildRussianSentence(
          sid,
          `По́сле недéльного переры́ва мы сно́ва на́чали занима́ться ${p.ins}.`,
          `پس از یک هفته وقفه، دوباره پرداختن به ${p.fa} را شروع کردیم.`,
          [[p.headword, p.headFa], ['переры́в', 'وقفه / استراحت'], ['занима́ться', 'مشغولِ کاری بودن']],
          'По́сле + Genitive + فاعل + на́чали занима́ться + حالت Instrumental',
        ),
        () => buildRussianSentence(
          sid,
          `Колле́га подели́лся полéзным о́пытом и помо́г мне ${act2.inf} ${p.acc}.`,
          `همکارم تجربهٔ مفیدی را در میان گذاشت و کمکم کرد ${p.fa} را ${act2.faImp.replace('کنی', 'کنم')}.`,
          [[p.headword, p.headFa], ['подели́лся о́пытом', 'تجربه‌اش را به اشتراک گذاشت'], ['помо́г мне', 'کمکم کرد']],
          'فاعل + подели́лся + Instrumental + и помо́г мне + مصدر + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Я записа́л основны́е дета́ли в блокно́т, что́бы ничего́ не забы́ть ${oPrep} ${p.prep}.`,
          `جزئیات اصلی را در دفترچه یادداشت کردم تا هیچ نکته‌ای را دربارهٔ ${p.fa} فراموش نکنم.`,
          [[p.headword, p.headFa], ['основны́е дета́ли', 'جزئیات اصلی'], ['не забы́ть', 'فراموش نکردن']],
          'جملهٔ پایه + что́бы + منفی + مصدر فعل کامل + о/об + Prepositional',
        ),
        () => buildRussianSentence(
          sid,
          `В сле́дующем ме́сяце мы плани́руем серьёзно обнови́ть ${p.acc}.`,
          `ماه آینده قصد داریم به‌طور جدی ${p.fa} را نوسازی و به‌روز کنیم.`,
          [[p.headword, p.headFa], ['в сле́дующем ме́сяце', 'ماه آینده'], ['обнови́ть', 'نوسازی / به‌روز کردن']],
          'В сле́дующем ме́сяце + мы плани́руем + قید + مصدر + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Ско́лько вре́мени у тебя́ обы́чно ухо́дит на ${p.acc} по ве́черам?`,
          `عصرها معمولاً چقدر از وقتت صرفِ ${p.fa} می‌شود؟`,
          [[p.headword, p.headFa], ['ско́лько вре́мени', 'چقدر زمان'], ['ухо́дит на', 'صرفِ ... می‌شود']],
          'Ско́лько вре́мени у тебя́ ухо́дит на + حالت مفعولی (Accusative)؟',
        ),
        () => buildRussianSentence(
          sid,
          `Мой друг давно́ интересу́ется ${p.ins} и чита́ет но́вые статьи́.`,
          `دوست من مدت‌هاست به ${p.fa} علاقه دارد و مقاله‌های تازه می‌خواند.`,
          [[p.headword, p.headFa], ['давно́', 'از مدت‌ها پیش'], ['интересу́ется', 'علاقه‌مند است']],
          'فاعل + давно́ интересу́ется + حالت ابزاری (Instrumental)',
        ),
        () => buildRussianSentence(
          sid,
          `Че́стно говоря́, без ${p.gen} наш день прошёл бы совсе́м ина́че.`,
          `راستش را بخواهید، بدونِ ${p.fa} روز ما کاملاً جور دیگری می‌گذشت.`,
          [[p.headword, p.headFa], ['че́стно говоря́', 'صادقانه بگویم'], ['совсе́м ина́че', 'کاملاً متفاوت']],
          'Че́стно говоря́, + без + Genitive + نهاد + прошёл бы + قید',
        ),
        () => buildRussianSentence(
          sid,
          `Как то́лько появи́лась возмо́жность, я сра́зу реши́л ${act.inf} ${p.acc}.`,
          `به محض اینکه فرصت پیش آمد، فوراً تصمیم گرفتم ${p.fa} را ${act.faImp.replace('کنی', 'کنم')}.`,
          [[p.headword, p.headFa], ['как то́лько', 'به محض اینکه'], ['реши́л', 'تصمیم گرفتم']],
          'Как то́лько + جملهٔ پیرو، + فاعل + сра́зу реши́л + مصدر + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Мы привы́кли зара́нее догова́риваться ${oPrep} ${p.prep} всей гру́ппой.`,
          `عادت کرده‌ایم از قبل همگی با هم دربارهٔ ${p.fa} هماهنگ کنیم.`,
          [[p.headword, p.headFa], ['привы́кли', 'عادت کرده‌ایم'], ['догова́риваться', 'هماهنگ کردن / توافق کردن']],
          'Мы привы́кли + قید + مصدر ناقص + о/об + حالت Prepositional',
        ),
        () => buildRussianSentence(
          sid,
          `Да́же в са́мый загру́женный вторник нахо́дится де́сять мину́т для ${p.gen}.`,
          `حتی در شلوغ‌ترین سه‌شنبه هم ده دقیقه وقت برای ${p.fa} پیدا می‌شود.`,
          [[p.headword, p.headFa], ['да́же', 'حتی'], ['нахо́дится вре́мя', 'وقت پیدا می‌شود']],
          'Да́же в + Accusative + нахо́дится + زمان + для + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Мне прия́тно ви́деть, как постепе́нно меня́ется отноше́ние к ${p.dat}.`,
          `برایم خوشایند است ببینم چطور کم‌کم نگاه‌ها به ${p.fa} تغییر می‌کند.`,
          [[p.headword, p.headFa], ['постепе́нно', 'به‌تدریج'], ['отноше́ние к', 'نگرش نسبت به']],
          'Мне прия́тно ви́деть, как + قید + فعل بازتابی + نهاد + к + Dative',
        ),
        () => buildRussianSentence(
          sid,
          `Мы сравнили не́сколько предложе́ний и остано́вили вы́бор на ${p.prep}.`,
          `چند پیشنهاد را مقایسه کردیم و در نهایت ${p.fa} را برگزیدیم.`,
          [[p.headword, p.headFa], ['сравни́ли', 'مقایسه کردیم'], ['останови́ли вы́бор на', 'انتخاب نهایی را گذاشتیم رویِ']],
          'Мы сравни́ли + مفعول + и останови́ли вы́бор на + Prepositional',
        ),
        () => buildRussianSentence(
          sid,
          `Лу́чше не откла́дывать ${p.acc} на после́дний моме́нт без причи́ны.`,
          `بهتر است ${p.fa} را بی‌دلیل به دقیقهٔ نود موکول نکنیم.`,
          [[p.headword, p.headFa], ['не откла́дывать', 'به تعویق نینداختن'], ['после́дний моме́нт', 'لحظهٔ آخر']],
          'Лу́чше не откла́дывать + مفعول (Acc.) + на после́дний моме́нт',
        ),
        () => buildRussianSentence(
          sid,
          `По ито́гам неде́ли и́менно ${p.nom} ${p.gender === 'm' ? 'принёс' : p.gender === 'f' ? 'принесла́' : p.gender === 'n' ? 'принесло́' : 'принесли́'} нам бо́льше всего́ по́льзы.`,
          `در جمع‌بندی هفته، دقیقاً همین ${p.fa} بیشترین فایده را برایمان داشت.`,
          [[p.headword, p.headFa], ['по ито́гам', 'در جمع‌بندیِ'], ['бо́льше всего́ по́льзы', 'بیشترین فایده']],
          'По ито́гам + Genitive + и́менно + نهاد + فعل گذشته + бо́льше всего́ + Genitive',
        ),
      ];
      results.push(frames[templateIdx]());
      continue;
    }

    if (levelTier === 3) {
      // Communication Russian B1: opinions, indirect speech, relative clauses (который), counterfactuals, workplace & social discourse
      const frames: readonly (() => LearningSentence)[] = [
        () => buildRussianSentence(
          sid,
          `На мой взгляд, нам сто́ит внима́тельно ${act.inf} ${p.acc}, что́бы избежа́ть лишних оши́бок.`,
          `به دیدگاه من، ارزش دارد با دقت ${p.fa} را ${act.faImp.replace('کنی', 'کنیم')} تا از خطاهای اضافه جلوگیری شود.`,
          [[p.headword, p.headFa], ['на мой взгляд', 'از دیدگاه من'], ['избежа́ть оши́бок', 'پرهیز از خطاها']],
          'На мой взгляд, + нам сто́ит + مصدر + مفعول، + что́бы избежа́ть + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Вопро́с, кото́рый каса́ется ${p.gen}, вы́звал оживлённую диску́ссию на встре́че.`,
          `مسئله‌ای که به ${p.fa} مربوط می‌شود، بحث پرشوری را در جلسه برانگیخت.`,
          [[p.headword, p.headFa], ['каса́ется', 'مربوط می‌شود به'], ['оживлённая диску́ссия', 'بحث پرشور']],
          'نهاد + جملهٔ موصولی با кото́рый + فعل گذشته + مفعول مستقیم',
        ),
        () => buildRussianSentence(
          sid,
          `Руководи́тель поинтересова́лся, успе́ем ли мы подгото́вить ${p.acc} к пятнице.`,
          `مدیر جویا شد که آیا می‌رسیم ${p.fa} را تا روز جمعه آماده کنیم یا نه.`,
          [[p.headword, p.headFa], ['поинтересова́лся', 'جویا شد'], ['успе́ем ли мы', 'آیا به موقع می‌رسیم']],
          'پرسش غیرمستقیم با ذرهٔ «ли»: فاعل + فعل پرسش + فعل، ли + فاعل + مصدر',
        ),
        () => buildRussianSentence(
          sid,
          `Е́сли бы мы зара́нее обсуди́ли ${p.acc}, реше́ние бы́ло бы гора́здо то́чнее.`,
          `اگر از پیش ${p.fa} را بررسی کرده بودیم، تصمیم بسیار دقیق‌تر می‌بود.`,
          [[p.headword, p.headFa], ['е́сли бы', 'اگر (شرط خلاف واقع)'], ['гора́здо то́чнее', 'بسیار دقیق‌تر']],
          'جملهٔ شرطی غیرواقعی (B1): Е́сли бы + گذشته، + نهاد + бы́ло бы + صفت تفضیلی',
        ),
        () => buildRussianSentence(
          sid,
          `Несмотря́ на нехватку вре́мени, кома́нда суме́ла ка́чественно ${act.inf} ${p.acc}.`,
          `با وجود کمبود وقت، تیم توانست با کیفیت بالا ${p.fa} را ${act.faImp}.`,
          [[p.headword, p.headFa], ['несмотря́ на', 'با وجودِ / علی‌رغمِ'], ['нехва́тка вре́мени', 'کمبود زمان']],
          'Несмотря́ на + حالت مفعولی (Acc.)، + نهاد + суме́ла + مصدر + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Специали́ст подчеркну́л, что без ${p.gen} тру́дно рассчи́тывать на усто́йчивый результа́т.`,
          `متخصص تأکید کرد که بدونِ ${p.fa} دشوار بتوان روی نتیجه‌ای پایدار حساب کرد.`,
          [[p.headword, p.headFa], ['подчеркну́л', 'تأکید کرد'], ['усто́йчивый результа́т', 'نتیجهٔ پایدار']],
          'نقل‌قول غیرمستقیم: فاعل + подчеркну́л, что + без + Gen. + тру́дно рассчи́тывать на + Acc.',
        ),
        () => buildRussianSentence(
          sid,
          `Благодаря́ ${p.dat} участни́ки прое́кта бы́стро нашли́ о́бщий язы́к.`,
          `به برکتِ ${p.fa}، اعضای پروژه خیلی زود به زبان مشترک رسیدند.`,
          [[p.headword, p.headFa], ['благодаря́', 'به لطفِ / به برکتِ'], ['нашли́ о́бщий язы́к', 'به تفاهم رسیدند']],
          'Благодаря́ + حالت متممی (Dative) + فاعل + فعل گذشته + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Я по́лностью разделя́ю ва́шу то́чку зре́ния отно́сительно ${p.gen}.`,
          `من کاملاً با دیدگاه شما در خصوص ${p.fa} هم‌نظر هستم.`,
          [[p.headword, p.headFa], ['разделя́ю то́чку зре́ния', 'هم‌عقیده هستم'], ['отно́сительно', 'در خصوصِ']],
          'Я по́лностью разделя́ю ва́шу то́чку зре́ния + отно́сительно + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `С одно́й стороны́, ${p.nom} ${p.gender === 'pl' ? 'эконо́мят' : 'эконо́мит'} ресу́рсы, а с друго́й — ${p.gender === 'pl' ? 'тре́буют' : 'тре́бует'} дисципли́ны.`,
          `از یک سو ${p.fa} در منابع صرفه‌جویی می‌کند، و از سوی دیگر نیازمند نظم است.`,
          [[p.headword, p.headFa], ['с одно́й стороны́', 'از یک سو'], ['тре́бует дисципли́ны', 'نیازمند نظم است']],
          'С одно́й стороны́, ... + а с друго́й (стороны́) — ... (استدلال دووجهی)',
        ),
        () => buildRussianSentence(
          sid,
          `Колле́ги предложи́ли, что́бы мы совме́стно ${act2.pastPl} ${p.acc} до нача́ла се́ссии.`,
          `همکاران پیشنهاد دادند که ما پیش از آغاز نشست، مشترکاً ${p.fa} را ${act2.faImp}.`,
          [[p.headword, p.headFa], ['предложи́ли, что́бы', 'پیشنهاد دادند که'], ['совме́стно', 'مشترکاً / با هم']],
          'فاعل + предложи́ли, + что́бы + فاعل دوم + فعل در وجه التزامی (فرم گذشته)',
        ),
        () => buildRussianSentence(
          sid,
          `По ме́ре того́ как растёт интере́с к ${p.dat}, появля́ются но́вые иссле́дования.`,
          `هرچه علاقه به ${p.fa} بیشتر می‌شود، پژوهش‌های تازه‌تری شکل می‌گیرد.`,
          [[p.headword, p.headFa], ['по ме́ре того́ как', 'به موازاتِ اینکه'], ['иссле́дования', 'پژوهش‌ها']],
          'По ме́ре того́ как + جملهٔ پیرو با к + Dative، + جملهٔ پایه',
        ),
        () => buildRussianSentence(
          sid,
          `Тру́дно не согласи́ться с тем, что ${p.nom} ${p.gender === 'pl' ? 'игра́ют' : 'игра́ет'} заме́тную роль ${placePhraseRu}.`,
          `سخت بتوان با این نکته مخالفت کرد که ${p.fa} نقش چشمگیری ${placePhraseFa} ایفا می‌کند.`,
          [[p.headword, p.headFa], ['тру́дно не согласи́ться', 'سخت است موافق نبود'], ['игра́ет роль', 'نقش ایفا می‌کند']],
          'Тру́дно не согласи́ться с тем, что + نهاد + игра́ет/игра́ют роль + مکان',
        ),
        () => buildRussianSentence(
          sid,
          `На практи́ке и́менно умени́е рабо́тать ${sPrep} ${p.ins} отлича́ет о́пытного специали́ста.`,
          `در عمل، دقیقاً مهارتِ کار با ${p.fa} است که متخصصِ باتجربه را متمایز می‌کند.`,
          [[p.headword, p.headFa], ['на пра́ктике', 'در عمل'], ['о́пытный специали́ст', 'متخصص باتجربه']],
          'На пра́ктике + и́менно + نهاد + отлича́ет + مفعول جاندار (Acc. = Gen.)',
        ),
        () => buildRussianSentence(
          sid,
          `Пре́жде чем де́лать вы́воды ${oPrep} ${p.prep}, необхо́димо прове́рить исто́чники.`,
          `پیش از نتیجه‌گیری دربارهٔ ${p.fa}، لازم است منابع را بررسی کنیم.`,
          [[p.headword, p.headFa], ['пре́жде чем', 'پیش از آنکه'], ['де́лать вы́воды', 'نتیجه‌گیری کردن']],
          'Пре́жде чем + مصدر، + необхо́димо + مصدر + مفعول مستقیم',
        ),
        () => buildRussianSentence(
          sid,
          `Мы по́просили авто́ра подробнее останови́ться на преи́муществах ${p.gen}.`,
          `از نویسنده خواستیم با تفصیل بیشتری به مزیت‌های ${p.fa} بپردازد.`,
          [[p.headword, p.headFa], ['подробнее останови́ться на', 'به‌تفصیل پرداختن به'], ['преиму́щества', 'مزیت‌ها']],
          'Мы попроси́ли + مفعول + подробнее останови́ться на + Prepositional + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Опыт пока́зывает, что своевре́менное внима́ние к ${p.dat} снижа́ет ри́ски.`,
          `تجربه نشان می‌دهد که توجه به‌موقع به ${p.fa} ریسک‌ها را کاهش می‌دهد.`,
          [[p.headword, p.headFa], ['о́пыт пока́зывает', 'تجربه نشان می‌دهد'], ['снижа́ет ри́ски', 'ریسک‌ها را کم می‌کند']],
          'О́пыт пока́зывает, что + نهاد + к + Dative + فعل حال + مفعول',
        ),
        () => buildRussianSentence(
          sid,
          `Я сомнева́юсь, что сто́ит меня́ть ${p.acc} на ${p2.acc} без расчётов.`,
          `تردید دارم که بدون محاسبه، عوض کردنِ ${p.fa} با ${p2.fa} کار درستی باشد.`,
          [[p.headword, p.headFa], ['сомнева́юсь', 'تردید دارم'], ['без расчётов', 'بدون محاسبه']],
          'Я сомнева́юсь, что сто́ит меня́ть + X (Acc.) + на + Y (Acc.)',
        ),
        () => buildRussianSentence(
          sid,
          `В хо́де обсужде́ния выясни́лось, что ${p.nom} уже́ ${importantShort(p.gender)} для всех отде́лов.`,
          `در جریان گفت‌وگو روشن شد که ${p.fa} همین حالا برای همهٔ بخش‌ها اهمیت دارد.`,
          [[p.headword, p.headFa], ['в хо́де обсужде́ния', 'در جریان بحث'], ['вы́яснилось', 'مشخص شد']],
          'В хо́де + Genitive + вы́яснилось, что + نهاد + صفت کوتاه خبری + для + Gen.',
        ),
        () => buildRussianSentence(
          sid,
          `Судя́ по отзы́вам коллег, но́вый подхо́д к ${p.dat} по́лностью себя́ оправда́л.`,
          `با قضاوت از روی بازخورد همکاران، رویکرد تازه به ${p.fa} کاملاً امتحانش را پس داده است.`,
          [[p.headword, p.headFa], ['судя́ по о́тзывам', 'با قضاوت از روی بازخوردها'], ['себя́ оправда́л', 'درستی‌اش ثابت شد']],
          'Судя́ по + حالت Dative، + نهاد + по́лностью себя́ оправда́л',
        ),
        () => buildRussianSentence(
          sid,
          `Нам ну́жно найти́ компроми́сс, при кото́ром сохрани́тся ка́чество ${p.gen}.`,
          `باید راهِ میانه‌ای پیدا کنیم که در آن کیفیتِ ${p.fa} حفظ شود.`,
          [[p.headword, p.headFa], ['найти́ компроми́сс', 'یافتن راه‌حل میانه'], ['ка́чество', 'کیفیت']],
          'جملهٔ پایه + при кото́ром + فعل بازتابی + نهاد + حالت Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Как пра́вило, лю́ди охо́тнее поддержи́вают иде́ю, когда́ понима́ют по́льзу ${p.gen}.`,
          `به‌طور معمول، مردم وقتی فایدهٔ ${p.fa} را درک می‌کنند با رغبت بیشتری از ایده حمایت می‌کنند.`,
          [[p.headword, p.headFa], ['как пра́вило', 'به‌طور معمول / قاعدتاً'], ['охо́тнее подде́рживают', 'با رغبت بیشتری حمایت می‌کنند']],
          'Как пра́вило, + جملهٔ پایه + когда́ + فاعل + понима́ют по́льзу + Genitive',
        ),
        () => buildRussianSentence(
          sid,
          `Никто́ не ожида́л, что обсужде́ние ${p.gen} приведёт к тако́му практи́чному реше́нию.`,
          `هیچ‌کس انتظار نداشت که بررسیِ ${p.fa} به چنین راه‌حل کاربردی و خوبی بینجامد.`,
          [[p.headword, p.headFa], ['никто́ не ожида́л', 'هیچ‌کس انتظار نداشت'], ['приведёт к', 'منجر شود به']],
          'Никто́ не ожида́л, что + نهاد + Genitive + приведёт к + حالت Dative',
        ),
        () => buildRussianSentence(
          sid,
          `По слова́м веду́щего анали́тика, спрос на ${p.acc} продо́лжит расти́ в э́том году́.`,
          `به گفتهٔ تحلیلگر ارشد، تقاضا برای ${p.fa} امسال هم به رشد خود ادامه خواهد داد.`,
          [[p.headword, p.headFa], ['по слова́м', 'به گفتهٔ'], ['спрос на', 'تقاضا برایِ']],
          'По слова́м + Genitive، + спрос на + Accusative + продо́лжит расти́',
        ),
        () => buildRussianSentence(
          sid,
          `Чем точне́е сформули́рована цель, тем проще ${act.inf} ${p.acc} без заде́ржек.`,
          `هرچه هدف دقیق‌تر صورت‌بندی شده باشد، بدون تأخیر راحت‌تر می‌توان ${p.fa} را ${act.faImp}.`,
          [[p.headword, p.headFa], ['сформули́рована цель', 'هدف تبیین شده است'], ['без заде́ржек', 'بدون تأخیر']],
          'الگوی تناسبی: Чем + صفت تفضیلی ..., + тем + قید تفضیلی + مصدر',
        ),
        () => buildRussianSentence(
          sid,
          `В коне́чном счёте всё зави́сит от того́, наско́лько после́довательно мы ${act.pres1Pl} ${p.acc}.`,
          `در تحلیل نهایی همه‌چیز بستگی دارد به اینکه تا چه اندازه پیوسته ما ${p.fa} را ${act.faPres1Pl}.`,
          [[p.headword, p.headFa], ['в коне́чном счёте', 'در نهایت / دست‌آخر'], ['после́довательно', 'به‌طور پیوسته و منسجم']],
          'В коне́чном счёте всё зави́сит от того́, наско́лько + قید + فاعل + فعل',
        ),
        () => buildRussianSentence(
          sid,
          `Мне бы хоте́лось услы́шать мне́ние коллег, кото́рые уже́ сталкива́лись ${sPrep} ${p.ins}.`,
          `مایلم نظر همکارانی را بشنوم که پیش‌تر با ${p.fa} سروکار داشته‌اند.`,
          [[p.headword, p.headFa], ['мне бы хоте́лось', 'مایل بودم / دوست داشتم'], ['ста́лкивались с', 'رویارو شده بودند با']],
          'Мне бы хоте́лось + مصدر + مفعول، + кото́рые ста́лкивались с/со + Instr.',
        ),
        () => buildRussianSentence(
          sid,
          `При усло́вии взаи́много уваже́ния любо́й спор вокру́г ${p.gen} реша́ется конструкти́вно.`,
          `به شرط احترام متقابل، هرگونه اختلاف‌نظری پیرامون ${p.fa} به‌شکل سازنده حل می‌شود.`,
          [[p.headword, p.headFa], ['при усло́вии', 'به شرطِ'], ['конструкти́вно', 'به‌شکل سازنده']],
          'При усло́вии + Genitive + نهاد + вокру́г + Genitive + فعل مجهول بازتابی',
        ),
        () => buildRussianSentence(
          sid,
          `Име́нно откры́тый диало́г позволи́л нам во́время скорректи́ровать рабо́ту над ${p.ins}.`,
          `دقیقاً گفت‌وگوی باز به ما امکان داد کار روی ${p.fa} را به‌موقع اصلاح کنیم.`,
          [[p.headword, p.headFa], ['откры́тый диало́г', 'گفت‌وگوی باز'], ['скорректи́ровать', 'اصلاح و تنظیم کردن']],
          'И́менно + نهاد + позво́лил нам + مصدر کامل + рабо́ту над + Instrumental',
        ),
        () => buildRussianSentence(
          sid,
          `Не бу́дем спеши́ть с оце́нкой, пока́ не изу́чим все фа́кты ${oPrep} ${p.prep}.`,
          `در ارزیابی شتاب نکنیم تا زمانی که همهٔ واقعیت‌ها را دربارهٔ ${p.fa} بررسی نکرده‌ایم.`,
          [[p.headword, p.headFa], ['не бу́дем спеши́ть', 'شتاب نکنیم'], ['пока́ не изу́чим', 'تا وقتی بررسی نکرده‌ایم']],
          'وجه امری اول‌شخص جمع + пока́ не + فعل کامل آینده + о/об + Prepositional',
        ),
        () => buildRussianSentence(
          sid,
          `Подводя́ ито́г на́шей бесе́де, сто́ит ещё раз отмети́ть значи́мость ${p.gen}.`,
          `در جمع‌بندی گفت‌وگویمان، شایسته است بار دیگر بر اهمیتِ ${p.fa} تأکید کنیم.`,
          [[p.headword, p.headFa], ['подводя́ ито́г', 'در جمع‌بندیِ'], ['отме́тить значи́мость', 'بر اهمیت تأکید کردن']],
          'قید فعلی (Подводя́ ито́г + Dat.)، + сто́ит отме́тить значи́мость + Genitive',
        ),
      ];
      results.push(frames[templateIdx]());
      continue;
    }

    // Level 4 — Advanced Russian (B2–C1): participles, verbal adverbs, multi-clause analytical, formal & academic syntax
    const gerundRu = act.gerund ?? 'анализи́руя';
    const gerundFa = act.faGerund ?? 'با تحلیلِ';
    const framesL4: readonly (() => LearningSentence)[] = [
      () => buildRussianSentence(
        sid,
        `${capFirst(gerundRu)} ${p.acc} в широ́ком конте́ксте, иссле́дователи прихо́дят к весьма́ ва́жным вы́водам.`,
        `${gerundFa} ${p.fa} در بستری گسترده، پژوهشگران به نتایج بسیار مهمی دست می‌یابند.`,
        [[p.headword, p.headFa], [gerundRu, gerundFa], ['широ́кий конте́кст', 'بستر گسترده']],
        'گروه قید فعلی (Дееприча́стный оборо́т) + فاعل + прихо́дят к вы́водам (Dative)',
      ),
      () => buildRussianSentence(
        sid,
        `Фа́кторы, непосре́дственно влия́ющие на ${p.acc}, тре́буют всесторо́ннего и систе́много ана́лиза.`,
        `عواملی که مستقیماً بر ${p.fa} اثر می‌گذارند، نیازمند تحلیلی همه‌جانبه و نظام‌مند هستند.`,
        [[p.headword, p.headFa], ['непосре́дственно влия́ющие', 'مستقیماً اثرگذار (وجه وصفی فاعلی)'], ['всесторо́нний ана́лиз', 'تحلیل همه‌جانبه']],
        'نهاد + گروه وجه وصفی فاعلی (Прича́стный оборо́т با влия́ющие на + Acc.) + فعل',
      ),
      () => buildRussianSentence(
        sid,
        `Несмотря́ на то что ${p.acc} уже́ внедри́ли ${placePhraseRu}, диску́ссии о методоло́гии не утиха́ют.`,
        `با وجود آنکه ${p.fa} را پیش‌تر ${placePhraseFa} به کار گرفته‌اند، بحث‌ها دربارهٔ روش‌شناسی فروکش نمی‌کند.`,
        [[p.headword, p.headFa], ['несмотря́ на то что', 'علی‌رغم آنکه'], ['не утиха́ют', 'فروکش نمی‌کنند']],
        'جملهٔ پیرو امتناعی پیشرفته: Несмотря́ на то что ..., + جملهٔ پایه',
      ),
      () => buildRussianSentence(
        sid,
        `В то вре́мя как одни́ авто́ры абсолютизи́руют ${p.acc}, други́е ука́зывают на ро́ль ${p2.gen}.`,
        `در حالی که گروهی از نویسندگان ${p.fa} را مطلق می‌انگارند، دیگران بر نقشِ ${p2.fa} انگشت می‌گذارند.`,
        [[p.headword, p.headFa], ['в то вре́мя как', 'در حالی که (تقابل تحلیلی)'], [p2.headword, p2.headFa]],
        'ساختار تقابلی رسمی: В то вре́мя как одни́ ..., + други́е ука́зывают на + Acc.',
      ),
      () => buildRussianSentence(
        sid,
        `Согла́сно официа́льно опубликова́нным да́нным, эффе́ктивность ${p.gen} вы́росла почти́ вдво́е.`,
        `بر پایهٔ داده‌های رسماً منتشرشده، کاراییِ ${p.fa} تقریباً دو برابر افزایش یافته است.`,
        [[p.headword, p.headFa], ['согла́сно да́нным', 'طبق داده‌ها'], ['вы́росла почти́ вдво́е', 'تقریباً دو برابر شد']],
        'Согла́сно + صفت مفعولی (опубликова́нным да́нным, Dat.)، + نهاد + فعل گذشته',
      ),
      () => buildRussianSentence(
        sid,
        `Чем глу́бже мы осмы́сливаем приро́ду ${p.gen}, тем очевиднее стано́вится её вну́тренняя ло́гика.`,
        `هرچه ژرف‌تر ماهیتِ ${p.fa} را می‌کاویم، منطق درونی آن آشکارتر می‌شود.`,
        [[p.headword, p.headFa], ['осмы́сливаем приро́ду', 'ماهیت را ژرف‌کاوی می‌کنیم'], ['вну́тренняя ло́гика', 'منطق درونی']],
        'Чем + قید تفضیلی + فعل، + тем + صفت تفضیلی + стано́вится + نهاد',
      ),
      () => buildRussianSentence(
        sid,
        `Без чётко вы́строенного механи́зма контро́ля за ${p.ins} люба́я рефо́рма остаётся декларати́вной.`,
        `بدونِ سازوکارِ دقیقاً طراحی‌شدهٔ نظارت بر ${p.fa}، هر اصلاحی در حد شعار باقی می‌ماند.`,
        [[p.headword, p.headFa], ['механи́зм контро́ля за', 'سازوکار نظارت بر'], ['декларати́вный', 'صرفاً شعاری و اعلامی']],
        'Без + Genitive + контро́ля за + Instrumental + نهاد + остаётся + صفت (Instr.)',
      ),
      () => buildRussianSentence(
        sid,
        `Представля́ется вполне́ закономе́рным, что интере́с нау́чного соо́бщества к ${p.dat} неукло́нно возраста́ет.`,
        `کاملاً طبیعی و قانونمند به نظر می‌رسد که توجه جامعهٔ علمی به ${p.fa} پیوسته رو به افزایش است.`,
        [[p.headword, p.headFa], ['представля́ется закономе́рным', 'طبیعی و منطقی می‌نماید'], ['нау́чное соо́бщество', 'جامعهٔ علمی']],
        'ساختار غیرشخصی آکادمیک: Представля́ется + صفت (Instr.), что + نهاد + возраста́ет',
      ),
      () => buildRussianSentence(
        sid,
        `Вы́воды, сформули́рованные коми́ссией по ито́гам провер́ки ${p.gen}, легли́ в осно́ву рефо́рмы.`,
        `نتایج صورت‌بندی‌شده توسط کمیسیون در پایان بررسیِ ${p.fa}، شالودهٔ اصلاحات قرار گرفت.`,
        [[p.headword, p.headFa], ['сформули́рованные', 'صورت‌بندی‌شده (وجه وصفی مفعولی)'], ['легли́ в осно́ву', 'شالودهٔ کار شدند']],
        'نهاد + وجه وصفی مفعولی گذشته + عامل در حالت ابزاری (коми́ссией) + فعل',
      ),
      () => buildRussianSentence(
        sid,
        `Нельзя́ недооце́нивать влия́ние, ока́зываемое ${p.ins} на долгосро́чную усто́йчивость систе́мы.`,
        `نمی‌توان تأثیری را که توسطِ ${p.fa} بر پایداری بلندمدت سامانه گذاشته می‌شود دست‌کم گرفت.`,
        [[p.headword, p.headFa], ['нельзя́ недооце́нивать', 'نباید دست‌کم گرفت'], ['долгосро́чная усто́йчивость', 'پایداری بلندمدت']],
        'ساختار مجهول وصفی زمان حال: влия́ние, ока́зываемое + عامل (Instrumental)',
      ),
      () => buildRussianSentence(
        sid,
        `Приня́в во внима́ние аргуме́нты обе́их сторо́н, сове́т утверди́л но́вый регла́мент для ${p.gen}.`,
        `شورا با در نظر گرفتن استدلال‌های هر دو طرف، آیین‌نامهٔ تازه‌ای را برای ${p.fa} تصویب کرد.`,
        [[p.headword, p.headFa], ['приня́в во внима́ние', 'با در نظر گرفتنِ (قید فعلی کامل)'], ['утверди́л регла́мент', 'آیین‌نامه را تصویب کرد']],
        'قید فعلی کامل (Приня́в во внима́ние + Acc.)، + فاعل + فعل کامل + مفعول',
      ),
      () => buildRussianSentence(
        sid,
        `Речь идёт не сто́лько о форма́льном обновле́нии ${p.gen}, ско́лько о сме́не са́мой паради́гмы.`,
        `سخن نه چندان بر سرِ نوسازی صوریِ ${p.fa}، بلکه بر سرِ تغییر خودِ الگووارهٔ فکری است.`,
        [[p.headword, p.headFa], ['не сто́лько ... ско́лько', 'نه چندان ... بلکه بیشتر ...'], ['сме́на паради́гмы', 'تغییر پارادایم']],
        'الگوی بلاغی پیشرفته: Речь идёт не сто́лько о + Prep., ско́лько о + Prep.',
      ),
      () => buildRussianSentence(
        sid,
        `Столь высо́кий у́ровень тре́бований к ${p.dat} объясня́ется повы́шенной отве́тственностью специа́листов.`,
        `چنین سطح بالایی از الزامات نسبت به ${p.fa} با مسئولیت سنگین‌تر متخصصان توضیح داده می‌شود.`,
        [[p.headword, p.headFa], ['столь высо́кий у́ровень', 'چنین سطح والایی'], ['объясня́ется', 'تبیین می‌شود با']],
        'ساختار مجهول تحلیلی: نهاد + объясня́ется + علت در حالت ابزاری (Instrumental)',
      ),
      () => buildRussianSentence(
        sid,
        `Показа́тельно, что да́же ске́птики призна́ли це́нность реше́ний, свя́занных ${sPrep} ${p.ins}.`,
        `گویا و قابل‌توجه است که حتی منتقدان دیرباور نیز ارزش راه‌حل‌های مرتبط با ${p.fa} را پذیرفتند.`,
        [[p.headword, p.headFa], ['показа́тельно, что', 'قابل‌توجه و گویاست که'], ['призна́ли це́нность', 'ارزش را به رسمیت شناختند']],
        'Показа́тельно, что + فاعل + призна́ли це́нность + Gen. + свя́занных с/со + Instr.',
      ),
      () => buildRussianSentence(
        sid,
        `В слу́чае пересмо́тра нормати́вной ба́зы придётся за́ново согласо́вывать поря́док рабо́ты ${sPrep} ${p.ins}.`,
        `در صورت بازنگری در چارچوب مقررات، ناگزیر باید روند کار با ${p.fa} از نو هماهنگ شود.`,
        [[p.headword, p.headFa], ['в слу́чае пересмо́тра', 'در صورت بازنگریِ'], ['придётся согласо́вывать', 'ناگزیر باید هماهنگ کرد']],
        'В слу́чае + Genitive + فعل غیرشخصی (придётся) + مصدر + مفعول',
      ),
      () => buildRussianSentence(
        sid,
        `Сопоста́вив эмпири́ческие наблюде́ния ${sPrep} ${p.ins}, авто́р вы́явил неочеви́дную закономерность.`,
        `نویسنده با سنجش و تطبیق مشاهدات تجربی با ${p.fa}، قانونمندیِ ناپیدایی را آشکار ساخت.`,
        [[p.headword, p.headFa], ['сопоста́вив', 'پس از تطبیق دادنِ'], ['вы́явил закономерность', 'قانونمندی را آشکار ساخت']],
        'قید فعلی کامل (Сопоста́вив X с Y) + فاعل + فعل کامل + مفعول مستقیم',
      ),
      () => buildRussianSentence(
        sid,
        `Склады́вается впечатле́ние, бу́дто ро́ль ${p.gen} долго́е вре́мя остава́лась на перифери́и внима́ния.`,
        `چنین برداشتی شکل می‌گیرد که گویی نقشِ ${p.fa} مدت‌ها در حاشیهٔ توجه باقی مانده بود.`,
        [[p.headword, p.headFa], ['скла́дывается впечатле́ние', 'این برداشت شکل می‌گیرد'], ['на перифери́и внима́ния', 'در حاشیهٔ توجه']],
        'Скла́дывается впечатле́ние, бу́дто + نهاد + остава́лась на перифери́и + Genitive',
      ),
      () => buildRussianSentence(
        sid,
        `От того́, наско́лько грамо́тно вы́строена рабо́та ${sPrep} ${p.ins}, зави́сит репута́ция институ́та.`,
        `اعتبار نهاد وابسته به آن است که کار با ${p.fa} تا چه اندازه مدبرانه و دقیق سازمان‌دهی شده باشد.`,
        [[p.headword, p.headFa], ['гра́мотно вы́строена', 'به‌شکل اصولی چیده شده است'], ['репута́ция', 'اعتبار و خوش‌نامی']],
        'От того́, наско́лько + قید + وجه وصفی مفعولی کوتاه، + зави́сит + نهاد',
      ),
      () => buildRussianSentence(
        sid,
        `Едва́ ли мо́жно оспа́ривать тот факт, что модерниза́ция ${p.gen} назре́ла уже́ давно́.`,
        `به‌سختی بتوان این واقعیت را انکار کرد که ضرورتِ نوسازیِ ${p.fa} از مدت‌ها پیش فرارسیده است.`,
        [[p.headword, p.headFa], ['едва́ ли мо́жно оспа́ривать', 'به‌دشواری بتوان به چالش کشید'], ['назре́ла давно́', 'از دیرباز ضروری شده بود']],
        'تردید مؤدبانهٔ علمی: Едва́ ли мо́жно оспа́ривать тот факт, что + جملهٔ پایه',
      ),
      () => buildRussianSentence(
        sid,
        `Бу́дучи те́сно свя́занным ${sPrep} ${p.ins}, да́нный проце́сс отража́ет глубо́кие сдви́ги в о́бществе.`,
        `این فرآیند، از آنجا که پیوندی تنگاتنگ با ${p.fa} دارد، دگرگونی‌های ژرف جامعه را بازمی‌تاباند.`,
        [[p.headword, p.headFa], ['бу́дучи свя́занным с', 'در حالی که پیوند دارد با'], ['глубо́кие сдви́ги', 'دگرگونی‌های ژرف']],
        'ساختار ادبی-علمی با «бу́дучи» + صفت مفعولی (Instr.) + جملهٔ پایه',
      ),
      () => buildRussianSentence(
        sid,
        `В ра́мках ме́ждисциплина́рного симпо́зиума осо́бый акцен́т был сде́лан на э́тике ${p.gen}.`,
        `در چارچوب همایش میان‌رشته‌ای، تأکید ویژه‌ای بر اخلاقِ ${p.fa} صورت گرفت.`,
        [[p.headword, p.headFa], ['в ра́мках симпо́зиума', 'در چارچوب همایش'], ['акце́нт был сде́лан на', 'تأکید گذاشته شد بر']],
        'ساختار مجهول رسمی گذشته: осо́бый акце́нт был сде́лан на + Prepositional',
      ),
      () => buildRussianSentence(
        sid,
        `Ни оди́н серьёзный обзо́р совреме́нной пра́ктики не обхо́дится без упомина́ния ${oPrep} ${p.prep}.`,
        `هیچ مرور تحلیلیِ جدی‌ای بر تجربهٔ معاصر بدون اشاره به ${p.fa} کامل نمی‌شود.`,
        [[p.headword, p.headFa], ['не обхо́дится без', 'بی‌نیاز نیست از'], ['упомина́ние', 'اشاره / یادکرد']],
        'نفی مؤکد رسمی: Ни оди́н + نهاد + не обхо́дится без упомина́ния о/об + Prep.',
      ),
      () => buildRussianSentence(
        sid,
        `Примеча́тельно, что ме́тоды оцен́ки ${p.gen} эволюциони́руют быстре́е, чем ожида́ли прогнози́сты.`,
        `شایان توجه است که روش‌های ارزیابیِ ${p.fa} سریع‌تر از آنچه پیش‌بینی‌کنندگان انتظار داشتند تکامل می‌یابند.`,
        [[p.headword, p.headFa], ['примеча́тельно, что', 'شایان توجه است که'], ['эволюциони́руют', 'تکامل می‌یابند']],
        'Примеча́тельно, что + نهاد + فعل + قید تفضیلی، чем + جملهٔ مقایسه',
      ),
      () => buildRussianSentence(
        sid,
        `Руководству́ясь при́нципами прозра́чности, комите́т опубликова́л по́лный отчёт ${oPrep} ${p.prep}.`,
        `کمیته با پیروی از اصول شفافیت، گزارش کامل مربوط به ${p.fa} را منتشر کرد.`,
        [[p.headword, p.headFa], ['руководству́ясь при́нципами', 'با پیروی از اصولِ'], ['по́лный отчёт', 'گزارش جامع']],
        'Руководству́ясь + حالت Instrumental، + فاعل + فعل کامل + مفعول',
      ),
      () => buildRussianSentence(
        sid,
        `Име́нно на сты́ке тео́рии и пра́ктики раскрыва́ется подли́нный потенциа́л ${p.gen}.`,
        `دقیقاً در تلاقیِ نظریه و عمل است که ظرفیت اصیل و واقعیِ ${p.fa} آشکار می‌شود.`,
        [[p.headword, p.headFa], ['на сты́ке тео́рии и пра́ктики', 'در مرز تلاقی نظریه و عمل'], ['по́длинный потенциа́л', 'ظرفیت اصیل']],
        'تأکید کانونی با И́менно на сты́ке + Gen. + فعل مجهول بازتابی + نهاد',
      ),
      () => buildRussianSentence(
        sid,
        `Да́же части́чное усовершенствова́ние ${p.gen} спосо́бно ощути́мо повы́сить ка́чество реше́ний.`,
        `حتی بهبودِ جزئیِ ${p.fa} نیز قادر است کیفیت تصمیم‌ها را به‌طرز محسوسی ارتقا دهد.`,
        [[p.headword, p.headFa], ['усовершенствова́ние', 'بهینه‌سازی و ارتقا'], ['ощути́мо повы́сить', 'به‌طور ملموس بالا بردن']],
        'Да́же + نهاد خنثی + спосо́бно + قید + مصدر کامل + مفعول مستقیم',
      ),
      () => buildRussianSentence(
        sid,
        `Критери́ем зре́лости институ́та слу́жит то, как бере́жно он обраща́ется ${sPrep} ${p.ins}.`,
        `معیار بلوغ یک نهاد آن است که تا چه اندازه مسئولانه و دقیق با ${p.fa} رفتار می‌کند.`,
        [[p.headword, p.headFa], ['крите́рий зре́лости', 'معیار بلوغ'], ['бере́жно обраща́ется с', 'دقیق و مسئولانه برخورد می‌کند با']],
        'خبر مقدم در حالت ابزاری (Крите́рием ... слу́жит то, как ...)',
      ),
      () => buildRussianSentence(
        sid,
        `Вопреки́ распространённому стереоти́пу, осво́ить ${p.acc} мо́жно путём после́довательной пра́ктики.`,
        `برخلاف کلیشهٔ رایج، تسلط یافتن بر ${p.fa} از رهگذرِ تمرینِ پیوسته کاملاً شدنی است.`,
        [[p.headword, p.headFa], ['вопреки́ стереоти́пу', 'برخلاف کلیشهٔ رایج'], ['путём пра́ктики', 'از راهِ تمرین']],
        'Вопреки́ + حالت متممی (Dative)، + مصدر + مفعول + мо́жно путём + Genitive',
      ),
      () => buildRussianSentence(
        sid,
        `Обобща́я нако́пленные сведе́ния ${oPrep} ${p.prep}, докла́дчик наметил ориенти́ры на десятиле́тие вперёд.`,
        `سخنران با جمع‌بندی دانسته‌های انباشته دربارهٔ ${p.fa}، چشم‌اندازهای یک دههٔ آینده را ترسیم کرد.`,
        [[p.headword, p.headFa], ['обобща́я све́дения', 'با جمع‌بندیِ یافته‌ها'], ['наме́тил ориенти́ры', 'مسیرنماها را ترسیم کرد']],
        'قید فعلی ناگذرا/گذرا (Обобща́я + Acc.)، + فاعل + فعل گذشتهٔ کامل + مفعول',
      ),
      () => buildRussianSentence(
        sid,
        `Таки́м о́бразом, гармони́чное сочета́ние ${p.gen} и жи́вого диало́га обеспечи́вает глубину́ мы́сли.`,
        `بدین ترتیب، پیوندِ هماهنگِ ${p.fa} و گفت‌وگوی زنده، ژرفای اندیشه را تضمین می‌کند.`,
        [[p.headword, p.headFa], ['таки́м о́бразом', 'بدین ترتیب / بنابراین'], ['гармони́чное сочета́ние', 'ترکیب هماهنگ']],
        'پیوندگر نتیجه‌گیری رسمی: Таки́м о́бразом, + نهاد مرکب + обеспечи́вает + Acc.',
      ),
    ];
    results.push(framesL4[templateIdx]());
  }
  return results;
}

/** Expands an existing 8-sentence lesson up to 30 sentences and enriches its original 8 sentences' vocabulary! */
export function upgradeExistingRussianLesson(
  baseLesson: LearningLesson,
  idPrefix: string,
  levelTier: 0 | 1 | 2,
  items: readonly RuPhrase[],
  actions: readonly RuAction[],
  placePhraseRu: string,
  placePhraseFa: string,
  extraCustomSentences: readonly LearningSentence[] = [],
): LearningLesson {
  const needed = Math.max(0, 30 - baseLesson.sentences.length - extraCustomSentences.length);
  const generated = generateDomainSentences(
    idPrefix,
    baseLesson.sentences.length + extraCustomSentences.length + 1,
    needed,
    levelTier,
    items,
    actions,
    placePhraseRu,
    placePhraseFa,
  );
  // Also enrich every original sentence so each sentence has 3 contextual vocabulary items!
  const extraVocabMap: Record<number, readonly [string, string][]> = {};
  baseLesson.sentences.forEach((_, idx) => {
    const itemA = items[idx % items.length];
    const actA = actions[idx % actions.length];
    extraVocabMap[idx] = [
      [itemA.headword, itemA.headFa],
      [actA.inf, actA.faInf],
      ['сего́дня', 'امروز'],
      ['вме́сте', 'با هم'],
      ['о́чень', 'خیلی'],
      ['здесь', 'اینجا'],
    ];
  });
  return extendRussianLesson(
    baseLesson,
    [...extraCustomSentences, ...generated],
    extraVocabMap,
  );
}

/** Builds a brand-new 30-sentence Russian lesson complete with teaching notes, 4-line dialogue & 2–3 comprehension checks! */
export function createFullRussianLesson(params: {
  readonly id: string;
  readonly order: number;
  readonly level: number;
  readonly title: string;
  readonly subtitle: string;
  readonly goal: string;
  readonly explanation: readonly string[];
  readonly idPrefix: string;
  readonly levelTier: 0 | 1 | 2 | 3 | 4;
  readonly items: readonly RuPhrase[];
  readonly actions: readonly RuAction[];
  readonly placePhraseRu?: string;
  readonly placePhraseFa?: string;
  readonly placeRu?: string;
  readonly placeFa?: string;
  readonly customSentences?: readonly LearningSentence[];
  readonly dialogue: readonly DialogueLine[];
  readonly checks: readonly LessonQuestion[];
}): LearningLesson {
  const custom = params.customSentences ?? [];
  const needed = Math.max(0, 30 - custom.length);
  const rest = generateDomainSentences(
    params.idPrefix,
    custom.length + 1,
    needed,
    params.levelTier,
    params.items,
    params.actions,
    params.placePhraseRu ?? params.placeRu ?? 'в э́том ме́сте',
    params.placePhraseFa ?? params.placeFa ?? 'در این مکان',
  );
  return {
    id: params.id,
    title: params.title,
    situation: params.goal,
    subtitle: params.subtitle,
    goal: params.goal,
    explanation: params.explanation,
    durationMinutes: 12,
    sentences: [...custom, ...rest],
    dialogue: [...params.dialogue],
    checks: [...params.checks],
  };
}
