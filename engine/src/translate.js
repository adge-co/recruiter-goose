// How a recruiter reads a background from the trades, the counter, purchasing and the field.
// Each entry: the titles it covers, the office roles it points to (keys in ROLE_WORDS), why a recruiter
// buys it, honest wording swaps (same facts, recruiter words) and the numbers worth putting on a resume.
// Built from how recruiters search titles and skim resumes (research 01). Not yet checked with recruiters.

export const BACKGROUNDS = [
  {
    key: "counter", label: "Counter Sales",
    match: /\b(counter|inside sales|showroom|parts (sales|specialist|associate)|sales associate|yard sales)\b/i,
    roles: ["quoting", "purchasing", "estimating", "customer success"],
    why: "You quoted, priced and fixed order problems for contractors all day. Supplier-side and construction software teams want people who already speak contractor.",
    say: [["Helped customers at the counter", "Quoted and processed orders for contractor accounts"], ["Looked up parts", "Matched specs and found substitutes from supplier catalogs"]],
    numbers: ["Orders or quotes per day", "Dollars sold per month", "Number of contractor accounts"],
  },
  {
    key: "purchasing", label: "Purchasing and Buying",
    match: /\b(purchas\w*|buyer|procure\w*|sourcing|materials manager)\b/i,
    roles: ["purchasing", "operations", "implementation", "pricing"],
    why: "Buying is the same job in every industry: vendors, lead times, price and paper. Recruiters search for it by title, so use the words they type.",
    say: [["Ordered materials", "Managed purchase orders and vendor lead times"], ["Called vendors", "Negotiated pricing and terms with suppliers"]],
    numbers: ["Dollars bought per year", "Number of vendors", "Savings you found"],
  },
  {
    key: "estimator", label: "Estimating",
    match: /\b(estimat\w*|takeoff|preconstruction|bid coordinator)\b/i,
    roles: ["estimating", "project manager", "pricing", "implementation"],
    why: "Takeoffs and bids are what construction software sells. Estimating, preconstruction and software onboarding teams all hire estimators.",
    say: [["Did takeoffs", "Built quantity takeoffs and bids from plans"], ["Priced jobs", "Priced jobs and tracked win rate"]],
    numbers: ["Bids per month", "Dollar size of jobs you bid", "Win rate"],
  },
  {
    key: "coordinator", label: "Project Coordinator",
    match: /\b(project coordinator|assistant project manager|apm|project administrator|project assistant)\b/i,
    roles: ["project manager", "coordinator", "implementation", "operations"],
    why: "Submittals, RFIs, schedules and change orders map straight to project and implementation work.",
    say: [["Kept the job organized", "Managed submittals, RFIs and change orders"], ["Helped the PM", "Ran schedules and owner updates for the project team"]],
    numbers: ["Project size in dollars", "Jobs at once", "Subs or vendors you tracked"],
  },
  {
    key: "superintendent", label: "Superintendent",
    match: /\b(superintendent|site manager|construction manager|field manager)\b/i,
    roles: ["project manager", "operations", "safety", "implementation"],
    why: "Running a jobsite is running a project. Office roles call it project manager or field operations; construction software calls it implementation.",
    say: [["Ran the jobsite", "Managed schedule, subs and safety on a jobsite"], ["Kept guys working", "Coordinated trades to hit the schedule"]],
    numbers: ["Job size in dollars", "Crew and subs on site", "Days ahead or behind schedule"],
  },
  {
    key: "foreman", label: "Foreman or Crew Lead",
    match: /\b(foreman|forewoman|crew lead|crew leader|lead hand|lead installer|working supervisor)\b/i,
    roles: ["operations", "safety", "training", "quality"],
    why: "Leading a crew is supervising people. Recruiters read it as operations and training, and safety teams want people who've worked the field.",
    say: [["Ran a crew", "Supervised and trained a crew of field installers"], ["Made sure it was done right", "Owned quality checks before sign-off"]],
    numbers: ["Crew size", "Jobs per week", "Safety record (days without an incident)"],
  },
  {
    key: "tech", label: "Field Tech or Tradesman",
    match: /\b(technician|tech|installer|service tech|apprentice|journeyman|plumber|electrician|hvac|carpenter|pipefitter|welder|mechanic)\b/i,
    roles: ["support", "training", "implementation", "quality"],
    why: "Software for the trades hires people who've done the work, for support, training and onboarding. You know what breaks in the field.",
    say: [["Fixed equipment", "Diagnosed and fixed systems on customer sites"], ["Showed the homeowner", "Trained customers on how to use and care for systems"]],
    numbers: ["Calls per week", "Customer rating", "Years licensed"],
  },
  {
    key: "dispatch", label: "Dispatch and Scheduling",
    match: /\b(dispatch\w*|scheduler|service coordinator|service manager|call center)\b/i,
    roles: ["scheduling", "coordinator", "operations", "customer success"],
    why: "Dispatch is live operations work. Logistics, field service and software companies all hire for it.",
    say: [["Sent techs out", "Scheduled and routed field techs"], ["Answered the phones", "Handled service requests from first call to close"]],
    numbers: ["Techs or trucks you scheduled", "Calls or jobs per day", "On-time rate"],
  },
  {
    key: "warehouse", label: "Warehouse, Yard and Inventory",
    match: /\b(warehouse|yard (lead|manager|supervisor|associate)|inventory|receiving|shipping|stock|materials handler|forklift)\b/i,
    roles: ["warehouse", "inventory", "purchasing", "operations", "coordinator"],
    why: "Inventory and receiving are supply chain jobs. Recruiters search for inventory, materials and logistics coordinators.",
    say: [["Ran the yard", "Managed inventory, receiving and outbound orders"], ["Counted stock", "Ran cycle counts and kept inventory accurate"]],
    numbers: ["Inventory value", "Orders shipped per day", "Count accuracy"],
  },
  {
    key: "branch", label: "Branch or Store Manager",
    match: /\b(branch manager|store manager|general manager|assistant manager|location manager|operations manager)\b/i,
    roles: ["operations", "warehouse", "purchasing", "sales", "training"],
    why: "You ran a small business inside a bigger one: people, stock, money and customers. That reads as operations.",
    say: [["Ran the store", "Managed a branch's sales, staff and inventory"], ["Hired and trained", "Hired, trained and scheduled a team"]],
    numbers: ["Yearly sales", "Team size", "Margin or growth"],
  },
  {
    key: "outside", label: "Outside Sales or Rep",
    match: /\b(outside sales|territory (manager|rep)|sales rep\w*|account rep\w*|manufacturer'?s rep|rep agency|sales engineer)\b/i,
    roles: ["sales", "quoting", "customer success", "estimating", "implementation"],
    why: "Supply houses, manufacturers and contractors hire reps who already know the contractors. If you want out of quota, the same relationships carry over to customer success and onboarding.",
    say: [["Sold to contractors", "Managed contractor and dealer accounts in a territory"], ["Did lunch-and-learns", "Trained dealers and contractors on product lines"]],
    numbers: ["Accounts", "Territory sales per year", "Retention or repeat rate"],
  },
  {
    key: "expeditor", label: "Expediting",
    match: /\b(expedit\w*)\b/i,
    roles: ["purchasing", "scheduling", "coordinator"],
    why: "Expediting is chasing lead times and fixing late orders, which is core purchasing and supply chain work.",
    say: [["Chased orders", "Tracked open orders and recovered late deliveries"]],
    numbers: ["Open orders tracked", "Late orders recovered", "Days saved"],
  },
  {
    key: "pe", label: "Project Engineer",
    match: /\b(project engineer|field engineer|assistant engineer)\b/i,
    roles: ["project manager", "estimating", "implementation"],
    why: "Project engineers already do the paperwork side of construction: submittals, RFIs and cost tracking.",
    say: [["Handled paperwork", "Managed RFIs, submittals and cost tracking"]],
    numbers: ["Project size", "RFIs or submittals handled", "Change orders priced"],
  },
  {
    key: "safety", label: "Safety",
    match: /\b(safety|ehs|hse|osha)\b/i,
    roles: ["safety", "training", "operations"],
    why: "Safety people are hired across construction, logistics and energy. Field time makes you more believable, not less.",
    say: [["Ran toolbox talks", "Ran safety training and jobsite audits"]],
    numbers: ["People trained", "Audits per month", "Incident rate change"],
  },
  {
    key: "driver", label: "Driver or Delivery",
    match: /\b(driver|cdl|delivery|truck|courier)\b/i,
    roles: ["scheduling", "coordinator", "safety"],
    why: "You know routes, customers and how deliveries go wrong. Dispatch and logistics coordinator roles hire for that.",
    say: [["Drove deliveries", "Ran daily delivery routes to jobsites and customers"]],
    numbers: ["Stops per day", "Years without an accident", "On-time rate"],
  },
  {
    key: "cs", label: "Customer Service",
    match: /\b(customer service|customer support|client service|order desk|inside order)\b/i,
    roles: ["customer success", "support", "coordinator"],
    why: "Handling orders and problems for customers is the base of customer success and support work.",
    say: [["Answered customers", "Resolved order and account issues for customers"]],
    numbers: ["Calls or tickets per day", "Customer rating", "Accounts handled"],
  },
  {
    key: "office", label: "Office and Admin",
    match: /\b(office manager|administrative|admin\w*|receptionist|accounts payable|ap clerk|billing)\b/i,
    roles: ["coordinator", "operations"],
    why: "Running an office's paperwork is coordination work. Project and operations coordinator roles fit.",
    say: [["Did the paperwork", "Managed billing, records and vendor paperwork"]],
    numbers: ["Invoices or records per week", "Vendors handled", "Time saved"],
  },
  {
    key: "quality", label: "Inspection and Quality",
    match: /\b(inspector|qa|qc|quality)\b/i,
    roles: ["quality", "safety", "coordinator"],
    why: "Inspection is quality control. Manufacturers and builders both hire QA and QC coordinators.",
    say: [["Checked the work", "Ran inspections and tracked defects to closeout"]],
    numbers: ["Inspections per week", "Defects caught", "Pass rate"],
  },
  {
    key: "hospitality", label: "Hospitality",
    match: /\b(hotel|front desk|restaurant|server|bartender|hospitality|banquet|catering|guest services|concierge|kitchen manager)\b/i,
    roles: ["customer success", "operations", "training", "implementation"],
    why: "Hotel and restaurant software companies hire people who've run a shift. Guest service carries over to customer success.",
    say: [["Served guests", "Handled guest issues and kept service running on busy shifts"], ["Trained new staff", "Trained and scheduled front-of-house staff"]],
    numbers: ["Covers or rooms per shift", "Staff you trained", "Guest rating"],
  },
];

// Every background a person's past titles point to, with the roles to search and why.
export function readBackground(pastTitles = []) {
  const out = [];
  for (const title of pastTitles) {
    for (const b of BACKGROUNDS) {
      if (!b.match.test(String(title))) continue;
      const seen = out.find(x => x.key === b.key);
      if (seen) { if (!seen.titles.includes(title)) seen.titles.push(title); continue; }
      out.push({ key: b.key, label: b.label, titles: [title], roles: b.roles, why: b.why,
        say: b.say.map(([was, now]) => ({ was, now })), numbers: b.numbers });
      break;   // the first (most specific) entry that fits a title wins
    }
  }
  return out;
}

// Roles worth searching, most-pointed-to first.
export function suggestedRoles(pastTitles = []) {
  const n = new Map();
  for (const b of readBackground(pastTitles)) b.roles.forEach((r, i) => n.set(r, (n.get(r) || 0) + (4 - Math.min(i, 3))));
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
}
