export function stripAllergenNumbersFromName(name: string): string {
  // Removes allergen numbers in various formats:
  // - Trailing: "Item name (7, 9)" or "Item name (7 9)" or "Item name/(7)"
  // - Any parentheses with only numbers: "(7)", "(7,9)", "(7 9)"
  // - Numbers in parentheses anywhere in the string
  return name
    .replace(/\s*\/?\s*\(\s*\d+(?:\s*(?:,|\s)\s*\d+)*\s*\)\s*/gu, ' ') // Remove allergen numbers in parentheses
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim();
}

