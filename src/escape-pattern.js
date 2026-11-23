// Escape literal text for use outside a character class in a RegExp string.
export function escapePattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
