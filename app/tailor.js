// A resume made for one job, and the email that goes with it. Plain rules, no AI, run in the browser.
// It never adds anything the person hasn't written: it picks their most fitting lines, puts the posting's
// words they already have first, and lists the posting's words they don't have so they can decide.
// Loaded by the app as window.Tailor; the engine tests load it with require().
(function () {
  const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
  const RANGE = new RegExp(`(?:${MONTH}\\s+|\\d{1,2}/)?(?:19|20)\\d{2}\\s*(?:-|–|—|to)\\s*(?:present|current|now|today|(?:${MONTH}\\s+|\\d{1,2}/)?(?:19|20)\\d{2})`, "i");
  const HEADING = /^(profile|summary|professional summary|objective|experience|work experience|professional experience|employment|work history|education|skills|core skills|key skills|technical skills|skills and tools|certifications|licenses|certifications and licenses|references|projects|training)\s*:?$/i;
  const BULLET = /^\s*(?:[-•·*▪●◦‣–]|\d+[.)])\s+/;
  const TITLE_WORD = /\b(manager|agent|specialist|coordinator|buyer|estimator|analyst|consultant|supervisor|lead|director|representative|rep|associate|engineer|technician|foreman|superintendent|administrator|assistant|owner|planner|purchaser|salesperson|clerk|dispatcher|scheduler|trainer|advisor|officer|president|founder|operator|installer|designer|developer|accountant|controller|expeditor|merchandiser|driver|server|bartender|carpenter|electrician|plumber|apprentice|journeyman|laborer|warehouse)\b/i;

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
    const lines = String(text || "").split(/\r?\n/).map(l => l.replace(/\t/g, " ").replace(/ {2,}/g, " ").trimEnd()).filter(l => l.trim());
    const all = lines.join("\n");
    const out = { name: "", email: "", phone: "", city: "", jobs: [], skills: [], education: [] };
    out.email = (all.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [""])[0];
    out.phone = clean((all.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/) || [""])[0]);
    const top = lines.slice(0, 6).map(clean);
    out.name = top.find(l => /^[A-Za-z][A-Za-z.'-]+(?: [A-Za-z][A-Za-z.'-]+){1,3}$/.test(l) && !HEADING.test(l) && !TITLE_WORD.test(l)) || "";
    const place = top.join(" | ").match(/\b([A-Z][a-zA-Z.]+(?: [A-Z][a-zA-Z.]+){0,2}, ?[A-Z]{2})\b(?! ?\d{3})/);
    out.city = place ? place[1].replace(/, ?/, ", ") : "";

    let section = "", job = null;
    const startJob = (head, next) => {
      const dates = (head.match(RANGE) || (next || "").match(RANGE) || [""])[0];
      let rest = clean(head.replace(RANGE, "").replace(/[,|·•–—-]+\s*$/, ""));
      let [title, company] = rest.split(/\s+[|•·]\s+|\s+[–—-]\s+|,\s+(?=[A-Z])|\s+at\s+(?=[A-Z])/);
      if (company && !TITLE_WORD.test(title) && TITLE_WORD.test(company)) [title, company] = [company, title];
      job = { title: clean(title), company: clean(company || ""), dates: clean(dates), bullets: [] };
      out.jobs.push(job);
    };
    lines.forEach((raw, i) => {
      const line = clean(raw);
      if (HEADING.test(line)) { section = line.toLowerCase(); job = null; return; }
      if (/skill|tool/.test(section)) { line.replace(BULLET, "").split(/\s*[,;|•·]\s*/).map(clean).filter(s => s && s.length < 40).forEach(s => out.skills.includes(s) || out.skills.push(s)); return; }
      if (/education|certif|licens|training/.test(section)) { out.education.push(line.replace(BULLET, "")); return; }
      if (/summary|profile|objective|references/.test(section)) return;
      const bullet = BULLET.test(raw), text = line.replace(BULLET, "");
      const last = job?.bullets[job.bullets.length - 1];
      if (!bullet && last && !/[.!]$/.test(last) && /^[a-z]/.test(text)) { job.bullets[job.bullets.length - 1] += " " + text; return; }   // a wrapped line
      const short = !bullet && line.length < 90 && !/[.;!]$/.test(line);
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
      return { title: j.title, company: j.company, dates: j.dates, bullets: pick.slice(0, keep).map(x => x.b), dropped: ranked.length - Math.min(pick.length, keep) };
    });

    const skillPool = [...new Set([...(r.skills || []), ...(profile.skills || [])].map(clean).filter(Boolean))];
    const skills = [...skillPool.filter(s => want.some(w => hasAny(norm(s), w))), ...skillPool.filter(s => !want.some(w => hasAny(norm(s), w)))].slice(0, 14);
    // Posting words that appear in their own lines but not in their skills list go in the skills line too.
    for (const w of said) if (skills.length < 16 && !skills.some(s => norm(s).includes(norm(w).trim())) && /^[A-Z]|^(purchasing|procurement|estimating|takeoffs|scheduling|inventory|quoting|pricing|onboarding|implementation|training|vendor management|purchase orders)$/.test(w)) skills.push(/^[a-z]/.test(w) ? tc(w) : w);

    const years = Number(profile.years) || 0;
    const titles = [...new Set(jobs.map(j => clean(j.title)).filter(Boolean))].slice(0, 2);
    const strong = said.filter(w => !/^(contractors|accounts|software|support|plans|quotes|estimates|relationships|communication)$/.test(w)).slice(0, 3);
    const headline = [titles.join(" · "), years ? `${years} Years` : ""].filter(Boolean).join(" · ");
    const recent = jobs[0]?.title ? `most recently as ${/^[aeiou]/i.test(jobs[0].title) ? "an" : "a"} ${jobs[0].title}${jobs[0].company ? " at " + jobs[0].company : ""}` : "";
    const summary = [
      years || recent ? `${years ? years + " years of experience" : "Experience"}${recent ? ", " + recent : ""}.` : "",
      strong.length ? `Hands-on with ${list(strong.map(w => /^[A-Z]/.test(w) ? w : w.toLowerCase()))}.` : "",
      `Applying for the ${job.title} role at ${job.company}.`,
    ].filter(Boolean).join(" ");
    const fit = skillWant.length ? Math.round(100 * matched.length / skillWant.length) : 0;
    return { name: r.name || profile.name || "", email: r.email || "", phone: r.phone || "", city: r.city || "", headline, summary,
      jobs: outJobs, skills, education: r.education || [], matched, said, missing, fit, words: skillWant.length };
  }
  const list = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

  // ---------- The email ----------
  function email(t, job) {
    const to = ((job.description || "").match(/[\w.+-]+@(?!example\.)[\w-]+(?:\.[a-z]{2,})+/i) || [""])[0];
    const first = (t.name || "").split(" ")[0];
    const subject = `Application: ${job.title}${t.name ? " - " + t.name : ""}`;
    const why = (t.said || t.matched).slice(0, 3).map(w => /^[A-Z]/.test(w) ? w : w.toLowerCase());
    const body = [
      `Hello ${job.company} hiring team,`,
      "",
      `I'm applying for the ${job.title} role. ${t.jobs[0]?.title ? `I've worked as ${/^[aeiou]/i.test(t.jobs[0].title) ? "an" : "a"} ${t.jobs[0].title}${t.jobs[0].company ? " at " + t.jobs[0].company : ""}` : "My background is hands-on"}${why.length ? `, where my work covered ${list(why)}` : ""}.`,
      "",
      t.jobs[0]?.bullets?.[0] ? `One example: ${t.jobs[0].bullets[0].replace(/\.?$/, ".")}` : "",
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
    const text = (s, size, style = "normal", x = M, color = [33, 28, 24]) => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color); doc.text(String(s), x, y); };
    const wrap = (s, size, width) => { doc.setFontSize(size); return doc.splitTextToSize(String(s), width); };
    const head = s => { y += 10; room(30); text(s.toUpperCase(), 9.5, "bold", M, [63, 107, 82]); y += 5; doc.setDrawColor(201, 164, 106); doc.setLineWidth(0.8); doc.line(M, y, R, y); y += 15; };

    text(t.name || "Your Name", 22, "bold"); y += 18;
    const contact = [t.city, t.phone, t.email].filter(Boolean).join("  ·  ");
    if (contact) { text(contact, 10, "normal", M, [90, 80, 70]); y += 15; }
    if (t.headline) { text(t.headline, 11, "bold", M, [90, 70, 40]); y += 8; }
    if (t.summary) { head("Summary"); for (const l of wrap(t.summary, 10.5, R - M)) { room(14); text(l, 10.5); y += 14; } }
    if (t.skills.length) { head("Skills"); for (const l of wrap(t.skills.join("  ·  "), 10.5, R - M)) { room(14); text(l, 10.5); y += 14; } }
    if (t.jobs.length) {
      head("Experience");
      for (const j of t.jobs) {
        room(34);
        text(j.title || "", 11, "bold");
        if (j.dates) { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 80, 70); doc.text(j.dates, R, y, { align: "right" }); }
        y += 14;
        if (j.company) { text(j.company, 10.5, "normal", M, [90, 80, 70]); y += 14; }
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
    if (t.education.length) { head("Education And Certifications"); for (const e of t.education) for (const l of wrap(e, 10.5, R - M)) { room(14); text(l, 10.5); y += 14; } }
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
  function readReply(subject, snippet) {
    const t = `${subject || ""} ${snippet || ""}`.toLowerCase();
    if (/\b(unfortunately|not (to )?(move|moving) forward|other candidates|decided to (pursue|proceed|move forward) with|position has been filled|no longer (being )?consider|not selected|will not be moving)\b/.test(t)) return "closed";
    if (/\b(offer letter|pleased to offer|extend (you )?an offer|job offer)\b/.test(t)) return "offer";
    if (/\b(interview|phone screen|schedule (a |some )?(time|call)|your availability|times that work|calendly|meet with (our|the) team|next step)\b/.test(t)) return "interview";
    if (/\b((received|receipt of) your application|thank(s| you) for (applying|your application|your interest)|application (has been )?(received|submitted))\b/.test(t)) return "applied";
    return null;
  }
  const ORDER = ["saved", "applied", "interview", "offer"];
  // Moves forward only, except a clear no, which closes it.
  const nextStatus = (now, kind) => !kind ? null : kind === "closed" ? (now === "closed" || now === "offer" ? null : "closed")
    : ORDER.indexOf(kind) > ORDER.indexOf(now) && now !== "closed" ? kind : null;
  const gmailQuery = (job, since) => `"${String(job.company).replace(/"/g, "")}" -from:me -in:chats${since ? " after:" + since.slice(0, 10).replace(/-/g, "/") : " newer_than:90d"}`;

  const api = { readResume, postingWords, tailor, email, toPdf, fileName, mime, b64url, readReply, nextStatus, gmailQuery, WORDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.Tailor = api;
})();
