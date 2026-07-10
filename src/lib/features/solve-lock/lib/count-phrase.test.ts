import { describe, it, expect } from "vitest";
import { countPhrase } from "./count-phrase";

describe("countPhrase", () => {
  it("Ukrainian: one/few/many via plural rules", () => {
    expect(countPhrase("uk", 1)).toBe("1 раз");
    for (const n of [2, 3, 4]) expect(countPhrase("uk", n)).toBe(`${n} рази`);
    for (const n of [5, 6, 7]) expect(countPhrase("uk", n)).toBe(`${n} разів`);
  });

  it("Russian: few → раза, many → раз", () => {
    expect(countPhrase("ru", 1)).toBe("1 раз");
    expect(countPhrase("ru", 2)).toBe("2 раза");
    expect(countPhrase("ru", 5)).toBe("5 раз");
  });

  it("Polish: multiplicative razy for 2+", () => {
    expect(countPhrase("pl", 1)).toBe("raz");
    expect(countPhrase("pl", 5)).toBe("5 razy");
  });

  it("Romanian: mandatory 'de', feminine 'două'", () => {
    expect(countPhrase("ro", 1)).toBe("o dată");
    expect(countPhrase("ro", 2)).toBe("de două ori");
    expect(countPhrase("ro", 3)).toBe("de 3 ori");
  });

  it("Catalan and Portuguese: feminine 2", () => {
    expect(countPhrase("ca", 2)).toBe("dues vegades");
    expect(countPhrase("ca-ES-valencia", 2)).toBe("dues vegades");
    expect(countPhrase("pt", 2)).toBe("duas vezes");
    expect(countPhrase("pt-BR", 2)).toBe("duas vezes");
    expect(countPhrase("pt", 3)).toBe("3 vezes");
  });

  it("Chinese: 两 for quantity 2, digit otherwise", () => {
    expect(countPhrase("zh", 2)).toBe("两次");
    expect(countPhrase("zh", 3)).toBe("3 次");
  });

  it("Czech: spelled multiplicatives 2..9", () => {
    const expected = [
      "dvakrát",
      "třikrát",
      "čtyřikrát",
      "pětkrát",
      "šestkrát",
      "sedmkrát",
      "osmkrát",
      "devětkrát",
    ];
    expected.forEach((word, i) => expect(countPhrase("cs", i + 2)).toBe(word));
    expect(countPhrase("cs", 8)).toBe("osmkrát");
    expect(countPhrase("cs", 9)).toBe("devětkrát");
    expect(countPhrase("cs", 10)).toBe("10krát");
  });

  it("Slovak: spelled multiplicatives 2..9", () => {
    const expected = [
      "dvakrát",
      "trikrát",
      "štyrikrát",
      "päťkrát",
      "šesťkrát",
      "sedemkrát",
      "osemkrát",
      "deväťkrát",
    ];
    expected.forEach((word, i) => expect(countPhrase("sk", i + 2)).toBe(word));
    expect(countPhrase("sk", 8)).toBe("osemkrát");
    expect(countPhrase("sk", 9)).toBe("deväťkrát");
    expect(countPhrase("sk", 10)).toBe("10krát");
  });

  it("Hungarian: vowel-harmony numerals 2..9", () => {
    const expected = [
      "kétszer",
      "háromszor",
      "négyszer",
      "ötször",
      "hatszor",
      "hétszer",
      "nyolcszor",
      "kilencszer",
    ];
    expected.forEach((word, i) => expect(countPhrase("hu", i + 2)).toBe(word));
    expect(countPhrase("hu", 8)).toBe("nyolcszor");
    expect(countPhrase("hu", 9)).toBe("kilencszer");
    expect(countPhrase("hu", 10)).toBe("10-szer");
  });

  it("simple digit + word locales", () => {
    expect(countPhrase("en", 3)).toBe("3 times");
    expect(countPhrase("de", 3)).toBe("3 Mal");
    expect(countPhrase("nl", 3)).toBe("3 keer");
    expect(countPhrase("tr", 3)).toBe("3 kez");
  });

  it("unknown locale falls back to English", () => {
    expect(countPhrase("xx", 4)).toBe("4 times");
    expect(countPhrase("ja", 2)).toBe("2 times");
  });
});
