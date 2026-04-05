/**
 * Truncate text to a maximum length, appending ellipsis if truncated.
 * @param {string} text - Input text
 * @param {number} maxLen - Maximum character length
 * @returns {string} Truncated text
 */
export function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || "";
  return text.slice(0, maxLen - 1) + "\u2026";
}

/**
 * Split text into lines that fit within a given character width.
 * Simple word-wrap implementation.
 * @param {string} text - Input text
 * @param {number} charsPerLine - Approximate characters per line
 * @returns {string[]} Array of lines
 */
export function wordWrap(text, charsPerLine) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 > charsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}
