/**
 * Arabic text shaping for PDF output.
 *
 * PDF viewers draw the glyphs a document hands them, in the order it hands
 * them over. They do not join Arabic letters and they do not reorder
 * right-to-left text — a browser does that for you, a PDF library does not.
 * So before any Arabic string reaches jsPDF it goes through here:
 *
 *   1. contextual shaping — each letter is replaced by its isolated,
 *      initial, medial or final presentation form (U+FE70–U+FEFF),
 *   2. lam-alef ligatures, which are single glyphs in Arabic,
 *   3. visual reordering — right-to-left runs are reversed, embedded
 *      Latin and numbers keep their own direction, and paired brackets
 *      are mirrored.
 *
 * Combining marks (harakat) are removed: positioning them correctly needs
 * a full OpenType layout engine, and HR data does not carry them.
 */

type Forms = [isolated: number, final: number, initial: number, medial: number];

/** Presentation forms per letter. A 0 means "this form does not exist". */
const LETTERS: Record<number, Forms> = {
  0x0621: [0xfe80, 0, 0, 0], // ء
  0x0622: [0xfe81, 0xfe82, 0, 0], // آ
  0x0623: [0xfe83, 0xfe84, 0, 0], // أ
  0x0624: [0xfe85, 0xfe86, 0, 0], // ؤ
  0x0625: [0xfe87, 0xfe88, 0, 0], // إ
  0x0626: [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c], // ئ
  0x0627: [0xfe8d, 0xfe8e, 0, 0], // ا
  0x0628: [0xfe8f, 0xfe90, 0xfe91, 0xfe92], // ب
  0x0629: [0xfe93, 0xfe94, 0, 0], // ة
  0x062a: [0xfe95, 0xfe96, 0xfe97, 0xfe98], // ت
  0x062b: [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c], // ث
  0x062c: [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0], // ج
  0x062d: [0xfea1, 0xfea2, 0xfea3, 0xfea4], // ح
  0x062e: [0xfea5, 0xfea6, 0xfea7, 0xfea8], // خ
  0x062f: [0xfea9, 0xfeaa, 0, 0], // د
  0x0630: [0xfeab, 0xfeac, 0, 0], // ذ
  0x0631: [0xfead, 0xfeae, 0, 0], // ر
  0x0632: [0xfeaf, 0xfeb0, 0, 0], // ز
  0x0633: [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4], // س
  0x0634: [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8], // ش
  0x0635: [0xfeb9, 0xfeba, 0xfebb, 0xfebc], // ص
  0x0636: [0xfebd, 0xfebe, 0xfebf, 0xfec0], // ض
  0x0637: [0xfec1, 0xfec2, 0xfec3, 0xfec4], // ط
  0x0638: [0xfec5, 0xfec6, 0xfec7, 0xfec8], // ظ
  0x0639: [0xfec9, 0xfeca, 0xfecb, 0xfecc], // ع
  0x063a: [0xfecd, 0xfece, 0xfecf, 0xfed0], // غ
  0x0640: [0x0640, 0x0640, 0x0640, 0x0640], // ـ tatweel
  0x0641: [0xfed1, 0xfed2, 0xfed3, 0xfed4], // ف
  0x0642: [0xfed5, 0xfed6, 0xfed7, 0xfed8], // ق
  0x0643: [0xfed9, 0xfeda, 0xfedb, 0xfedc], // ك
  0x0644: [0xfedd, 0xfede, 0xfedf, 0xfee0], // ل
  0x0645: [0xfee1, 0xfee2, 0xfee3, 0xfee4], // م
  0x0646: [0xfee5, 0xfee6, 0xfee7, 0xfee8], // ن
  0x0647: [0xfee9, 0xfeea, 0xfeeb, 0xfeec], // ه
  0x0648: [0xfeed, 0xfeee, 0, 0], // و
  0x0649: [0xfeef, 0xfef0, 0, 0], // ى
  0x064a: [0xfef1, 0xfef2, 0xfef3, 0xfef4], // ي
  // Persian / Urdu letters, harmless to support
  0x067e: [0xfb56, 0xfb57, 0xfb58, 0xfb59], // پ
  0x0686: [0xfb7a, 0xfb7b, 0xfb7c, 0xfb7d], // چ
  0x0698: [0xfb8a, 0xfb8b, 0, 0], // ژ
  0x06a9: [0xfb8e, 0xfb8f, 0xfb90, 0xfb91], // ک
  0x06af: [0xfb92, 0xfb93, 0xfb94, 0xfb95], // گ
  0x06cc: [0xfbfc, 0xfbfd, 0xfbfe, 0xfbff], // ی
};

/** lam + alef collapse into one glyph. [isolated, final] */
const LAM_ALEF: Record<number, [number, number]> = {
  0x0622: [0xfef5, 0xfef6],
  0x0623: [0xfef7, 0xfef8],
  0x0625: [0xfef9, 0xfefa],
  0x0627: [0xfefb, 0xfefc],
};

