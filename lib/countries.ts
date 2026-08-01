/** Common country names -> ISO codes for setlist.fm country search. */
export const COUNTRY_CODES: Record<string, string> = {
  "usa": "US", "united states": "US", "america": "US",
  "uk": "GB", "united kingdom": "GB", "england": "GB", "scotland": "GB", "wales": "GB",
  "canada": "CA", "mexico": "MX", "brazil": "BR", "argentina": "AR", "colombia": "CO", "chile": "CL",
  "france": "FR", "germany": "DE", "spain": "ES", "italy": "IT", "portugal": "PT",
  "netherlands": "NL", "belgium": "BE", "switzerland": "CH", "austria": "AT",
  "sweden": "SE", "norway": "NO", "denmark": "DK", "finland": "FI", "iceland": "IS",
  "ireland": "IE", "poland": "PL", "czechia": "CZ", "czech republic": "CZ", "greece": "GR", "turkey": "TR",
  "japan": "JP", "south korea": "KR", "korea": "KR", "china": "CN", "india": "IN",
  "australia": "AU", "new zealand": "NZ", "south africa": "ZA", "nigeria": "NG",
  "uae": "AE", "dubai": "AE", "israel": "IL", "singapore": "SG", "thailand": "TH",
  "philippines": "PH", "indonesia": "ID", "puerto rico": "PR", "jamaica": "JM",
};

export const COUNTRY_LIST: { code: string; name: string }[] = [
  { code: "US", name: "United States" }, { code: "CA", name: "Canada" }, { code: "MX", name: "Mexico" },
  { code: "GB", name: "United Kingdom" }, { code: "IE", name: "Ireland" }, { code: "FR", name: "France" },
  { code: "DE", name: "Germany" }, { code: "ES", name: "Spain" }, { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" }, { code: "NL", name: "Netherlands" }, { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" }, { code: "AT", name: "Austria" }, { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" }, { code: "DK", name: "Denmark" }, { code: "PL", name: "Poland" },
  { code: "BR", name: "Brazil" }, { code: "AR", name: "Argentina" }, { code: "CO", name: "Colombia" },
  { code: "CL", name: "Chile" }, { code: "JP", name: "Japan" }, { code: "KR", name: "South Korea" },
  { code: "AU", name: "Australia" }, { code: "NZ", name: "New Zealand" }, { code: "ZA", name: "South Africa" },
  { code: "AE", name: "UAE" }, { code: "SG", name: "Singapore" }, { code: "PR", name: "Puerto Rico" },
];
