// A resume made for one job, and the email that goes with it. Plain rules, no AI, run in the browser.
// It never adds anything the person hasn't written: it picks their most fitting lines, puts the posting's
// words they already have first, and lists the posting's words they don't have so they can decide.
// Loaded by the app as window.Tailor; the engine tests load it with require().
(function () {
  // English and Spanish month names ("Ene 2018 – Presente"), for the many bilingual resumes in Texas.
  const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|ene(?:ro)?|febrero|marzo|abr(?:il)?|mayo|junio|julio|ago(?:sto)?|sept?iembre|octubre|noviembre|dic(?:iembre)?)\\.?";
  const RANGE = new RegExp(`(?:${MONTH}\\s+|\\d{1,2}/)?(?:19|20)\\d{2}\\s*(?:-|–|—|to)\\s*(?:presente|present|actualidad|actualmente|actual|current|now|today|(?:${MONTH}\\s+|\\d{1,2}/)?(?:19|20)\\d{2})`, "i");
  const HEAD_ONE = "profile|summary|professional summary|career summary|objective|about me|contact|experience|work experience|professional experience|relevant experience|employment|employment history|work history|career history|experiencia|experiencia laboral|education|educación|educacion|skills|top skills|core skills|key skills|technical skills|skills and tools|core competencies|areas of expertise|qualifications|summary of qualifications|habilidades|certifications|licenses|certifications and licenses|references|projects|training|certs|skills & tools|skills and certifications|licenses and certifications|key accomplishments|accomplishments|highlights|career highlights|achievements|languages|idiomas|apprenticeship|apprenticeship and training|selected projects|key projects|notable projects|project list|career snapshot|snapshot|career overview|at a glance|career timeline|tools|equipment|tools and equipment|software|licenses and certifications|certifications and training";
  // A heading, alone on its line, in either language: "EXPERIENCIA / EXPERIENCE".
  const HEADING0 = new RegExp(`^(?:${HEAD_ONE})(?:\\s*/\\s*(?:${HEAD_ONE}))?\\s*:?$`, "i");
  // Any short "… Experience / History / Employment" heading ("MILITARY EXPERIENCE", "Work History (oldest first)"), and "MILITARY SERVICE" in capitals.
  const WORK_HEAD = /^(?:[A-Za-z&-]+ ){0,3}(?:experience|history|employment)(?: \([^)]{0,30}\))?:?$/i, CAPS_HEAD = /^(?:[A-Z&]+ ){0,2}(?:MILITARY|SERVICE)(?: [A-Z&]+){0,2}:?$/;
  const HEADING = { test: l => HEADING0.test(l.replace(/\s*&\s*/g, " and ")) || WORK_HEAD.test(l) || CAPS_HEAD.test(l) };
  // A heading with its list on the same line: "Skills & Tools: Procore; Excel".
  const HEAD_INLINE = /^(skills|core skills|key skills|technical skills|skills and tools|skills & tools|tools|software|certs|certifications|licenses|education|training)\s*:\s*(.+)$/i;
  // How people separate a list of skills: commas, bars, dots, check marks, arrows, or " / ".
  const SKILL_SPLIT0 = /\s*[,;|•·✓✔➢►▸♦]\s*|\s+\/\s+/;
  const SKILL_SPLIT = { [Symbol.split]: str => str.replace(/\([^)]*\)/g, m => m.replace(/,/g, "\u0001")).split(SKILL_SPLIT0).map(x => x.replace(/\u0001/g, ",")) };
  // A line that starts with what someone did ("Quoted doors…", "Ran the forklift…") is a line about the work, marked or not.
  const DID = /^(?:[a-z]+ed|ran|set|led|built|kept|made|took|sold|bought|grew|won|cut|wrote|drove|taught|met|oversaw|(?:build|track|count|process|schedule|enter|coordinate|answer|order|run|manage|lead|train|quote|price|handle|load|pull|receive|ship|support|maintain|prepare|review|create|update|assist|work|walk|read|write|send|do|issue|negotiate|plan|supervise|oversee|keep|cut|install|wire|frame|own|help|call|close|open|resolve|reduce|increase|improve|deliver|stage|pick|pack|check|inspect|estimate|bid|sell|buy|serve|teach|operate|clean|sort|stock|file|book|dispatch|route|cover)(?:s|es)?)\b/i;
  const STATE_CODES = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
  const BULLET = /^\s*(?:[-•·*▪●◦‣–o➢►▸✓✔♦❖→]|\d+[.)])\s+/;   // "o" is what Word turns hollow bullets into when pasted
  const TITLE_WORD = /\b(manager|agent|specialist|coordinator|buyer|estimator|analyst|consultant|supervisor|lead|director|representative|rep|associate|engineer|technician|foreman|superintendent|administrator|assistant|owner|planner|purchaser|salesperson|sales|counter|desk|yard|clerk|dispatcher|scheduler|trainer|advisor|officer|president|founder|operator|installer|designer|developer|accountant|controller|expeditor|merchandiser|driver|server|bartender|carpenter|electrician|plumber|apprentice|journeyman|laborer|warehouse)\b/i;

  // Words recruiters and job posts use for this kind of work. A posting word only counts if it's on this list,
  // so filler like "fast-paced" or "rockstar" never shows up as something to add.
  const WORDS = [
    "purchasing", "procurement", "purchase orders", "vendor management", "supplier management", "sourcing", "negotiation", "negotiating",
    "lead times", "inventory", "receiving", "shipping", "warehouse", "logistics", "supply chain", "dispatch", "scheduling", "forecasting",
    "budgeting", "budgets", "P&L", "cost control", "quoting", "quotes", "pricing", "estimating", "estimates", "takeoffs", "bids", "bidding",
    "blueprints", "plans", "specs", "specifications", "submittals", "RFIs", "change orders", "project management", "project coordination",
    "customer service", "customer success", "account management", "accounts", "contractors", "general contractors", "subcontractors",
    "builders", "distributors", "dealers", "supply houses", "lumber", "building materials", "doors", "windows", "millwork", "HVAC",
    "electrical", "roofing", "framing", "onboarding", "implementation", "training", "process improvement", "reporting", "data entry",
    "documentation", "safety", "OSHA", "quality", "compliance", "operations", "field operations", "jobsite", "site visits",
    "Excel", "Google Sheets", "Power BI", "Tableau", "SQL", "Salesforce", "HubSpot", "Procore", "Bluebeam", "PlanSwift", "AutoCAD", "Revit",
    "SAP", "Oracle", "NetSuite", "QuickBooks", "Epicor", "BisTrack", "Spruce", "Microsoft Dynamics", "Hyphen", "SupplyPro", "BuildPro",
    "ServiceTitan", "Buildertrend", "JobNimbus", "Sage", "Viewpoint", "ERP", "CRM", "SaaS", "software", "troubleshooting", "support",
    "cross-functional", "stakeholders", "relationships", "communication", "problem solving", "leadership", "team lead", "hiring", "coaching",
    // counter, yard and trade work
    "counter sales", "inside sales", "outside sales", "will call", "forklift", "CDL", "deliveries", "cycle counts", "bilingual", "Spanish", "EPA 608", "NATE",
    "service calls", "maintenance agreements", "plumbing", "waterworks", "fittings", "valves", "water heaters", "Eclipse", "Prophet 21", "DMSi", "Agility",
  ];
  const norm = s => " " + String(s || "").toLowerCase().replace(/[^a-z0-9&+ ]+/g, " ").replace(/\s+/g, " ") + " ";
  const esc = w => w.toLowerCase().replace(/[^a-z0-9&+ ]+/g, " ").trim().replace(/\s+/g, " ");
  const has = (text, w) => text.includes(" " + esc(w) + " ") || (!/s$/.test(w) && text.includes(" " + esc(w) + "s "));
  const CONTEXT = new Set(["contractors", "general contractors", "subcontractors", "builders", "distributors", "dealers", "supply houses", "lumber", "building materials",
    "doors", "windows", "millwork", "hvac", "electrical", "roofing", "framing", "software", "saas", "jobsite", "accounts", "relationships", "communication",
    "stakeholders", "cross-functional", "plans", "specs", "quotes", "estimates", "support", "operations", "field operations", "site visits", "warehouse", "hiring",
    "plumbing", "waterworks", "fittings", "valves", "water heaters", "deliveries"]);
  // Words a recruiter reads as the same thing.
  const SAME = [["purchasing", "procurement", "sourcing"], ["vendor management", "supplier management"], ["estimating", "estimates"], ["quoting", "quotes"], ["negotiation", "negotiating"], ["bids", "bidding"], ["takeoffs", "takeoff"]];
  // Other forms of a word that show the same work ("Purchase lumber", "place POs" show purchasing and purchase orders). They count as a match,
  // but the resume and email always use the person's own words.
  const FORMS = { purchasing: ["purchase", "purchased", "purchaser", "compras", "compro", "comprador", "compradora"], /* never "buyers": a superintendent walks homes with buyers */ "purchase orders": ["po", "pos", "purchase order"], inventory: ["inventario", "inventories", "cycle count", "cycle counts", "dead stock", "stock levels", "reorder points", "fill rate"],
    estimating: ["estimator", "estimated"], quoting: ["quoted", "quote"], pricing: ["priced", "price"], scheduling: ["schedule", "scheduled", "scheduler"], negotiation: ["negotiate", "negotiated"],
    dispatch: ["dispatched", "dispatcher", "dispatching"], receiving: ["received", "receive"], shipping: ["shipped", "ship"], budgeting: ["budget"], forecasting: ["forecast", "forecasted"],
    training: ["trained", "train"], bidding: ["bid"], takeoffs: ["takeoff", "take-offs", "take offs"], "vendor management": ["vendors", "vendor relations", "suppliers"], "customer service": ["customers"], "data entry": ["entered", "entering"] };
  const hasAny = (text, w) => has(text, w) || (SAME.find(g => g.includes(w.toLowerCase())) || []).some(x => has(text, x) || (FORMS[x] || []).some(f => has(text, f))) || (FORMS[w.toLowerCase()] || []).some(f => has(text, f));
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const tc = s => String(s).replace(/\b([a-z])/g, c => c.toUpperCase());

  // ---------- Read a pasted or uploaded resume into parts the person can edit ----------
  // Undo what PDF and Word exports do to text before reading it: letter-spaced headings ("S K I L L S"), spaced punctuation
  // ("Denton , TX", "x @ gmail.com", "940 - 555 - 0193"), two columns side by side, and LinkedIn's company-then-title order.
  function prep(text) {
    let lines = String(text || "").replace(/\r/g, "").split("\n").map(l => l
      .replace(/(^|\s{2,})((?:[\p{L}'’&](?: |$)){3,})/gu, (m, gap, run) => gap + run.replace(/ /g, "") + " ")   // "K A T H E R I N E" -> "KATHERINE"
      .replace(/ +([,;:])(?= )/g, "$1").replace(/ *@ */g, "@").replace(/\b(\d{3}) - (\d{3}) - (\d{4})\b/g, "$1-$2-$3")
      .replace(/\s*\((?:\d+ years?)?\s*(?:\d+ months?)?\)\s*$/i, "").replace(/\s+$/, ""));
    // Two columns: several lines with a wide gap whose right side isn't just dates. Read the left column, then the right.
    const gap = /^(.*?\S)\s{6,}(\S.*)$/, wide = lines.map(l => l.match(gap)).filter(m => m && !new RegExp(`^${RANGE.source}$`, "i").test(m[2].trim()));
    let twoColumn = false;
    if (wide.length >= 4) {
      twoColumn = true;
      const left = [], right = [];
      for (const l of lines) {
        if (/^\s{20,}\S/.test(l)) { right.push(l.trim()); continue; }
        const m = l.match(gap);
        if (m && !new RegExp(`^${RANGE.source}$`, "i").test(m[2].trim())) { left.push(m[1]); right.push(m[2]); } else left.push(l);
      }
      lines = [...left, ...right];
    }
    // "Pinnacle Drywall Inc. / Junior Estimator / May 2023 - Present": company first, then title, then dates (LinkedIn, many templates).
    for (let i = 0; i + 2 < lines.length; i++) {
      const [a, b, c] = [lines[i].trim(), lines[i + 1].trim(), lines[i + 2].trim()];
      if (a && b && a.length < 60 && b.length < 60 && !RANGE.test(a) && !RANGE.test(b) && RANGE.test(c) && c.replace(RANGE, "").replace(/[\s,|·•–—()-]/g, "").length < 4
        && !TITLE_WORD.test(a) && TITLE_WORD.test(b) && !HEADING.test(a) && !BULLET.test(a) && !BULLET.test(b)) { lines[i] = `${b} — ${a}`; lines[i + 1] = ""; }
    }
    // A place on its own line under a job ("Dallas, Texas, United States") isn't a line about the work.
    lines = lines.filter((l, i) => i < 8 || !/^\s*[A-Z][\p{L}.' -]+,\s*[A-Z][a-z]+(?: [A-Z][a-z]+)?(?:,\s*United States)?\s*$/u.test(l) || /\d|@/.test(l));
    return { lines, twoColumn, top: String(text || "").split(/\r?\n/).filter(l => l.trim()).slice(0, 6).map(l => l.trim().split(/\s{6,}/)).flat() };
  }
  function readResume(text) {
    // Tab columns ("06/2018 - Current<tab>PURCHASING AGENT<tab>ABC Mechanical") become " | " so each column stays its own part.
    const raw0 = prep(text);
    const ONE_LINE_JOB = new RegExp(`^(.{3,140}?${RANGE.source}\\)?)\\s*:\\s+(\\S.*)$`, "i");   // "Counter Sales, Johnstone Supply, NRH TX, Oct 2022-Present: sell HVAC parts…"
    const lines = raw0.lines.map(l => l.replace(/^\t+/, "").replace(/\t+/g, " | ").replace(/^o \| /, "o ").replace(/ {2,}/g, " ").trimEnd())
      .filter(l => l.trim() && !/(^|\|\s*)page \d+( of \d+)?\s*$/i.test(l.trim()) && !/^\d{1,2}$/.test(l.trim()))   // "Keisha Brown-Miller | Page 2 of 2"
      .flatMap(l => { const m = !BULLET.test(l) && l.match(ONE_LINE_JOB); return m ? [m[1], "- " + m[2][0].toUpperCase() + m[2].slice(1)] : [l]; });
    const all = lines.join("\n");
    const out = { name: "", email: "", phone: "", city: "", jobs: [], skills: [], education: [], ...(raw0.twoColumn ? { twoColumn: true } : {}) };
    out.email = (all.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [""])[0];
    out.phone = clean((all.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/) || [""])[0]);
    // The top lines, split where people put separators: "jose ramirez ~ jramirez77@yahoo.com ~ 817.555.0123".
    const top = lines.slice(0, 6).flatMap(l => l.split(/\s+[~|•·]\s+/)).map(clean);
    // The name: two to four words of letters (accents too: "José Luis Hernández-Treviño"), near the top, not a heading or a job title.
    // LinkedIn exports put it below the Contact and Top Skills sidebar, so look a little further down.
    const NAME = /^[\p{L}][\p{L}.'’-]+(?: (?:"[\p{L}]+"|\([\p{L}]+\)|[\p{L}][\p{L}.'’-]*)){1,4}$/u;
    const nameLines = lines.slice(0, 14).flatMap(l => l.split(/\s+[~|•·]\s+/)).map(clean)
      .map(l => l.replace(/,?\s+(?:(?:CPPB|CPSM|CPM|CPPO|CSCP|CPIM|PMP|PE|P\.E\.|MBA|LEED AP|CHST|CSP|CDL)\b,?\s*)+$/, ""))   // "JAMAL REEVES, CPPB"
      .map(l => l.replace(/^([\p{L}'’-]+), ([\p{L}'’-]+)(.*)$/u, "$2 $1$3"));   // "NGUYEN, THANH" -> "THANH NGUYEN"
    const firstHead = lines.slice(0, 14).findIndex(l => HEADING.test(clean(l)));
    const isName = l => NAME.test(l) && !HEADING.test(l) && !TITLE_WORD.test(l) && !/\b(street|st|ave|road|rd|drive|dr|tx|texas|linkedin|resume|curriculum)\b/i.test(l);
    const above = firstHead > 0 ? lines.slice(0, firstHead).flatMap(l => l.split(/\s+[~|•·]\s+/)).map(clean).map(l => l.replace(/,?\s+(?:(?:CPPB|CPSM|CPM|CPPO|CSCP|CPIM|PMP|PE|MBA|CDL)\b,?\s*)+$/, "")) : [];
    let name = above.find(isName) || nameLines.find(l => NAME.test(l) && !HEADING.test(l) && !TITLE_WORD.test(l) && !/\b(street|st|ave|road|rd|drive|dr|tx|texas|linkedin|resume|curriculum)\b/i.test(l)) || "";
    name = name.replace(/\s*("[^"]+"|\([^)]+\))\s*/g, " ").trim();   // a nickname in quotes stays off the header
    out.name = name === name.toUpperCase() || name === name.toLowerCase() ? tc(name.toLowerCase()).replace(/\bJr\b/, "Jr.") : name;   // "MARCUS DELGADO" -> "Marcus Delgado"
    const STATE_NAMES = { texas: "TX", oklahoma: "OK", louisiana: "LA", arkansas: "AR", "new mexico": "NM", arizona: "AZ", colorado: "CO", florida: "FL", georgia: "GA", tennessee: "TN", california: "CA" };
    const place = [...raw0.top, ...top].join(" | ").match(new RegExp(`\\b([A-Z][a-zA-Z.]+(?: [A-Z][a-zA-Z.]+){0,2}),? (${STATE_CODES}|${Object.keys(STATE_NAMES).map(tc).join("|")}|${Object.keys(STATE_NAMES).join("|").toUpperCase()})\\b(?! ?\\d{3}[\\s.-]\\d)`));
    const caps = x => x === x.toUpperCase() ? tc(x.toLowerCase()) : x;
    out.city = place ? `${caps(place[1])}, ${STATE_NAMES[place[2].toLowerCase()] || place[2]}` : "";   // "GRAND PRAIRIE TX", "Fort Worth Texas" -> "Grand Prairie, TX", "Fort Worth, TX"
    // Where they're moving: "(moving to Dallas–Fort Worth area, Jan 2027)" or a line of its own, "Relocating to Fort Worth, TX".
    // Kept as one clean place ("Dallas-Fort Worth, TX"), never the date or "area", since the search runs on it.
    const moveLine = lines.slice(0, 14).join("\n").match(/\b(?:relocating|moving|relocation|will relocate) to ([^)\n]{2,60})/i);
    let moving = moveLine ? moveLine[1] : "";
    if (moving) {
      moving = moving.replace(/[–—]/g, "-").replace(new RegExp(`\\b(?:in |by |this |next )?(?:(?:early|mid|late|summer|fall|spring|winter)\\b\\s*)?(?:${MONTH}\\s*)?(?:19|20)\\d{2}\\b.*$`, "i"), "")
        .replace(new RegExp(`(?:,?\\s*(?:in|by)\\s+)?${MONTH}\\b.*$`, "i"), "").replace(/\b(area|metro(plex)?|region)\b/gi, "").replace(/[\s,;.-]+$/, "").replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
      if (/\b(dallas-? ?fort worth|dfw|metroplex)\b/i.test(moving) || /^dallas-fort worth$/i.test(moving)) moving = "Dallas-Fort Worth, TX";
      else { const m = moving.match(new RegExp(`^([A-Za-z.]+(?: [A-Za-z.]+){0,2}),? (${STATE_CODES}|${Object.keys(STATE_NAMES).join("|")})\\b`, "i")); moving = m ? `${tc(m[1].toLowerCase())}, ${STATE_NAMES[m[2].toLowerCase()] || m[2].toUpperCase()}` : /^[A-Za-z .]{3,30}$/.test(moving) ? tc(moving.toLowerCase()) : ""; }
    }
    if (!out.city && /\b(dallas[- ]fort worth|dfw)\b/i.test(lines.slice(0, 14).join(" "))) out.city = "Dallas-Fort Worth, TX";
    if (moving && out.city && moving !== out.city) out.city += ` (relocating to ${moving})`; else if (moving && !out.city) out.city = moving;

    // "84 LUMBER - GRAND PRAIRIE TX" -> "84 Lumber": the place isn't part of the name, and all caps reads as shouting.
    // A state code only comes off when a city sits before it ("SPARKS ELECTRIC CO" keeps its CO); LLC and LP stay capitals.
    const tidyCompany = c => { c = clean(c).replace(new RegExp(`\\s*[,–—-]\\s*[A-Za-z .]+,? (?:${STATE_CODES})$`, "i"), "").replace(/,\s*[\p{L} .]+,\s*(?:[A-Z]\.){2,}$/u, "").replace(/\s*,\s*$/, ""); return c === c.toUpperCase() && /[A-Z]{3}/.test(c) ? tc(c.toLowerCase()).replace(/\b(Llc|Lp|Llp|Pllc|Usa|Hvac|Abc)\b/g, x => x.toUpperCase()) : c; };
    let section = "", job = null;
    const startJob = (head, next) => {
      const alone = next && !clean(next.replace(new RegExp(RANGE.source, "gi"), "").replace(/[\s,|·•–—()-]+/g, " "));
      const dates = (head.match(RANGE) || (alone ? next.match(RANGE) : null) || [""])[0];
      let rest = clean(head.replace(RANGE, "").replace(/\(\s*\)/g, "").replace(/^[\s,|·•–—-]+|[,|·•–—-]+\s*$/g, ""));
      const parts = rest.split(/\s+[|•·]\s+|\s+[–—-]\s+|,\s+(?=[A-Z0-9])|\s+at\s+(?=[A-Z0-9])/);
      let [title, company] = parts;
      if (company && !TITLE_WORD.test(title) && TITLE_WORD.test(company)) [title, company] = [company, title];
      else if (parts.length > 2) company = parts.slice(1).join(", ").replace(/,\s*(remote|hybrid|on-?site)$/i, "");   // "Berkeys Air Conditioning, Plumbing & Electrical, Mesquite, TX"
      title = clean(title);
      if (title === title.toUpperCase() && /[A-Z]{3}/.test(title)) title = tc(title.toLowerCase());   // "PURCHASING AGENT" -> "Purchasing Agent"
      job = { title, company: tidyCompany(company || ""), dates: clean(dates), bullets: [] };
      out.jobs.push(job);
    };
    lines.forEach((raw, i) => {
      const line = clean(raw);
      if (HEADING.test(line)) { section = line.toLowerCase(); job = null; return; }
      if (out.name && line === out.name) { section = "about"; job = null; return; }   // LinkedIn: the name (and headline under it) ends the sidebar
      const inline = line.match(HEAD_INLINE);
      if (inline) { section = inline[1].toLowerCase(); job = null; if (/cert|licens|education|training/.test(section)) out.education.push(...inline[2].split(/\s*;\s*/).filter(Boolean)); else inline[2].split(SKILL_SPLIT).map(clean).filter(s => s && s.length < 40).forEach(s => out.skills.includes(s) || out.skills.push(s)); return; }
      if (/skill|tool|competenc|expertise|qualification|habilidad/.test(section) && !/cert|licens/.test(section)) { line.replace(BULLET, "").split(SKILL_SPLIT).map(clean).filter(s => s && s.length < 40).forEach(s => out.skills.includes(s) || out.skills.push(s)); return; }
      if (/educa|cert|licens|training|apprentice/.test(section)) {
        // A school's place and dates on their own lines join the line above: "Arlington High School - Arlington, TX · 2014 to 2018".
        const e = line.replace(BULLET, ""), prev = out.education[out.education.length - 1];
        const tail = /^(?:\(?(?:19|20)\d{2}|completed|graduated|expected|class of)\b/i.test(e) || new RegExp(`^${RANGE.source}$`, "i").test(e) || /^(?:19|20)\d{2} to (?:19|20)\d{2}$/.test(e) || new RegExp(`^[A-Z][A-Za-z.]+(?: [A-Z][A-Za-z.]+){0,2}, (?:${STATE_CODES})$`).test(e);
        const school = prev && /^(high school|associate|bachelor|master|ged|diploma|certificate|journeyman|apprentice)/i.test(prev) && !/\b(school|college|university|institute|academy|jatc|ibew|program)\b/i.test(prev.replace(/^high school/i, "")) && /\b(school|college|university|institute|academy|jatc|program)\b/i.test(e);
        if (prev && !BULLET.test(raw) && (tail || school)) out.education[out.education.length - 1] = `${prev} · ${e}`; else out.education.push(e);
        return;
      }
      if (/summary|profile|objective|references|about|contact|accomplish|highlight|achievement|language|idioma|projects|project list|snapshot|overview|at a glance|timeline/.test(section)) return;   // a projects list isn't a list of jobs
      if (/@|\d{3}[\s.)-]+\d{3}[\s.-]\d{4}/.test(line) && !RANGE.test(line)) return;   // contact lines
      if (!section && i < 5 && !RANGE.test(line)) return;   // the name and address block above the first heading
      const bullet = BULLET.test(raw), text = line.replace(BULLET, "");
      if (job && /^(territory|region|market|district|reports to|accounts|area)\s*:/i.test(text)) { (job.pre ||= []).push(text); return; }   // "Territory: North DFW — Denton…" belongs to the job above
      const last = job?.bullets[job.bullets.length - 1];
      if (!bullet && last && !/[.!]$/.test(last) && /^[a-z]/.test(text)) { job.bullets[job.bullets.length - 1] += " " + text; return; }   // a wrapped line
      // A title line: short, or any length when it carries the dates ("Counter Sales / Inside Sales — Red River…, Shreveport, LA  Mar 2019 – Present").
      const short = !bullet && (line.length < 90 || (RANGE.test(line) && line.length < 180)) && !/[.;!]$/.test(line.replace(/\b(inc|co|corp|ltd|jr|sr|llc|bros)\.$|(?:\b[A-Z]\.){2,}$/i, ""));
      if (short) {
        const bare = clean(line.replace(new RegExp(RANGE.source, "gi"), "").replace(/\(\s*\)/g, "").replace(/^[,|·•–—()-]+\s*|[,|·•–—()-]+\s*$/g, ""));
        const dates = clean((line.match(RANGE) || [""])[0]);
        if (job && !job.bullets.length) {   // the lines under a title: its company, its dates
          if (!bare) { job.dates ||= dates; return; }
          if (!job.company && !TITLE_WORD.test(bare) && !DID.test(bare)) { job.company = tidyCompany(bare); job.dates ||= dates; return; }
        }
        // A new job: the line has dates, or dates follow within two lines, or it names a title and isn't about what they did.
        // Unmarked lines under a job ("Quoted doors and windows for builders") stay that job's lines.
        const datesNext = [lines[i + 1], lines[i + 2]].some(l => l && RANGE.test(l) && !BULLET.test(l) && clean(l).length < 90);
        const titled = (datesNext || (TITLE_WORD.test(line) && bare.split(" ").length <= 8)) && !DID.test(bare);
        if (bare && (dates || titled || (!job && /experienc|employment|history/.test(section)))) return startJob(line, lines[i + 1]);
        if (!bare) return;
      }
      if (job && (bullet || line.length > 30 || DID.test(text) || text.split(" ").length > 3)) job.bullets.push(text);
    });
    for (const j of out.jobs) if (j.pre) { j.bullets.unshift(...j.pre); delete j.pre; }
    out.jobs = out.jobs.filter(j => j.title || j.bullets.length);
    // Oldest-first lists are turned around, so "most recently" is really the latest job.
    const ends = out.jobs.map(j => /present|current|now|today|actual/i.test(j.dates) ? 9999 : Number((j.dates.match(/(?:19|20)\d{2}/g) || []).pop()) || 0).filter(Boolean);
    if (ends.length >= 2 && ends[0] < ends[ends.length - 1]) out.jobs.reverse();
    out.jobs = out.jobs.slice(0, 12);
    out.skills = out.skills.slice(0, 24);
    out.education = out.education.slice(0, 6);
    return out;
  }

  // ---------- Make it for one job ----------
  // The posting's words worth matching, most-repeated first.
  function postingWords(job) {
    const t = norm(`${job.title} ${job.title} ${job.description || ""}`);
    const counts = WORDS.map(w => [w, t.split(" " + esc(w) + " ").length - 1 + (t.split(" " + esc(w) + "s ").length - 1)]).filter(([, n]) => n > 0);
    // Drop a word when a longer one that holds it also hit (keep "purchase orders", drop "orders").
    return counts.sort((a, b) => b[1] - a[1]).map(([w]) => w).filter((w, _, list) => !list.some(o => o !== w && o.toLowerCase().includes(w.toLowerCase()) && o.length > w.length + 2 && has(t, o)));
  }

  function tailor(resume, job, profile = {}) {
    const r = resume || {}, jobs = (r.jobs || []).filter(j => j.title || j.bullets?.length);
    const want = postingWords(job);
    const mine = norm([...jobs.flatMap(j => [j.title, /\b(buyer|purchas)/i.test(j.title) ? "purchasing" : "", j.company, ...(j.bullets || [])]), ...(r.skills || []), ...(r.education || []), ...(profile.skills || [])].join(" \n "));
    const fitsAll = want.filter(w => hasAny(mine, w));   // ranks their lines, customer and product words included
    const skillWant = want.filter(w => !CONTEXT.has(w.toLowerCase()));
    const matched = skillWant.filter(w => hasAny(mine, w));
    // Only skills and tools are offered as missing; who the customers are or what's sold (lumber, distributors) isn't something to add.
    const missing = want.filter(w => !hasAny(mine, w) && !CONTEXT.has(w.toLowerCase())).slice(0, 6);
    const hits = text => { const t = norm(text); return fitsAll.filter(w => hasAny(t, w)).length; };
    // A matched word in their own wording ("purchasing" when the posting says "procurement").
    const own = w => has(mine, w) ? w : (SAME.find(g => g.includes(w.toLowerCase())) || []).find(x => has(mine, x)) || w;
    const said = [...new Set(matched.map(own))];

    // Their lines, most fitting first inside each job, newest job keeps the most lines.
    const outJobs = jobs.map((j, idx) => {
      const keep = idx === 0 ? 5 : idx === 1 ? 4 : 3;
      const ranked = (j.bullets || []).map((b, i) => ({ b, i, n: hits(b) })).filter(x => clean(x.b));
      // Ties go to lines with a number in them (40+ jobs, 6%, $2M): recruiters read those first.
      ranked.sort((a, b) => b.n - a.n || /\d/.test(b.b) - /\d/.test(a.b) || a.i - b.i);
      // Lines that match nothing drop off, keeping at least three per job so it never looks thin.
      const fits = ranked.filter(x => x.n).length;
      const pick = ranked.slice(0, Math.max(fits, Math.min(2, ranked.length)));
      // Their best number always makes the cut: a kept line with no number gives way to one with a number.
      const numeric = ranked.find(x => /\d/.test(x.b));
      if (numeric && !pick.slice(0, keep).some(x => /\d/.test(x.b))) pick.splice(Math.min(pick.length, keep) - 1, 1, numeric);
      return { title: j.title, company: j.company, dates: j.dates, bullets: pick.slice(0, keep).map(x => x.b), dropped: ranked.length - Math.min(pick.length, keep) };
    });

    // One list, the resume's own spelling first: "Vendor Management" and "vendor management" are the same skill.
    const skillPool = [];
    for (const s0 of [...(r.skills || []), ...(profile.skills || [])].map(clean).filter(Boolean)) {
      const s1 = /^[a-z]/.test(s0) ? tc(s0) : s0;
      if (!skillPool.some(x => norm(x) === norm(s1))) skillPool.push(s1);
    }
    // "Inventory" next to "Inventory Control", or "OSHA" next to "OSHA 30", says the same thing twice: keep the longer one.
    for (let i = skillPool.length - 1; i >= 0; i--) if (skillPool.some(x => x !== skillPool[i] && norm(x).startsWith(norm(skillPool[i])))
      || (r.education || []).some(e => norm(e).startsWith(norm(skillPool[i])))) skillPool.splice(i, 1);   // "OSHA" when Certifications says "OSHA 10"
    const skills = [...skillPool.filter(s => want.some(w => hasAny(norm(s), w))), ...skillPool.filter(s => !want.some(w => hasAny(norm(s), w)))].slice(0, 14);
    // Posting words that appear in their own lines but not in their skills list go in the skills line too.
    for (const w of said) if (skills.length < 16 && !skills.some(s => norm(s).includes(norm(w).trim())) && /^[A-Z]|^(purchasing|procurement|estimating|takeoffs|scheduling|inventory|quoting|pricing|onboarding|implementation|training|vendor management|purchase orders)$/.test(w)) skills.push(/^[a-z]/.test(w) ? tc(w) : w);

    const years = Number(profile.years) || 0;
    const titles = [...new Set(jobs.filter(j => !GAP.test(j.title)).map(j => clean(j.title)).filter(Boolean))].slice(0, 2);
    const strong = said.filter(w => !/^(contractors|accounts|software|support|plans|quotes|estimates|relationships|communication)$/.test(w)).slice(0, 3);
    const headline = [titles.join(" · "), years ? `${years} Years` : ""].filter(Boolean).join(" · ");
    const work = jobs.filter(j => !GAP.test(j.title)), now0 = work[0];
    const recent = now0?.title ? `most recently ${asRole(now0.title)}${atCo(now0.company)}` : "";
    const summary = [
      years ? `${years} years of experience${recent ? ", " + recent : ""}.` : recent ? `${recent[0].toUpperCase()}${recent.slice(1).replace(/^(\w+ \w+) /, "$1 worked ")}.` : "",   // "Most recently worked as a Buyer at …"
      strong.length ? `Hands-on with ${list(strong.map(w => /^[A-Z]/.test(w) ? w : w.toLowerCase()))}.` : "",
    ].filter(Boolean).join(" ");
    const fit = skillWant.length ? Math.round(100 * matched.length / skillWant.length) : 0;
    return { name: r.name || profile.name || "", email: r.email || "", phone: r.phone || "", city: r.city || "", headline, summary,
      jobs: outJobs, skills, education: r.education || [], matched, said, missing, fit, words: skillWant.length };
  }
  // The resume's look, shared by the page and the PDF: Bright Office ink, gray and hairline (design/PERSONALITY.md).
  const PAPER = { ink: [18, 20, 23], muted: [95, 99, 107], line: [228, 225, 218] };
  const SECTIONS = { summary: "Summary", skills: "Skills", work: "Work Experience", education: "Education and Certifications" };
  // "as a Purchasing Agent", but "in Counter Sales": some titles name the work, not the person.
  const asRole = title0 => { const title = String(title0).split(/\s*\/\s*/)[0]; return /\b(sales|counter|desk|yard|warehouse|purchasing|estimating|operations|inventory|procurement|dispatch|receiving|shipping)$/i.test(String(title).trim())
    ? `in ${title}` : `as ${/^[aeiou]/i.test(title) ? "an" : "a"} ${title}`; };
  // Time away from work stays on the resume, but is never "most recently" or the email's example.
  const GAP = /\b(career break|sabbatical|caregiv|family leave|parental leave|maternity|paternity|stay[- ]at[- ]home|personal leave|relocation break)\b/i;
  // "at Red River Lumber Co", "in the U.S. Army"
  const atCo = c => !c ? "" : /\b(army|navy|air force|marine corps|marines|coast guard|national guard|space force)\b/i.test(c) ? ` in the ${c.replace(/^the /i, "").replace(/\.$/, "")}` : ` at ${c.replace(/\.$/, "")}`;
  const list = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

  // ---------- The email ----------
  function email(t, job) {
    const to = ((job.description || "").match(/[\w.+-]+@(?!example\.)[\w-]+(?:\.[a-z]{2,})+/i) || [""])[0];
    const first = (t.name || "").split(" ")[0];
    const subject = `Application: ${job.title}${t.name ? " - " + t.name : ""}`;
    const why = (t.said || t.matched).slice(0, 3).map(w => /^[A-Z]/.test(w) ? w : w.toLowerCase());
    // Name the job where those words actually show up, and take the example from that same job.
    const used = j => why.filter(w => norm(j.bullets.join(" ")).includes(norm(w).trim())).length;
    // The current job leads unless an older one covers clearly more (two words or more), since recruiters read the newest first.
    const at = (t.jobs || []).filter(j => !GAP.test(j.title)).reduce((best, j) => !best || used(j) >= used(best) + 2 ? j : best, null);
    const covered = at ? why.filter(w => norm(at.bullets.join(" ")).includes(norm(w).trim())) : [];
    const body = [
      `Hello ${job.company} hiring team,`,
      "",
      `I'm applying for the ${job.title} role. ${at?.title ? `I've worked ${asRole(at.title)}${atCo(at.company)}` : "My background is hands-on"}${covered.length ? `, where my work covered ${list(covered)}` : ""}.`,
      "",
      at?.bullets?.[0] ? `One example: ${at.bullets[0][0].toUpperCase()}${at.bullets[0].slice(1).replace(/\.?$/, ".")}` : "",
      "",
      "My resume is attached. I'd welcome a short call about the role.",
      "",
      "Thank you,",
      t.name || first || "",
      [t.phone, t.email].filter(Boolean).join(" · "),
    ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim();
    return { to, subject, body };
  }

  // ---------- The PDF (jsPDF, loaded by the app when needed) ----------
  function toPdf(t, jsPDF) {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = 612, M = 54, R = W - M, BOTTOM = 792 - 54;
    let y = 64;
    const room = h => { if (y + h > BOTTOM) { doc.addPage(); y = 60; } };
    const { ink, muted, line } = PAPER;
    const text = (s, size, style = "normal", x = M, color = ink) => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color); doc.text(String(s), x, y); };
    const wrap = (s, size, width) => { doc.setFontSize(size); return doc.splitTextToSize(String(s), width); };
    // Section headings as on screen: small capitals in ink over a hairline.
    const head = s => { y += 12; room(32); doc.setCharSpace(0.9); text(s.toUpperCase(), 9.5, "bold"); doc.setCharSpace(0); y += 5; doc.setDrawColor(...line); doc.setLineWidth(0.8); doc.line(M, y, R, y); y += 15; };

    text(t.name || "Your Name", 22, "bold"); y += 18;
    const contact = [t.city, t.phone, t.email].filter(Boolean).join("  ·  ");
    if (contact) { text(contact, 10, "normal", M, muted); y += 15; }
    if (t.headline) { text(t.headline, 11, "bold", M, muted); y += 8; }
    if (t.summary) { head(SECTIONS.summary); for (const l of wrap(t.summary, 10.5, R - M)) { room(14); text(l, 10.5); y += 14; } }
    if (t.skills.length) { head(SECTIONS.skills); for (const l of wrap(t.skills.join("  ·  "), 10.5, R - M)) { room(14); text(l, 10.5); y += 14; } }
    if (t.jobs.length) {
      head(SECTIONS.work);
      for (const j of t.jobs) {
        room(34);
        text(j.title || "", 11, "bold");
        if (j.dates) { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...muted); doc.text(j.dates, R, y, { align: "right" }); }
        y += 14;
        if (j.company) { text(j.company, 10.5, "normal", M, muted); y += 14; }
        for (const b of j.bullets) {
          const ls = wrap(b, 10.5, R - M - 14);
          room(ls.length * 13.5 + 2);
          text("•", 10.5, "normal", M + 2);
          ls.forEach((l, i) => { if (i) y += 13.5; text(l, 10.5, "normal", M + 14); });
          y += 15;
        }
        y += 6;
      }
    }
    if (t.education.length) { head(SECTIONS.education); for (const e of t.education) for (const l of wrap(e, 10.5, R - M)) { room(14); text(l, 10.5); y += 14; } }
    return doc;
  }
  const fileName = (t, job) => `${(t.name || "Resume").replace(/[^\p{L}\p{N} ]+/gu, "").trim()} - ${String(job.company).replace(/[^\p{L}\p{N} ]+/gu, "").trim()} ${String(job.title).replace(/[^\p{L}\p{N} ]+/gu, "").trim()}.pdf`.replace(/\s+/g, " ");

  // ---------- Gmail: a draft with the PDF attached, and what a reply means ----------
  const b64url = s => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  function mime({ to, subject, body }, pdfBase64, name) {
    const B = "rg" + Math.random().toString(36).slice(2);
    const enc = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`;
    return [
      ...(to ? [`To: ${to}`] : []), `Subject: ${enc(subject)}`, "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary="${B}"`, "",
      `--${B}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", btoa(unescape(encodeURIComponent(body))).replace(/.{76}/g, "$&\r\n"), "",
      `--${B}`, `Content-Type: application/pdf; name="${name}"`, `Content-Disposition: attachment; filename="${name}"`, "Content-Transfer-Encoding: base64", "", pdfBase64.replace(/.{76}/g, "$&\r\n"), "",
      `--${B}--`,
    ].join("\r\n");
  }
  // What an email from a company says about an application. Rules only, read a sentence at a time, built from families of
  // wording ("not" near "advance / move forward / proceed") rather than one phrase per sample, so new wordings still land.
  // Sentences that are store hours, footers or sales copy are set aside first; a form letter's "if you're selected" sentence
  // can only say "received". When it's unclear the job doesn't move: a wrong move is worse than none.
  // Tested against engine/test/reply-cases.js; add new wordings there before changing these.
  const DAY = "(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?";
  const TIME = "\\d{1,2}(?::\\d\\d)?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)|noon|\\d{1,2}:\\d\\d";
  const NO = new RegExp([
    // "not" near a moving-forward word: "will not be advancing your application", "decided not to proceed", "not moving your application forward"
    "\\b(not|won'?t|unable to|no longer|decided against)\\b[^.?!]{0,30}\\b(invit|advanc|mov(e|ing)\\b[^.?!]{0,30}\\b(ahead|forward)|forward with (you|your)|proceed|continu|select|consider|pursu|fill|available|offer you|extend)",
    "\\bnot (moving|move) your [^.?!]{0,30}forward",
    // someone else got it
    "\\b(went|going|gone|go|move|moving|proceed|proceeding|decided to go|ended up going|pursue|pursuing|interview|interviewing) (ahead |forward )?(with )?(someone|another|other|a different|an internal|candidates|applicants|a candidate whose)",
    "\\b(another|a different) direction|offer(ed)? the (role|position|job|spot) to (another|someone|a different|an internal)",
    "\\b(offered|given|filled) (the (role|position|job|spot) )?(to )?(another|someone|internally|from within)|\\b(hire|hired|hiring|selected|chose|chosen|picked|extend|extended|offer|offered|give|gave|given)( the (role|position|job|spot|offer))?( to)? (a |an )?(another|other|someone|somebody|guy|gal|person|internal|different|candidate whose|a candidate whose)\\b|promote from within|hire(d)? (someone|internally)|internal candidate|another (candidate|applicant) (who|whose|was|has)",
    "\\b(whose|with) (qualifications|experience|background|skills)[^.?!]{0,40}(more closely|better|closer)",
    // the job went away
    "\\b(position|role|job|opening|requisition|req|spot)[^.?!]{0,25}(has been|was|is|been) (now )?(filled|closed|cancell?ed|withdrawn|eliminated|no longer (available|open))",   // "on hold" may reopen, so it isn't a no
    "\\b(filled the (role|position|job|opening|spot)|we('ve| have)? filled (it|that one|this one)\\b|closing all applications|no longer hiring|decided not to fill)",
    "\\b(ended up|already|we'?ve|we have|we) (filling|filled|hiring|hired) (the|that|our|this) [^.?!]{0,20}(role|position|job|opening|spot|seat)",
    "\\b(won'?t|will not|don'?t|do not) (be )?(need|needing) (anyone|anybody|someone|another)|decided to keep (the|our) current|sorry it (didn'?t|did not) work out|accepted by (another|a different|someone|an internal)",
    "\\b(applicants|candidates|others|finalists) (who|that) (more closely|better|more) (match|fit|align)",
    "\\b(candidates|applicants|others|finalists) [^.?!]{0,20}(better|more closely) (meet|match|fit|align)|\\b(were|was|is|are) a (stronger|better|closer) (match|fit)|\\b(does|do|did)( not|n'?t) meet (the |our )?(minimum|basic|required|requirements|qualifications)|\\b(giving|gave|give|given) (the )?[^.?!]{0,20}(spot|job|position|role) to\\b|\\bgo with one of (them|those)|\\bkeep (the|this) (position|role|job|spot) in-?house|\\bseguir adelante con otr|\\botro candidato",
    // Spanish: "Lamentablemente…", "continuar con otros candidatos", "no fue seleccionado"
    "\\blamentablemente\\b|\\bcontinuar con otr[oa]s? (candidat|persona)|\\bno (ha sido|fue|has sido) seleccionad|\\bel puesto (ya )?(ha sido|fue) (cubierto|ocupado)|\\bdecidido no (continuar|seguir|avanzar)",
    // the plain no
    "\\b(not (been )?selected|not (quite )?(a|the right) (fit|match)|regret to inform|respectfully decline|decline your|not (been )?successful|(gonna|going to|will|we'?ll|have to) pass\\b|overqualified|status: (not selected|rejected|declined|closed)|unfortunately[^.?!]{0,40}\\b(not|won'?t|unable)\\b[^.?!]{0,30}\\b(you|your)\\b)",
  ].join("|"));
  const OFFER = new RegExp([
    // the day-one paperwork, a pay rate they're ready to pay, and Spanish offers
    "\\byour start date (is|will be)|\\bstart you at\\b|\\bstarting you at\\b|excited to have you (join|on)|\\bnew hire (packet|paperwork|orientation|forms)|\\b(your )?first day (is|will be|on|at|starts)\\b|\\b(we can do|we can pay|we'?ll pay|we will pay) \\$\\d|\\b(we'?d|we would) love to have you( on (board|the team)| join)?[.!,]|\\bofrecerle el puesto|\\bcarta de oferta|\\boferta de (empleo|trabajo)\\b",
    "\\boffer (letter|of employment|packet)|\\b(formal|conditional|contingent|verbal|written|job|employment) offer|your offer\\b|sign (your|the) offer|accept (the|our|this) offer",
    // "offer you the position", never "offer you an interview" or "offer you a lunch"
    "\\b(offer|offering|extend|extending)( to)? you (the |a |an |our )?([\\w$/,-]+ ){0,4}(position|role|job|spot|opportunity to join)|\\b(extend|extending|make|making) (you )?an offer|\\bmake you an offer",
    "\\b(like|want|love|going|ready|decided) to hire you|hire you (as|for|on)|\\bwe want you\\b|want you (on|as|for|to join)|offer in writing|terms of (this|the|your) offer|you'?re hired|you got the (job|position|spot)|(job|position|role|spot) is yours|want you (as|on|for) (our|the)|bring you on( board)?\\b|welcome (aboard|to the team)",
  ].join("|"));
  const FORM = /\b(if (you are|you're) (selected|chosen|not selected|a (good |strong )?(fit|match))|if your (qualifications|experience|background|skills|application)|if we (would|'d|decide|feel|determine|think|need|have|find|wish)|should (your|you|we|there)\b|(candidates|applicants|those) (selected|chosen|we select)|if (another|other) (candidate|applicant|position|opening|role)|(selected|qualified|top|shortlisted) (candidates|applicants)|if there (is|'s) a (fit|match)|only (candidates|applicants|those)|due to (the )?(high |large )?(volume|number)|unable to respond|can'?t respond to|reach out if|in touch with the candidates|will be in touch with|contact you if|keep your (resume|info|information) on file|kept on file)/;
  const ASK = new RegExp([
    "\\b(schedule|set up|arrange|book|pick|grab|select|choose)\\b[^.?!]{0,30}\\b(time|call|interview|phone screen|screen|video|chat|meeting|conversation|slot)",
    "\\binterview (stage|slot|you|with)|(phone|video|in-person|onsite|on-site|zoom|teams|second|final|on-demand) (round |video )?interview|come in for an interview|invited to (a|an)|invite you|offer you an interview",
    "\\b(can|could|would|will) (u|you) (talk|chat|meet|come)|(\\d+|few|couple) (min|mins|minutes)\\b[^.?!]{0,30}\\b(chat|talk|call|visit)|(intro|introductory|quick|brief|short) (call|chat|conversation)|(do you have|got|have you got) (\\d+|a few) (min|mins|minutes)|\\b(are|would) you (be )?(free|available)|your availability|availability for|when are you (free|available)|what does your schedule look like|what days work|times? that works?|calendly|would \\S+ work",
    "\\b(bring|have|get) you (in|back)|like you back|come in\\b|swing by|stop by|stop in\\b|come by|meet (with )?(you|me|us)\\b|meet (the|our) (team|manager|owner|hiring|branch|gm|crew)|(move|reschedule|push|switch) (your|the|our) (interview|call|meeting|phone screen)|talk to you about|chat (for|about|with)|talk (today|tomorrow|this week)|few minutes to talk|give me a call|call me (back )?(at|when|about|to discuss)|text or call|speak with you|talk with you|like to (meet|talk|chat|speak)|next (step|stage)[^.?!]{0,40}(call|interview|assessment|meet|talk|availability)|move you (forward|to the next)|online assessment|complete (the|your|an|a) ([\\w-]+ ){0,4}(assessment|test)\\b|aptitude test|skills (test|assessment)",
    "\\bopen to (a|an) [^.?!]{0,20}(call|chat|conversation|interview)|\\bentrevista\\b|\\binvitarle\\b|\\binvitarte\\b",
  ].join("|"));
  const WHEN = new RegExp(`\\b${DAY}\\b[^.?!]{0,40}?\\b(${TIME}|morning|afternoon|(at|around) \\d{1,2}\\b)|\\b(tomorrow|today|tonight)\\b[^.?!]{0,20}(${TIME}|around \\d|at \\d)|\\b\\d{1,2}/\\d{1,2}\\b[^.?!]{0,12}\\bat \\d`);
  const ACK = /\b((received|receipt of|got|have) your (application|resume|email and resume)|(acknowledges?|confirms?|confirming) (receipt|we)|(has|have) received your|we have your (application|resume)|thank(s| you) for (applying|your application|your interest|submitting)|application (for [^.]{0,40})?(has been |was )?(successfully )?(received|submitted)|confirms? we (got|received)|reviewing (it|your|applications)|got it, thanks|pass it along|hemos recibido|recibimos (tu|su)|gracias por (postularte|postularse|aplicar|su solicitud|tu solicitud))\b/;
  // Something about a job, so a "can you call me back" from a friend or a "come by Thursday" sale isn't read as an interview.
  const ABOUT_A_JOB = /\b(appl(y|ied|ying|ication|icant|ications)|app\b|resume|candida|interview|position|opening|role|job|hire|hiring|recruit|puesto|solicitud|entrevista|empleo|vacante)/;
  // Store hours, order notices, sales copy and footers mention days, times and "offers" too.
  const HOURS = new RegExp(`\\b(office \\d|\\d-\\d+ (m-f|mon)|hours|we'?re open|open ${DAY}|staffed|questions\\?|pickup available)|\\b${DAY}\\s*(-|–|to|through|thru)\\s*${DAY}\\b`);
  const NOISE = /\b(unsubscribe|% off|free (delivery|shipping)|special (offer|pricing)|exclusive offers|this weekend only|webinar|newsletter|order (#|w?\d)|is ready (for pickup|at)|has shipped|invoice|statement|balance due|payment is due|your quote|new (jobs|openings)|openings near|is hiring near|job alert|jobs (you may|for you|matching)|recommended jobs|talent community|survey|gift card|rewards|points|complete your profile|breakfast|vendor booths|join us|save big|sale\b|customer appreciation|grand opening|open house|trade days|hot dogs|free lunch|lunch is on us|doors open|enter to win|you are invited to the|coffee and donuts|attendance is required)\b/;
  // The words of a Gmail message (format=full): the plain-text part, else the HTML part without tags, minus the quoted
  // thread below "On Tue, … wrote:" so the person's own earlier email is never read as the company's answer.
  function mailText(payload) {
    const parts = [], walk = p => { if (!p) return; parts.push(p); (p.parts || []).forEach(walk); };
    walk(payload);
    const dec = d => { try { const b = atob(String(d).replace(/-/g, "+").replace(/_/g, "/")); return decodeURIComponent(escape(b)); } catch { try { return atob(String(d).replace(/-/g, "+").replace(/_/g, "/")); } catch { return ""; } } };
    const plain = parts.find(p => p.mimeType === "text/plain" && p.body?.data), html = parts.find(p => p.mimeType === "text/html" && p.body?.data);
    let text = plain ? dec(plain.body.data) : html ? dec(html.body.data).replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'") : "";
    text = text.split(/\n\s*(?:On .{5,120}wrote:|-{2,} ?Original Message ?-{2,}|From: .+\n\s*(?:Sent|Date): )/i)[0];
    return text.split("\n").filter(l => !/^\s*>/.test(l)).join("\n").replace(/[ \t]+/g, " ").trim().slice(0, 4000);
  }
  const ALERT = /\b(new (jobs|openings)|openings near|is hiring near|job alert|jobs (you may|for you|matching)|recommended jobs|apply today|newsletter|weekly|digest|this week:|hiring event|job fair|career fair|walk-ins welcome|meet the reps|pro days?|lunch provided)\b/;
  function readReply(subject, snippet) {
    // Lines stay apart (a signature's "Office 8-5 M-F, Sat 8-noon" isn't part of the sentence above it).
    const t = `${subject || ""}.\n${snippet || ""}`.toLowerCase().replace(/[’‘]/g, "'").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
    if (ALERT.test(t) && !/\byour (application|resume|candidacy|interview)/.test(t)) return null;   // a job alert or a "we're hiring" blast
    const sents = t.split(/(?<=[.!?])\s+|\n/).map(x => x.trim()).filter(x => x.trim() && (!HOURS.test(x) || /\b(interview|reschedul|move your)/.test(x)) && !NOISE.test(x));
    const firm = sents.filter(x => !FORM.test(x)).join(" "), said = sents.join(" ");
    const about = ABOUT_A_JOB.test(said);
    if (NO.test(firm) || sents.some(x => /^(no|not) (at this time|right now|for now)\b/.test(x))) return "closed";   // "Not at this time, but we'll keep your resume on file"   // first: "we won't be able to offer you the position" is a no
    if (/\b(on hold|hold off on)\b/.test(firm)) return null;   // paused, not closed: it may reopen
    if (OFFER.test(firm) && !/\boffer you (an? |the )?(interview|call|lunch|meal|time)/.test(firm)) return "offer";
    const when = WHEN.test(firm);
    const plainly = /\b(interview|phone screen|(schedule|set up|arrange|book) (a |an |some )?(time|call|meeting)|your availability|calendly)\b/.test(firm);
    if (ASK.test(firm) && (about || when || plainly)) return "interview";
    if (when && about) return "interview";
    if (FORM.test(said) || ACK.test(said)) return "applied";
    return null;
  }
  const ORDER = ["saved", "applied", "interview", "offer"];
  // Moves forward only, except a clear no, which closes it.
  const nextStatus = (now, kind) => !kind ? null : kind === "closed" ? (now === "closed" || now === "offer" ? null : "closed")
    : ORDER.indexOf(kind) > ORDER.indexOf(now) && now !== "closed" ? kind : null;
  const gmailQuery = (job, since) => `"${String(job.company).replace(/"/g, "")}" -from:me -in:chats${since ? " after:" + since.slice(0, 10).replace(/-/g, "/") : " newer_than:90d"}`;

  // A past title that carried a quota (the engine has the same list in match.js). Counter and inside sales usually didn't,
  // so they don't turn off No Commission Sales Jobs.
  const SOLD_BEFORE = /\b(outside sales|territory|account (manager|executive)|business development|sales (rep|representative|manager|executive|consultant))\b/i;
  const soldBefore = titles => (titles || []).some(t => SOLD_BEFORE.test(t) && !/\b(counter|inside)\b/i.test(t));
  const api = { prep, mailText, soldBefore, SOLD_BEFORE, readResume, postingWords, tailor, email, toPdf, fileName, mime, b64url, readReply, nextStatus, gmailQuery, WORDS, SECTIONS, TITLE_WORD, asRole };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.Tailor = api;
})();
