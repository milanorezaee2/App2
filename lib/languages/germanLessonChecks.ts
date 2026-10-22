import type { LearningLesson, LearningSentence } from './types';

export type GermanLessonCheck = {
  promptFa: string;
  choices: string[];
  correctIndex: number;
  explanationFa: string;
};

function spreadIndices(count: number): number[] {
  if (count <= 0) return [];
  const candidates = [0, Math.floor(count / 3), Math.floor((count * 2) / 3), count - 1];
  return [...new Set(candidates)].filter(index => index >= 0 && index < count);
}

function pickOtherSentences(
  lesson: LearningLesson,
  current: LearningSentence,
  count: number,
  field: 'text' | 'fa',
): string[] {
  const seen = new Set([current[field]]);
  const values: string[] = [];
  for (const sentence of lesson.sentences) {
    if (sentence.id === current.id) continue;
    const value = sentence[field];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
    if (values.length >= count) break;
  }
  return values;
}

function rotateChoices(correct: string, distractors: string[], offset: number) {
  const choices = [correct, ...distractors].slice(0, 3);
  const shift = offset % choices.length;
  const rotated = [...choices.slice(shift), ...choices.slice(0, shift)];
  return { choices: rotated, correctIndex: rotated.indexOf(correct) };
}

/**
 * Builds review questions exclusively from the sentences and vocabulary that
 * already exist in this lesson. Nothing is invented, translated again, or
 * imported from another lesson, so the questions stay aligned with the page.
 */
export function buildGermanLessonChecks(lesson: LearningLesson): GermanLessonCheck[] {
  const indices = spreadIndices(lesson.sentences.length);
  if (indices.length < 2) return [];
  const [first, second, third, last] = indices.length >= 4
    ? indices
    : [indices[0], indices[1], indices[1], indices[indices.length - 1]];

  const firstSentence = lesson.sentences[first];
  const secondSentence = lesson.sentences[second];
  const thirdSentence = lesson.sentences[third];
  const lastSentence = lesson.sentences[last];
  const checks: GermanLessonCheck[] = [];

  if (firstSentence) {
    const { choices, correctIndex } = rotateChoices(
      firstSentence.fa,
      pickOtherSentences(lesson, firstSentence, 2, 'fa'),
      0,
    );
    checks.push({
      promptFa: `معنی جملهٔ «${firstSentence.text}» کدام است؟`,
      choices,
      correctIndex,
      explanationFa: `این جمله در بخش «${lesson.title}» با معنی «${firstSentence.fa}» آمده است.`,
    });
  }

  if (secondSentence) {
    const { choices, correctIndex } = rotateChoices(
      secondSentence.text,
      pickOtherSentences(lesson, secondSentence, 2, 'text'),
      1,
    );
    checks.push({
      promptFa: `کدام جملهٔ آلمانی به این معنی نزدیک است؟ «${secondSentence.fa}»`,
      choices,
      correctIndex,
      explanationFa: `جملهٔ درست «${secondSentence.text}» است؛ همان جمله‌ای که در این درس با همین معنی تمرین شد.`,
    });
  }

  const vocabularySentence = thirdSentence?.vocabulary.length ? thirdSentence : lesson.sentences.find(sentence => sentence.vocabulary.length);
  const word = vocabularySentence?.vocabulary[0];
  if (vocabularySentence && word) {
    const seen = new Set([word.meaning]);
    const distractors: string[] = [];
    for (const sentence of lesson.sentences) {
      for (const item of sentence.vocabulary) {
        if (distractors.length >= 2) break;
        if (!item.meaning || seen.has(item.meaning)) continue;
        seen.add(item.meaning);
        distractors.push(item.meaning);
      }
      if (distractors.length >= 2) break;
    }
    if (distractors.length >= 2) {
      const { choices, correctIndex } = rotateChoices(word.meaning, distractors, 2);
      checks.push({
        promptFa: `واژهٔ «${word.word}» در این درس چه معنایی دارد؟`,
        choices,
        correctIndex,
        explanationFa: `«${word.word}» در جملهٔ «${vocabularySentence.text}» با معنی «${word.meaning}» به کار رفته است.`,
      });
    }
  }

  if (lastSentence) {
    const { choices, correctIndex } = rotateChoices(
      lastSentence.fa,
      pickOtherSentences(lesson, lastSentence, 2, 'fa'),
      0,
    );
    checks.push({
      promptFa: `ترجمهٔ درست جملهٔ «${lastSentence.text}» کدام است؟`,
      choices,
      correctIndex,
      explanationFa: `این جمله در پایان درس با معنی «${lastSentence.fa}» تکرار شده است.`,
    });
  }

  return checks;
}
