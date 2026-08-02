export function getSparkPreviewLines(
  beforeLines: string[],
  proposedLines: string[],
  fallbackPreview: string
) {
  const before = normalizeLines(beforeLines);
  const proposed = normalizeLines(proposedLines);
  const common = longestCommonSubsequence(before, proposed);
  const changed = proposed.filter((_, index) => !common.has(index));
  return changed.length > 0
    ? changed
    : normalizeLines(fallbackPreview.split(/\r?\n/));
}

/**
 * Removes one card's still-visible line changes from the current poem while
 * preserving later edits made to other lines. Exact matching is deliberate:
 * if a later edit changed the same text, that later wording wins.
 */
export function removeSparkChangeFromLines(
  currentLines: string[],
  beforeLines: string[],
  afterLines: string[]
) {
  const current = normalizeLines(currentLines);
  const before = normalizeLines(beforeLines);
  const after = normalizeLines(afterLines);
  const matches = longestCommonPairs(before, after);
  const boundaries = [
    { left: -1, right: -1 },
    ...matches,
    { left: before.length, right: after.length }
  ];

  for (let boundaryIndex = boundaries.length - 1; boundaryIndex > 0; boundaryIndex -= 1) {
    const previous = boundaries[boundaryIndex - 1]!;
    const next = boundaries[boundaryIndex]!;
    const removed = before.slice(previous.left + 1, next.left);
    const added = after.slice(previous.right + 1, next.right);
    if (removed.length === 0 && added.length === 0) continue;

    const leftAnchor = previous.right >= 0 ? after[previous.right] : undefined;
    const rightAnchor = next.right < after.length ? after[next.right] : undefined;
    if (added.length > 0) {
      const start = findExactSegment(current, added, leftAnchor, rightAnchor);
      if (start >= 0) current.splice(start, added.length, ...removed);
      continue;
    }

    const insertionIndex = findInsertionIndex(current, leftAnchor, rightAnchor);
    if (insertionIndex >= 0) current.splice(insertionIndex, 0, ...removed);
  }
  return current;
}

function normalizeLines(lines: string[]) {
  return lines
    .flatMap((line) => line.split(/\r?\n/))
    .map((line) => line.normalize("NFC").trim())
    .filter(Boolean);
}

/** Returns the indexes in `right` that belong to one stable LCS match. */
function longestCommonSubsequence(left: string[], right: string[]) {
  return new Set(longestCommonPairs(left, right).map((pair) => pair.right));
}

function longestCommonPairs(left: string[], right: string[]) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const table = Array.from({ length: rows }, () => new Uint16Array(columns));
  for (let leftIndex = 1; leftIndex < rows; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex < columns; rightIndex += 1) {
      table[leftIndex]![rightIndex] =
        left[leftIndex - 1] === right[rightIndex - 1]
          ? table[leftIndex - 1]![rightIndex - 1]! + 1
          : Math.max(
              table[leftIndex - 1]![rightIndex]!,
              table[leftIndex]![rightIndex - 1]!
            );
    }
  }

  const pairs: Array<{ left: number; right: number }> = [];
  let leftIndex = left.length;
  let rightIndex = right.length;
  while (leftIndex > 0 && rightIndex > 0) {
    if (left[leftIndex - 1] === right[rightIndex - 1]) {
      pairs.push({ left: leftIndex - 1, right: rightIndex - 1 });
      leftIndex -= 1;
      rightIndex -= 1;
    } else if (
      table[leftIndex - 1]![rightIndex]! >=
      table[leftIndex]![rightIndex - 1]!
    ) {
      leftIndex -= 1;
    } else {
      rightIndex -= 1;
    }
  }
  return pairs.reverse();
}

function findExactSegment(
  current: string[],
  segment: string[],
  leftAnchor?: string,
  rightAnchor?: string
) {
  let bestIndex = -1;
  let bestScore = -1;
  for (let index = 0; index <= current.length - segment.length; index += 1) {
    if (!segment.every((line, offset) => current[index + offset] === line)) continue;
    const score =
      (leftAnchor && current[index - 1] === leftAnchor ? 1 : 0) +
      (rightAnchor && current[index + segment.length] === rightAnchor ? 1 : 0);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  }
  return bestIndex;
}

function findInsertionIndex(
  current: string[],
  leftAnchor?: string,
  rightAnchor?: string
) {
  if (leftAnchor) {
    const leftIndex = current.lastIndexOf(leftAnchor);
    if (leftIndex >= 0) {
      if (!rightAnchor || current.slice(leftIndex + 1).includes(rightAnchor)) {
        return leftIndex + 1;
      }
    }
  }
  if (rightAnchor) {
    const rightIndex = current.indexOf(rightAnchor);
    if (rightIndex >= 0) return rightIndex;
  }
  return current.length === 0 ? 0 : -1;
}
