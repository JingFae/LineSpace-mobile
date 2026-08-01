export type PoemLineChange = {
  beforeLines: string[];
  afterLines: string[];
};

const MAX_SPARK_CHANGE_HISTORY = 20;

export function appendSparkChange<T extends PoemLineChange>(
  history: T[],
  change: T
) {
  return [...history, change].slice(-MAX_SPARK_CHANGE_HISTORY);
}

export function latestSparkChange<T extends PoemLineChange>(history: T[]) {
  return history[history.length - 1] ?? null;
}

export function removeLatestSparkChange<T extends PoemLineChange>(history: T[]) {
  return history.slice(0, -1);
}

export function areEquivalentPoemLines(body: string, expectedLines: string[]) {
  return JSON.stringify(normalizePoemLines(body.split(/\r?\n/))) ===
    JSON.stringify(normalizePoemLines(expectedLines));
}

function normalizePoemLines(lines: string[]) {
  return lines
    .flatMap((line) => line.split(/\r?\n/))
    .map((line) =>
      line
        // Match the API's comparison rules: normalize line endings and trim
        // edges, but keep meaningful in-line spacing and punctuation intact.
        .normalize("NFC")
        .trim()
    )
    .filter(Boolean);
}
