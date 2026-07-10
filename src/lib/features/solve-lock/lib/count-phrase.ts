// Spelled-out multiplicatives for engines that misread a bare digit + suffix
// (e.g. Czech "3krát", Slovak, Hungarian). Indexed 1..9; beyond the table each
// language states its own digit fallback.
const CS = [
  "",
  "jednou",
  "dvakrát",
  "třikrát",
  "čtyřikrát",
  "pětkrát",
  "šestkrát",
  "sedmkrát",
  "osmkrát",
  "devětkrát",
];
const SK = [
  "",
  "raz",
  "dvakrát",
  "trikrát",
  "štyrikrát",
  "päťkrát",
  "šesťkrát",
  "sedemkrát",
  "osemkrát",
  "deväťkrát",
];
const HU = [
  "",
  "egyszer",
  "kétszer",
  "háromszor",
  "négyszer",
  "ötször",
  "hatszor",
  "hétszer",
  "nyolcszor",
  "kilencszer",
];

/**
 * The spoken "N times" phrase for a consecutive same-direction group. Callers
 * omit the count entirely when n === 1, but a sane singular is still returned
 * if asked. Data was fixed by a multilingual review pass (feminine "2", the
 * Slavic multiplicative/count forms, Han measure-word "两"); it is copied
 * verbatim rather than re-derived. Unknown locale falls back to English.
 */
export function countPhrase(locale: string, n: number): string {
  switch (locale) {
    case "de":
      return `${n} Mal`;
    case "fr":
      return `${n} fois`;
    case "nl":
      return `${n} keer`;
    case "tr":
      return `${n} kez`;
    case "it":
      return `${n} volte`;

    case "es":
    case "es-419":
      return `${n} veces`;

    // Feminine "2" — a bare digit is read as masculine ("dois" / "dos").
    case "pt":
    case "pt-BR":
      return n === 2 ? "duas vezes" : `${n} vezes`;
    case "ca":
    case "ca-ES-valencia":
      return n === 2 ? "dues vegades" : `${n} vegades`;

    // Mandatory preposition "de"; feminine "două".
    case "ro":
      return n === 1 ? "o dată" : n === 2 ? "de două ori" : `de ${n} ori`;

    // Multiplicative "razy" for every 2+, never the genitive "razów".
    case "pl":
      return n === 1 ? "raz" : `${n} razy`;

    case "uk": {
      const category = new Intl.PluralRules("uk").select(n);
      if (category === "one") return `${n} раз`;
      if (category === "few") return `${n} рази`;
      return `${n} разів`;
    }
    case "ru": {
      const category = new Intl.PluralRules("ru").select(n);
      if (category === "one") return `${n} раз`;
      if (category === "few") return `${n} раза`;
      return `${n} раз`;
    }

    case "cs":
      return n >= 1 && n <= 9 ? CS[n] : `${n}krát`;
    case "sk":
      return n >= 1 && n <= 9 ? SK[n] : `${n}krát`;
    // Vowel harmony makes each Hungarian numeral distinct.
    case "hu":
      return n >= 1 && n <= 9 ? HU[n] : `${n}-szer`;

    // Quantity 2 before a measure word must be 两, not the digit read as 二.
    case "zh":
      return n === 2 ? "两次" : `${n} 次`;

    case "en":
    default:
      return `${n} times`;
  }
}
