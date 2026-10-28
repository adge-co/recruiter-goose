// A resume made for one job, and the email that goes with it. Plain rules, no AI, run in the browser.
// It never adds anything the person hasn't written: it picks their most fitting lines, puts the posting's
// words they already have first, and lists the posting's words they don't have so they can decide.
// Loaded by the app as window.Tailor; the engine tests load it with require().
(function () {
  const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
  const RANGE = new RegExp(`(?:${MONTH}\\s+|\\d{1,2}/)?(?:19|20)\\d{2}\\s*(?:-|–|—|to)\\s*(?:present|current|now|today|(?:${MONTH}\\s+|\\d{1,2}/)?(?:19|20)\\d{2})`, "i");
  const HEADING = /^(profile|summary|professional summary|objective|experience|work experience|professional experience|employment|work history|education|skills|core skills|key skills|technical skills|skills and tools|certifications|licenses|certifications and licenses|references|projects|training|certs|skills & tools|skills and certifications|licenses and certifications)\s*:?$/i;
  // A heading with its list on the same line: "Skills & Tools: Procore; Excel".
  const HEAD_INLINE = /^(skills|core skills|key skills|technical skills|skills and tools|skills & tools|tools|certs|certifications|licenses)\s*:\s*(.+)$/i;
  const STATE_CODES = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
  const BULLET = /^\s*(?:[-•·*▪●◦‣–o]|\d+[.)])\s+/;   // "o" is what Word turns hollow bullets into when pasted
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
  ];
  const norm = s => " " + String(s || "").toLowerCase().replace(/[^a-z0-9&+ ]+/g, " ").replace(/\s+/g, " ") + " ";
  const esc = w => w.toLowerCase().replace(/[^a-z0-9&+ ]+/g, " ").trim().replace(/\s+/g, " ");
  const has = (text, w) => text.includes(" " + esc(w) + " ") || (!/s$/.test(w) && text.includes(" " + esc(w) + "s "));
  const CONTEXT = new Set(["contractors", "general contractors", "subcontractors", "builders", "distributors", "dealers", "supply houses", "lumber", "building materials",
    "doors", "windows", "millwork", "hvac", "electrical", "roofing", "framing", "software", "saas", "jobsite", "accounts", "relationships", "communication",
    "stakeholders", "cross-functional", "plans", "specs", "quotes", "estimates", "support", "operations", "field operations", "site visits", "warehouse"]);
  // Words a recruiter reads as the same thing.
  const SAME = [["purchasing", "procurement", "sourcing"], ["vendor management", "supplier management"], ["estimating", "estimates"], ["quoting", "quotes"], ["negotiation", "negotiating"], ["bids", "bidding"], ["takeoffs", "takeoff"]];
  const hasAny = (text, w) => has(text, w) || (SAME.find(g => g.includes(w.toLowerCase())) || []).some(x => has(text, x));
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const tc = s => String(s).replace(/\b([a-z])/g, c => c.toUpperCase());

  // ---------- Read a pasted or uploaded resume into parts the person can edit ----------
  function readResume(text) {
    // Tab columns ("06/2018 - Current<tab>PURCHASING AGENT<tab>ABC Mechanical") become " | " so each column stays its own part.
    const lines = String(text || "").split(/\r?\n/).map(l => l.replace(/^\t+/, "").replace(/\t+/g, " | ").replace(/^o \| /, "o ").replace(/ {2,}/g, " ").trimEnd()).filter(l => l.trim());
    const all = lines.join("\n");
    const out = { name: "", email: "", phone: "", city: "", jobs: [], skills: [], education: [] };
    out.email = (all.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [""])[0];
    out.phone = clean((all.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/) || [""])[0]);
    // The top lines, split where people put separators: "jose ramirez ~ jramirez77@yahoo.com ~ 817.555.0123".
    const top = lines.slice(0, 6).flatMap(l => l.split(/\s+[~|•·]\s+/)).map(clean);
    const name = top.find(l => /^[A-Za-z][A-Za-z.'-]+(?: [A-Za-z][A-Za-z.'-]+){1,3}$/.test(l) && !HEADING.test(l) && !TITLE_WORD.test(l)) || "";
    out.name = name === name.toUpperCase() || name === name.toLowerCase() ? tc(name.toLowerCase()) : name;   // "MARCUS DELGADO" -> "Marcus Delgado"
    const place = top.join(" | ").match(new RegExp(`\\b([A-Z][a-zA-Z.]+(?: [A-Z][a-zA-Z.]+){0,2}),? (${STATE_CODES})\\b(?! ?\\d{3}[\\s.-]\\d)`));
    out.city = place ? `${place[1]}, ${place[2]}` : "";
    const moving = top.join(" ").match(/\((?:relocating|moving|relocation) to [^)]{2,40}\)/i);   // "Shreveport, LA (relocating to Dallas-Fort Worth)"
    if (out.city && moving) out.city += " " + moving[0];

    let section = "", job = null;
    const startJob = (head, next) => {
      const dates = (head.match(RANGE) || (next || "").match(RANGE) || [""])[0];
      let rest = clean(head.replace(RANGE, "").replace(/^[\s,|·•–—-]+|[,|·•–—-]+\s*$/g, ""));
      let [title, company] = rest.split(/\s+[|•·]\s+|\s+[–—-]\s+|,\s+(?=[A-Z])|\s+at\s+(?=[A-Z])/);
      if (company && !TITLE_WORD.test(title) && TITLE_WORD.test(company)) [title, company] = [company, title];
      title = clean(title);
      if (title === title.toUpperCase() && /[A-Z]{3}/.test(title)) title = tc(title.toLowerCase());   // "PURCHASING AGENT" -> "Purchasing Agent"
      job = { title, company: clean(company || ""), dates: clean(dates), bullets: [] };
      out.jobs.push(job);
    };
    lines.forEach((raw, i) => {
      const line = clean(raw);
      if (HEADING.test(line)) { section = line.toLowerCase(); job = null; return; }
      const inline = line.match(HEAD_INLINE);
      if (inline) { section = inline[1].toLowerCase(); job = null; if (/cert|licens/.test(section)) out.education.push(inline[2]); else inline[2].split(/\s*[,;|•·]\s*/).map(clean).filter(s => s && s.length < 40).forEach(s => out.skills.includes(s) || out.skills.push(s)); return; }
      if (/skill|tool/.test(section) && !/cert|licens/.test(section)) { line.replace(BULLET, "").split(/\s*[,;|•·]\s*/).map(clean).filter(s => s && s.length < 40).forEach(s => out.skills.includes(s) || out.skills.push(s)); return; }
      if (/education|cert|licens|training/.test(section)) { out.education.push(line.replace(BULLET, "")); return; }
      if (/summary|profile|objective|references/.test(section)) return;
      const bullet = BULLET.test(raw), text = line.replace(BULLET, "");
      const last = job?.bullets[job.bullets.length - 1];
      if (!bullet && last && !/[.!]$/.test(last) && /^[a-z]/.test(text)) { job.bullets[job.bullets.length - 1] += " " + text; return; }   // a wrapped line
      // A title line: short, or any length when it carries the dates ("Counter Sales / Inside Sales — Red River…, Shreveport, LA  Mar 2019 – Present").
      const short = !bullet && (line.length < 90 || (RANGE.test(line) && line.length < 180)) && !/[.;!]$/.test(line);
      if (short) {
        const bare = clean(line.replace(RANGE, "").replace(/^[,|·•–—-]+\s*|[,|·•–—-]+\s*$/g, ""));
        const dates = clean((line.match(RANGE) || [""])[0]);
        if (job && !job.bullets.length) {   // the lines under a title: its company, its dates
          if (!bare) { job.dates ||= dates; return; }
          if (!job.company && !TITLE_WORD.test(bare)) { job.company = bare; job.dates ||= dates; return; }
        }
        if (/experience|employment|history/.test(section) || TITLE_WORD.test(line) || dates) {
          if (bare) return startJob(line, lines[i + 1]);
          return;
        }
      }
      if (job && (bullet || line.length > 30)) job.bullets.push(text);
    });
    out.jobs = out.jobs.filter(j => j.title || j.bullets.length).slice(0, 8);
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
    const mine = norm([...jobs.flatMap(j => [j.title, j.company, ...(j.bullets || [])]), ...(r.skills || []), ...(r.education || []), ...(profile.skills || [])].join(" \n "));
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
      const pick = ranked.slice(0, Math.max(fits, Math.min(3, ranked.length)));
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
    const titles = [...new Set(jobs.map(j => clean(j.title)).filter(Boolean))].slice(0, 2);
    const strong = said.filter(w => !/^(contractors|accounts|software|support|plans|quotes|estimates|relationships|communication)$/.test(w)).slice(0, 3);
    const headline = [titles.join(" · "), years ? `${years} Years` : ""].filter(Boolean).join(" · ");
    const recent = jobs[0]?.title ? `most recently ${asRole(jobs[0].title)}${jobs[0].company ? " at " + jobs[0].company : ""}` : "";
    const summary = [
      years || recent ? `${years ? years + " years of experience" : "Experience"}${recent ? ", " + recent : ""}.` : "",
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
  const asRole = title => /\b(sales|counter|desk|yard|warehouse|purchasing|estimating|operations|inventory|procurement|dispatch|receiving|shipping)$/i.test(String(title).trim())
    ? `in ${title}` : `as ${/^[aeiou]/i.test(title) ? "an" : "a"} ${title}`;
  const list = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

  // ---------- The email ----------
  function email(t, job) {
    const to = ((job.description || "").match(/[\w.+-]+@(?!example\.)[\w-]+(?:\.[a-z]{2,})+/i) || [""])[0];
    const first = (t.name || "").split(" ")[0];
    const subject = `Application: ${job.title}${t.name ? " - " + t.name : ""}`;
    const why = (t.said || t.matched).slice(0, 3).map(w => /^[A-Z]/.test(w) ? w : w.toLowerCase());
    // Name the job where those words actually show up, and take the example from that same job.
    const used = j => why.filter(w => norm(j.bullets.join(" ")).includes(norm(w).trim())).length;
    const at = [...(t.jobs || [])].sort((a, b) => used(b) - used(a))[0];
    const covered = at ? why.filter(w => norm(at.bullets.join(" ")).includes(norm(w).trim())) : [];
    const body = [
      `Hello ${job.company} hiring team,`,
      "",
      `I'm applying for the ${job.title} role. ${at?.title ? `I've worked ${asRole(at.title)}${at.company ? " at " + at.company : ""}` : "My background is hands-on"}${covered.length ? `, where my work covered ${list(covered)}` : ""}.`,
      "",
      at?.bullets?.[0] ? `One example: ${at.bullets[0].replace(/\.?$/, ".")}` : "",
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
  const fileName = (t, job) => `${(t.name || "Resume").replace(/[^\w ]+/g, "").trim()} - ${String(job.company).replace(/[^\w ]+/g, "").trim()} ${String(job.title).replace(/[^\w ]+/g, "").trim()}.pdf`.replace(/\s+/g, " ");

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
  // What an email from a company says about an application. Only plain, common phrasing counts.
  // A form letter ("we'll contact you to schedule an interview if you're selected") is an acknowledgement, not an interview,
  // and "unfortunately" alone isn't a no ("unfortunately Friday won't work, could we do Monday?").
  const NO = /\b(not (to )?(move|moving) forward with your|decided (to )?(pursue|proceed|move forward|go) (with other|in a different direction)|different direction|other (candidates|applicants) (whose|who)|position has been filled|no longer (being )?consider|not (been )?selected|will not be moving forward|regret to inform|won'?t be moving forward|not (a|the right) (fit|match) for this)\b/;
  const OFFER = /\b(offer letter|pleased to offer|extend (you )?an offer|(attached|here) is your offer|verbal offer)\b/;
  const FORM = /\b(if (your|you are|you're|we)[^.]{0,60}(selected|qualifications|experience|background|match)|will (contact|reach out to|be in touch with) (you|candidates|applicants)[^.]{0,40}(if|should|whose)|unable to respond|can'?t respond to (every|each|all)|high volume of (applications|applicants)|only (candidates|applicants) (selected|who))/;
  const ASK = /\b((schedule|set up|arrange|book) (a |an |some |your |a quick )?(time|call|interview|phone screen|phone interview|video interview|chat|meeting)|(phone|video|in-person|onsite|on-site|zoom|teams) interview|come in for an interview|invite you (to|for)|are you (free|available)|your availability|times that work|calendly|(bring|have) you in|come in (to|for)|meet (with )?(you|our|the|me)\b|phone screen with)\b/;
  const WHEN = /\b(mon|tues|wednes|thurs|fri|satur|sun)day\b[\s\S]{0,40}?\b\d{1,2}(:\d\d)?\s*(am|pm|a\.m\.|p\.m\.)/;
  const ACK = /\b((received|receipt of) your application|thank(s| you) for (applying|your application|your interest)|application (has been )?(received|submitted))\b/;
  // A reply is read in this order: an offer, a clear no, a day and time, a form letter, a real ask, then a plain thank-you.
  function readReply(subject, snippet) {
    const t = `${subject || ""} ${snippet || ""}`.toLowerCase();
    if (OFFER.test(t)) return "offer";
    if (NO.test(t)) return "closed";
    if (WHEN.test(t)) return "interview";   // a day and a time is an invite, whatever else it says
    if (FORM.test(t)) return "applied";      // "we'll contact you to schedule an interview if..." is a form letter
    if (ASK.test(t)) return "interview";
    if (/\bunfortunately\b/.test(t)) return null;   // something went wrong, but not clearly a no: let them read it
    if (ACK.test(t)) return "applied";
    return null;
  }
  const ORDER = ["saved", "applied", "interview", "offer"];
  // Moves forward only, except a clear no, which closes it.
  const nextStatus = (now, kind) => !kind ? null : kind === "closed" ? (now === "closed" || now === "offer" ? null : "closed")
    : ORDER.indexOf(kind) > ORDER.indexOf(now) && now !== "closed" ? kind : null;
  const gmailQuery = (job, since) => `"${String(job.company).replace(/"/g, "")}" -from:me -in:chats${since ? " after:" + since.slice(0, 10).replace(/-/g, "/") : " newer_than:90d"}`;

  const api = { readResume, postingWords, tailor, email, toPdf, fileName, mime, b64url, readReply, nextStatus, gmailQuery, WORDS, SECTIONS, TITLE_WORD, asRole };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.Tailor = api;
})();
