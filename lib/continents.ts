/** Country code -> continent, for the travel achievements. */
const MAP: Record<string, string> = {
  US: "NA", CA: "NA", MX: "NA", PR: "NA", CR: "NA", PA: "NA", CU: "NA", DO: "NA", JM: "NA", GT: "NA",
  BR: "SA", AR: "SA", CL: "SA", CO: "SA", PE: "SA", UY: "SA", EC: "SA", VE: "SA", BO: "SA", PY: "SA",
  GB: "EU", IE: "EU", FR: "EU", DE: "EU", ES: "EU", IT: "EU", PT: "EU", NL: "EU", BE: "EU", CH: "EU",
  AT: "EU", SE: "EU", NO: "EU", DK: "EU", FI: "EU", PL: "EU", CZ: "EU", HU: "EU", GR: "EU", RO: "EU",
  IS: "EU", HR: "EU", RS: "EU", SK: "EU", SI: "EU", BG: "EU", EE: "EU", LV: "EU", LT: "EU", LU: "EU",
  JP: "AS", KR: "AS", CN: "AS", TW: "AS", HK: "AS", SG: "AS", TH: "AS", MY: "AS", ID: "AS", PH: "AS",
  IN: "AS", VN: "AS", AE: "AS", SA: "AS", QA: "AS", IL: "AS", TR: "AS", KZ: "AS", LB: "AS", JO: "AS",
  ZA: "AF", NG: "AF", KE: "AF", EG: "AF", MA: "AF", GH: "AF", TZ: "AF", RW: "AF", SN: "AF", ET: "AF",
  AU: "OC", NZ: "OC", FJ: "OC", PG: "OC", NC: "OC",
};

export const continentOf = (code?: string | null): string | null =>
  code ? MAP[code.toUpperCase()] ?? null : null;

export const CONTINENT_NAMES: Record<string, string> = {
  NA: "North America", SA: "South America", EU: "Europe",
  AS: "Asia", AF: "Africa", OC: "Oceania",
};
