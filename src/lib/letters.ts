import { randomInt } from "crypto";

export const SCRABBLE_SCORES: Record<string, number> = {
  a: 1,
  b: 3,
  c: 3,
  d: 2,
  e: 1,
  f: 4,
  g: 2,
  h: 4,
  i: 1,
  j: 8,
  k: 5,
  l: 1,
  m: 3,
  n: 1,
  o: 1,
  p: 3,
  q: 10,
  r: 1,
  s: 1,
  t: 1,
  u: 1,
  v: 4,
  w: 4,
  x: 8,
  y: 4,
  z: 10,
};

const WEIGHTS_BY_SCORE: Record<number, number[]> = {
  1: [0.55, 0.3, 0.15],
  2: [0.75, 0.2, 0.05],
  3: [0.6, 0.3, 0.1],
  4: [0.4, 0.4, 0.2],
  5: [0.25, 0.45, 0.3],
  6: [0.15, 0.35, 0.5],
  7: [0.1, 0.3, 0.6],
};

const weightedIndex = (weights: number[]) => {
  const total = weights.reduce((sum, value) => sum + value, 0);
  const roll = randomInt(0, 10000) / 10000 * total;
  let running = 0;
  for (let i = 0; i < weights.length; i += 1) {
    running += weights[i];
    if (roll <= running) {
      return i;
    }
  }
  return weights.length - 1;
};

const normalizeAnswerLetters = (answer: string) => {
  return Array.from(
    new Set(answer.toLowerCase().replace(/[^a-z]/g, "").split("")),
  ).filter(Boolean);
};

export const pickAwardLetter = (answer: string, score: number) => {
  const letters = normalizeAnswerLetters(answer);
  if (letters.length === 0) {
    return null;
  }

  const scored = letters
    .map((letter) => ({
      letter,
      score: SCRABBLE_SCORES[letter] ?? 1,
    }))
    .sort((a, b) => b.score - a.score);

  const scoreTiers = Array.from(new Set(scored.map((item) => item.score))).sort(
    (a, b) => b - a,
  );

  const sanitizedScore = Number.isFinite(score) ? score : 7;
  const weightKey = sanitizedScore >= 7 ? 7 : Math.max(1, Math.min(6, sanitizedScore));
  const weights = WEIGHTS_BY_SCORE[weightKey] ?? WEIGHTS_BY_SCORE[7];
  const tierIndex = Math.min(weightedIndex(weights), scoreTiers.length - 1);
  const selectedScore = scoreTiers[tierIndex];
  const tierLetters = scored.filter((item) => item.score === selectedScore);
  const selected = tierLetters[randomInt(0, tierLetters.length)];

  return selected?.letter ?? null;
};
