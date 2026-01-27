import fs from "fs/promises";
import wordListPath from "word-list";

let dictionary: Set<string> | null = null;

export const loadDictionary = async () => {
  if (dictionary) {
    return dictionary;
  }

  const contents = await fs.readFile(wordListPath, "utf8");
  dictionary = new Set(
    contents
      .split("\n")
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word.length > 1),
  );
  return dictionary;
};

export const isValidWord = async (word: string) => {
  if (!word || word.length < 2) {
    return false;
  }
  const dict = await loadDictionary();
  return dict.has(word.toLowerCase());
};
