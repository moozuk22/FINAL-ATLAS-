export function stripAllergenNumbersFromName(name: string): string {
  // Removes trailing allergen list like: "Item name (7, 9)" or "Item name (7 9)"
  // Keeps other parentheses intact (only strips numeric-list suffix at end of string).
  return name
    .replace(/\s*\(\s*\d+(?:\s*(?:,|\s)\s*\d+)*\s*\)\s*$/u, '')
    .trim();
}

