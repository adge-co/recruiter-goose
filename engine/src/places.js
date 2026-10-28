// Where a job is, as people mean it: "Dallas, TX" means the whole Dallas-Fort Worth area, and not Dallas, GA.
// One list for the matcher and the crawl (which reads Texas postings first).

export const METROS = {
  dfw: ["dallas", "fort worth", "ft worth", "dfw", "metroplex", "arlington", "plano", "irving", "garland", "frisco", "mckinney",
    "grand prairie", "mesquite", "denton", "carrollton", "richardson", "lewisville", "allen", "flower mound", "grapevine", "coppell",
    "addison", "farmers branch", "mansfield", "euless", "bedford", "hurst", "north richland hills", "keller", "southlake", "rockwall",
    "rowlett", "wylie", "little elm", "the colony", "prosper", "celina", "cedar hill", "desoto", "duncanville", "lancaster",
    "midlothian", "waxahachie", "weatherford", "burleson", "haltom city", "saginaw", "roanoke", "northlake", "haslet", "forney",
    "sachse", "murphy", "corinth", "las colinas", "red oak", "anna", "melissa", "princeton", "terrell", "cleburne", "azle", "crowley"],
  houston: ["houston", "katy", "sugar land", "the woodlands", "spring", "cypress", "pearland", "pasadena", "conroe", "baytown", "humble", "tomball", "league city", "missouri city", "stafford"],
  austin: ["austin", "round rock", "cedar park", "georgetown", "pflugerville", "leander", "kyle", "san marcos", "buda"],
  "san antonio": ["san antonio", "new braunfels", "schertz", "boerne", "seguin", "converse", "selma"],
};

// Whole names people type for a metro.
const ALIASES = { dfw: ["dallas fort worth", "dallas ft worth", "dfw metroplex", "dfw area", "north texas"] };

// The state each metro is in, so "Dallas" or "DFW" with no state still means Texas.
const METRO_STATE = { dfw: "tx", houston: "tx", austin: "tx", "san antonio": "tx" };

const STATES = { al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california", co: "colorado", ct: "connecticut", de: "delaware",
  fl: "florida", ga: "georgia", hi: "hawaii", id: "idaho", il: "illinois", in: "indiana", ia: "iowa", ks: "kansas", ky: "kentucky", la: "louisiana",
  me: "maine", md: "maryland", ma: "massachusetts", mi: "michigan", mn: "minnesota", ms: "mississippi", mo: "missouri", mt: "montana",
  ne: "nebraska", nv: "nevada", nh: "new hampshire", nj: "new jersey", nm: "new mexico", ny: "new york", nc: "north carolina", nd: "north dakota",
  oh: "ohio", ok: "oklahoma", or: "oregon", pa: "pennsylvania", ri: "rhode island", sc: "south carolina", sd: "south dakota", tn: "tennessee",
  tx: "texas", ut: "utah", vt: "vermont", va: "virginia", wa: "washington", wv: "west virginia", wi: "wisconsin", wy: "wyoming", dc: "district of columbia" };
const NAME_TO_CODE = Object.fromEntries(Object.entries(STATES).map(([k, v]) => [v, k]));

const clean = s => String(s || "").toLowerCase().replace(/[.’']/g, "").replace(/[^a-z0-9,]+/g, " ").replace(/\s+/g, " ").trim();
const word = (text, w) => new RegExp(`(^|[^a-z])${w.replace(/ /g, "[ -]")}($|[^a-z])`).test(text);

// The states a location names: "Dallas, TX" or "Dallas, Texas" -> ["tx"].
export function statesIn(location) {
  const raw = String(location || ""), t = clean(raw), out = new Set();
  for (const m of raw.matchAll(/(?:,|\s|^|-)([A-Z]{2})(?=$|[\s,;)\-/])/g)) if (m[1] !== "US") if (STATES[m[1].toLowerCase()]) out.add(m[1].toLowerCase());
  for (const [name, code] of Object.entries(NAME_TO_CODE)) if (word(t, name)) out.add(code);
  return [...out];
}

// Every place name that counts as the city someone typed.
// "Dallas-Fort Worth", "Dallas/Fort Worth", "Dallas TX": the city part, without the state.
export function cityPart(city) {
  const whole = clean(String(city || "").replace(/[\/\u2013\u2014-]/g, " "));
  if (Object.values(METROS).some(l => l.includes(whole))) return whole;
  for (const [k, list] of Object.entries(METROS)) if (ALIASES[k]?.some(a => whole.startsWith(a))) return list[0];
  return clean(String(city || "").split(",")[0]).replace(/\s+(tx|texas|[a-z]{2})$/, (m, st) => STATES[st] || NAME_TO_CODE[st] ? "" : m).trim();
}
export function placeNames(city) {
  const c = cityPart(city);
  const metro = Object.values(METROS).find(list => list.includes(c));
  return metro || (c ? [c] : []);
}

// Whether a posting's location is in (or around) the city someone asked for.
export function inCity(location, city) {
  const t = clean(location);
  if (!placeNames(city).some(n => word(t, n))) return false;
  const c = cityPart(city);
  const metro = Object.keys(METROS).find(k => METROS[k].includes(c));
  const typed = statesIn(String(city || "").replace(/^[^,]*?(?=\s+[A-Z]{2}$)/, "").split(",").slice(-1).join(",")).filter(() => /,|\s[A-Z]{2}$/.test(String(city || "")));
  const want = typed.length ? typed : metro ? [METRO_STATE[metro]] : [];
  const has = statesIn(location);
  return !want.length || !has.length || has.some(s => want.includes(s));
}

// Texas, for reading Texas postings first on the big boards.
export const isTexas = location => statesIn(location).includes("tx") || [...METROS.dfw, ...METROS.houston, ...METROS.austin, ...METROS["san antonio"]].some(n => word(clean(location), n)) && !statesIn(location).some(s => s !== "tx");
