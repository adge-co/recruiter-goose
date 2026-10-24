// Company job boards the engine reads directly. These come straight from the employer's
// own hiring system, so they're as legit as postings get. Grow this list by industry.
// A wrong token just fails quietly and shows up in `npm run check-directory`.
// confirmed: true means the board was seen live in Gus's job search (Oct 2026).
// Every board below answered in the live test on Oct 20, 2026. Removed because their token 404'd:
// ServiceTitan, Procore, Buildertrend, Billd, Housecall Pro (find their real board names before adding back). Jobber is back on Ashby.

export const INDUSTRIES = {
  "construction-tech": "Construction Tech",
  "building-materials": "Building Materials",
  "trades-software": "Software for the Trades",
  "proptech": "Homebuilding and Property Tech",
  "saas": "General Software",
  "logistics": "Logistics and Supply Chain",
  "energy": "Energy and Battery Storage",
};

export const DIRECTORY = [
  { name: "SupplyHouse.com", ats: "greenhouse", token: "supplyhouse", industries: ["building-materials", "logistics"], confirmed: true },
  { name: "Material Bank", ats: "greenhouse", token: "materialbank", industries: ["building-materials"], confirmed: true },
  { name: "Higharc", ats: "ashby", token: "higharc", industries: ["construction-tech", "proptech"], confirmed: true },
  { name: "OpenSpace", ats: "greenhouse", token: "openspace", industries: ["construction-tech"] },
  { name: "BuildOps", ats: "ashby", token: "buildops", industries: ["trades-software"] },
  { name: "Kojo", ats: "ashby", token: "kojo", industries: ["construction-tech", "building-materials"] },
  { name: "Samsara", ats: "greenhouse", token: "samsara", industries: ["logistics", "saas"] },
  { name: "Flexport", ats: "greenhouse", token: "flexport", industries: ["logistics"] },
  { name: "project44", ats: "greenhouse", token: "project44", industries: ["logistics", "saas"] },
  { name: "EliseAI", ats: "ashby", token: "eliseai", industries: ["proptech", "saas"] },
  // Added Oct 20, 2026: each token returned a live board from its public API that day.
  { name: "Fieldwire", ats: "greenhouse", token: "fieldwire", industries: ["construction-tech"] },
  { name: "Hover", ats: "greenhouse", token: "hover", industries: ["construction-tech", "proptech"] },
  { name: "Doxel", ats: "lever", token: "doxel", industries: ["construction-tech"] },
  { name: "Bobyard", ats: "ashby", token: "bobyard", industries: ["construction-tech"] },
  { name: "Parspec", ats: "ashby", token: "parspec", industries: ["building-materials", "construction-tech"] },
  { name: "Curri", ats: "ashby", token: "curri", industries: ["building-materials", "logistics"] },
  { name: "JobNimbus", ats: "greenhouse", token: "jobnimbus", industries: ["trades-software"] },
  { name: "ServiceTrade", ats: "greenhouse", token: "servicetrade", industries: ["trades-software"] },
  { name: "Fleetio", ats: "greenhouse", token: "fleetio", industries: ["trades-software", "logistics", "saas"] },
  { name: "SimpliSafe", ats: "greenhouse", token: "simplisafe", industries: ["trades-software"] },
  { name: "Motive", ats: "greenhouse", token: "gomotive", industries: ["logistics", "saas"] },
  { name: "Platform Science", ats: "greenhouse", token: "platformscience", industries: ["logistics", "saas"] },
  { name: "Geotab", ats: "greenhouse", token: "geotab", industries: ["logistics", "saas"] },
  { name: "Uber Freight", ats: "greenhouse", token: "uberfreight", industries: ["logistics"] },
  { name: "Loadsmart", ats: "lever", token: "loadsmart", industries: ["logistics"] },
  { name: "Flexe", ats: "greenhouse", token: "flexe", industries: ["logistics"] },
  { name: "ShipMonk", ats: "greenhouse", token: "shipmonk", industries: ["logistics"] },
  { name: "Vooma", ats: "ashby", token: "vooma", industries: ["logistics", "saas"] },
  { name: "Redwood Materials", ats: "greenhouse", token: "redwoodmaterials", industries: ["energy"] },
  { name: "ChargePoint", ats: "greenhouse", token: "chargepoint", industries: ["energy"] },
  { name: "Sunnova", ats: "greenhouse", token: "sunnova", industries: ["energy"] },
  // Added Oct 23, 2026: each token returned a live board with open jobs that day (checked from the Supabase server),
  // and the postings named the right company.
  { name: "Built Technologies", ats: "greenhouse", token: "getbuilt", industries: ["construction-tech"] },
  { name: "Siteline", ats: "greenhouse", token: "siteline", industries: ["construction-tech"] },
  { name: "CompanyCam", ats: "ashby", token: "companycam", industries: ["construction-tech", "trades-software"] },
  { name: "Workyard", ats: "ashby", token: "workyard", industries: ["construction-tech"] },
  { name: "Tenna", ats: "lever", token: "tenna", industries: ["construction-tech"] },
  { name: "Handoff", ats: "lever", token: "handoff", industries: ["construction-tech"] },
  { name: "Roofr", ats: "greenhouse", token: "roofr", industries: ["trades-software", "construction-tech"] },
  { name: "Jobber", ats: "ashby", token: "jobber", industries: ["trades-software"] },
  { name: "WorkWave", ats: "lever", token: "workwave", industries: ["trades-software"] },
  { name: "Thumbtack", ats: "ashby", token: "thumbtack", industries: ["trades-software"] },
  { name: "Angi", ats: "ashby", token: "angi", industries: ["trades-software"] },
  { name: "Lessen", ats: "lever", token: "lessen", industries: ["proptech", "trades-software"] },
  { name: "Arrive Logistics", ats: "lever", token: "arrivelogistics", industries: ["logistics"] },
  { name: "Cargomatic", ats: "greenhouse", token: "cargomatic", industries: ["logistics"] },
  { name: "SPAN", ats: "ashby", token: "span", industries: ["energy"] },
];
