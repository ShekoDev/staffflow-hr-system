import type { TranslationTree } from './locales/en';

/**
 * Every locale must provide exactly the same keys as the English tree.
 * Missing or misspelled keys become compile errors, which is what keeps
 * the translation system honest as the app grows.
 */
export type Dictionary = {
  [Section in keyof TranslationTree]: {
    [Key in keyof TranslationTree[Section]]: string;
  };
};

export type Section = keyof TranslationTree;
export type TranslationKey = {
  [S in Section]: `${S & string}.${Extract<keyof TranslationTree[S], string>}`;
}[Section];
