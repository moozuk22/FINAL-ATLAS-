export function stripAllergenNumbersFromName(name: string): string {
  // Removes trailing allergen list like: "Item name (7, 9)" or "Item name (7 9)" or "Item name (7"
  // Handles cases with or without closing parenthesis
  // Keeps other parentheses intact (only strips numeric-list suffix at end of string).
  if (!name) return name;
  
  // First try to match with closing parenthesis: "Item (7, 9)"
  let cleaned = name.replace(/\s*\(\s*\d+(?:\s*(?:,|\s)\s*\d+)*\s*\)\s*$/u, '');
  
  // If no change, try without closing parenthesis: "Item (7" or "Item (7,"
  if (cleaned === name) {
    cleaned = name.replace(/\s*\(\s*\d+(?:\s*(?:,|\s)\s*\d+)*\s*$/u, '');
  }
  
  // Also handle cases where there's just a single number in parentheses at the end
  if (cleaned === name) {
    cleaned = name.replace(/\s*\(\s*\d+\s*\)?\s*$/u, '');
  }
  
  return cleaned.trim();
}