const MIRRORED: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  '«': '»',
  '»': '«',
};

const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;

/** Arabic block, supplements, and the presentation-form blocks. */
const ARABIC_RANGE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const LATIN_OR_DIGIT = /[A-Za-z0-9À-ɏ]/;

export function containsArabic(text: string): boolean {
  return ARABIC_RANGE.test(text);
}

function isLetter(code: number): boolean {
  return code in LETTERS;
}

/** True when this letter can join to the letter that follows it. */
function joinsForward(code: number): boolean {
  const forms = LETTERS[code];
  return Boolean(forms && forms[2] !== 0);
}

/** True when this letter can join to the letter that precedes it. */
function joinsBackward(code: number): boolean {
  const forms = LETTERS[code];
  return Boolean(forms && forms[1] !== 0);
}

/** Step 1 + 2: contextual forms and lam-alef ligatures, in logical order. */
function shape(text: string): string {
  const source = Array.from(text.replace(HARAKAT, ''));
  const out: string[] = [];

  for (let i = 0; i < source.length; i += 1) {
    const code = source[i].codePointAt(0) ?? 0;

    if (!isLetter(code)) {
      out.push(source[i]);
      continue;
    }

    const nextCode = source[i + 1]?.codePointAt(0) ?? 0;

    // lam followed by an alef form is a single ligature glyph
    if (code === 0x0644 && LAM_ALEF[nextCode]) {
      const prevCode = source[i - 1]?.codePointAt(0) ?? 0;
      const connectedBefore = isLetter(prevCode) && joinsForward(prevCode);
      const [isolated, final] = LAM_ALEF[nextCode];
      out.push(String.fromCharCode(connectedBefore ? final : isolated));
      i += 1;
      continue;
    }

    const prevCode = source[i - 1]?.codePointAt(0) ?? 0;
    const connectedBefore = isLetter(prevCode) && joinsForward(prevCode) && joinsBackward(code);
    const connectedAfter = isLetter(nextCode) && joinsBackward(nextCode) && joinsForward(code);

    const forms = LETTERS[code];
    let form: number;
    if (connectedBefore && connectedAfter) form = forms[3] || forms[1] || forms[0];
    else if (connectedBefore) form = forms[1] || forms[0];
    else if (connectedAfter) form = forms[2] || forms[0];
    else form = forms[0];

    out.push(String.fromCharCode(form));
  }

  return out.join('');
}

type Direction = 'rtl' | 'ltr' | 'neutral';

function classify(char: string): Direction {
  if (ARABIC_RANGE.test(char)) return 'rtl';
  if (LATIN_OR_DIGIT.test(char)) return 'ltr';
  return 'neutral';
}

/**
 * Step 3: reorder for visual rendering.
 *
 * Characters are classified right-to-left, left-to-right or neutral.
 * Neutrals inherit the direction of the strong character before them (or
 * after them at the start of the string); the base direction is RTL,
 * because this function only ever runs on strings containing Arabic.
 * Runs are then emitted right to left, with RTL runs reversed so the
 * glyphs land in visual order, while Latin words and numbers stay intact.
 */
function reorder(text: string): string {
  const chars = Array.from(text);
  const directions: Direction[] = chars.map(classify);

  // Resolve neutrals from the nearest strong character.
  let previousStrong: Direction = 'rtl';
  for (let i = 0; i < directions.length; i += 1) {
    if (directions[i] !== 'neutral') {
      previousStrong = directions[i];
      continue;
    }
    let nextStrong: Direction = 'rtl';
    for (let j = i + 1; j < directions.length; j += 1) {
      if (directions[j] !== 'neutral') {
        nextStrong = directions[j];
        break;
      }
    }
    // A neutral between two LTR characters belongs to the Latin run
    // (for example the dot in "v1.2" or the slash in a date).
    directions[i] = previousStrong === 'ltr' && nextStrong === 'ltr' ? 'ltr' : 'rtl';
  }

  const runs: { rtl: boolean; text: string }[] = [];
  chars.forEach((char, index) => {
    const rtl = directions[index] === 'rtl';
    const last = runs[runs.length - 1];
    if (last && last.rtl === rtl) last.text += char;
    else runs.push({ rtl, text: char });
  });

  return runs
    .reverse()
    .map((run) =>
      run.rtl
        ? Array.from(run.text)
            .reverse()
            .map((char) => MIRRORED[char] ?? char)
            .join('')
        : run.text,
    )
    .join('');
}

/**
 * Prepare a string for jsPDF. Latin-only text is returned untouched, so
 * this is safe to apply to every value that goes into a document.
 */
export function ar(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  const value = String(text);
  if (!containsArabic(value)) return value;
  return reorder(shape(value));
}
