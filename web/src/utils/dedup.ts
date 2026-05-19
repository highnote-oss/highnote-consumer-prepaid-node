import type { ATMLocation } from "../api/client";

export function deduplicateATMs(locations: ATMLocation[]): ATMLocation[] {
  const seen = new Set<string>();
  return locations.filter((atm) => {
    const key = `${atm.name}|${atm.coordinates?.latitude}|${atm.coordinates?.longitude}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
