import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const T = createRequire(import.meta.url)("../../app/tailor.js");

const RESUME = `Jordan Avery
Fort Worth, TX | (817) 555-0142 | jordan.avery@email.com

SUMMARY
Purchasing and counter sales pro with seven years in building materials.

EXPERIENCE
Purchasing Agent | Lone Star Mechanical
Jan 2021 - Present
• Managed purchase orders and vendor lead times for 40+ active jobs
• Cut material costs 6% by negotiating pricing with three supply houses
• Trained two new coordinators on Epicor and our receiving process
• Kept the shop clean and organized

Inside Sales / Counter Sales
Builders Supply Co, 2017 - 2020
- Quoted doors, windows and millwork for contractor accounts from plans
- Built takeoffs from blueprints for builders, about 80 quotes a week
- Handled will-call and phone orders

SKILLS
Purchasing, Epicor, Excel, Takeoffs, Vendor management, Bluebeam

EDUCATION
OSHA 10
Tarrant County College, coursework in construction management`;

const JOB = { title: "Procurement Specialist", company: "BuildCo",
  description: "Own purchase orders and vendor management for our contractor customers. Track lead times, negotiate pricing, and keep NetSuite and Excel up to date. Procurement experience required. OSHA 10 a plus. Send questions to talent@buildco.com." };

test("reads a resume into contact, jobs with their lines, skills and education", () => {
  const r = T.readResume(RESUME);
  assert.equal(r.name, "Jordan Avery");
  assert.equal(r.email, "jordan.avery@email.com");
  assert.equal(r.phone, "(817) 555-0142");
  assert.equal(r.city, "Fort Worth, TX");
  assert.equal(r.jobs.length, 2);
  assert.deepEqual([r.jobs[0].title, r.jobs[0].company, r.jobs[0].dates], ["Purchasing Agent", "Lone Star Mechanical", "Jan 2021 - Present"]);
  assert.equal(r.jobs[0].bullets.length, 4);
  assert.equal(r.jobs[1].company, "Builders Supply Co");
  assert.equal(r.jobs[1].dates, "2017 - 2020");
  assert.equal(r.jobs[1].bullets.length, 3);
  assert.ok(r.skills.includes("Epicor") && r.skills.includes("Bluebeam"));
  assert.equal(r.education.length, 2);
});

test("the made-for-this-job resume puts fitting lines first and never adds what they don't have", () => {
  const r = T.readResume(RESUME);
  const t = T.tailor(r, JOB, { years: 7 });
  assert.match(t.jobs[0].bullets[0], /purchase orders/i);
  assert.ok(!t.jobs[0].bullets.slice(0, 3).some(b => /shop clean/.test(b)), "the off-topic line drops down");
  assert.ok(t.matched.includes("purchase orders") && t.matched.includes("vendor management") && t.matched.includes("OSHA"));
  assert.ok(t.missing.includes("NetSuite"), "NetSuite is in the posting, not the resume");
  assert.ok(!t.skills.includes("NetSuite"), "a missing word is never put on the resume");
  assert.equal(t.skills[0], "Purchasing");
  assert.equal(t.jobs[0].bullets.length, 3);
  assert.match(t.summary, /^7 years of experience, most recently as a Purchasing Agent at Lone Star Mechanical\. Hands-on with purchasing, purchase orders and vendor management\./);
  assert.ok(!t.skills.includes("Procurement"), "their own word, not the posting's");
  assert.doesNotMatch(t.summary, /Applying for/, "the email says which job; the resume doesn't");
  assert.ok(t.fit > 0 && t.fit <= 100);
});

test("the email names the role, uses their own line, and finds a posted address", () => {
  const r = T.readResume(RESUME), t = T.tailor(r, JOB, { years: 7 }), e = T.email(t, JOB);
  assert.equal(e.to, "talent@buildco.com");
  assert.equal(e.subject, "Application: Procurement Specialist - Jordan Avery");
  assert.match(e.body, /^Hello BuildCo hiring team,/);
  assert.match(e.body, /Purchasing Agent at Lone Star Mechanical/);
  assert.match(e.body, /My resume is attached/);
  assert.ok(!/\n\n\n/.test(e.body));
  assert.equal(T.fileName(t, JOB), "Jordan Avery - BuildCo Procurement Specialist.pdf");
});

test("a reply moves a job forward, a clear no closes it, and nothing moves backward", () => {
  assert.equal(T.readReply("Next steps", "We'd like to schedule a phone screen. What is your availability?"), "interview");
  assert.equal(T.readReply("Your application", "Unfortunately we have decided to move forward with other candidates."), "closed");
  assert.equal(T.readReply("Thanks for applying to BuildCo", "We received your application"), "applied");
  // The ones that are easy to get backwards.
  assert.equal(T.readReply("Thank you for applying", "If your qualifications match our needs, we will contact you to schedule an interview."), "applied");
  assert.equal(T.readReply("Application received", "Thank you for applying. We'll reach out if you are selected for an interview. Next steps will follow."), "applied");
  assert.equal(T.readReply("Purchasing Agent", "I'd like to set up a phone interview this week. Are you free Tuesday at 10am?"), "interview");
  assert.equal(T.readReply("Re: Buyer", "Unfortunately Friday won't work, could we schedule a call Monday?"), "interview");
  assert.equal(T.readReply("Re: Estimator", "We'd love to bring you in to meet the purchasing manager. Does Thursday at 9 am work?"), "interview");
  assert.equal(T.readReply("Thanks", "Unfortunately we can't respond to every applicant, but we received your application."), "applied");
  assert.equal(T.readReply("Your application", "We regret to inform you the position has been filled."), "closed");
  assert.equal(T.readReply("Next steps", "If you're still interested, we'd like you to come in for an interview on Tuesday, November 4 at 10:00 AM."), "interview");
  assert.equal(T.readReply("Buyer role", "We'd like to meet you Wednesday Nov. 5 at 9 am."), "interview");
  assert.equal(T.readReply("Thanks for applying", "Unfortunately, we have decided to go in a different direction."), "closed");
  assert.equal(T.readReply("Thank you", "Thanks for applying. We'll keep your resume on file in case a job offer opens up."), "applied");
  assert.equal(T.readReply("Buyer", "We've decided to move ahead with another candidate for this role."), "closed");
  assert.equal(T.readReply("Update", "After careful review we went with an internal candidate."), "closed");
  assert.equal(T.readReply("Update", "We filled the position last week. Thanks again for your time."), "closed");
  assert.equal(T.readReply("Update", "Sadly we won't be able to offer you a position at this time."), "closed");
  assert.equal(T.readReply("Good news", "We're excited to offer you the Buyer position at BuildCo!"), "offer");
  assert.equal(T.readReply("Buyer", "We'd like to make you an offer. Can you talk tonight?"), "offer");
  assert.equal(T.readReply("Hey", "Can you swing by the yard tomorrow at 2?"), "interview");
  assert.equal(T.readReply("Estimator", "Got time for a quick call tomorrow afternoon?"), "interview");
  assert.equal(T.readReply("Application received", "Thanks for applying. Our office is open Monday through Friday, 8 a.m. to 5 p.m."), "applied");
  assert.equal(T.readReply("Lunch", "Team lunch on Friday"), null);
  assert.equal(T.nextStatus("applied", "interview"), "interview");
  assert.equal(T.nextStatus("interview", "applied"), null);
  assert.equal(T.nextStatus("interview", "closed"), "closed");
  assert.equal(T.nextStatus("offer", "closed"), null);
  assert.equal(T.nextStatus("saved", null), null);
});

test("the Gmail draft carries the email and the PDF", () => {
  const m = T.mime({ to: "a@b.com", subject: "Application: Buyer", body: "Hi" }, "JVBERi0=", "Me.pdf");
  assert.match(m, /^To: a@b.com\r\nSubject: Application: Buyer\r\n/);
  assert.match(m, /Content-Type: application\/pdf; name="Me.pdf"/);
  assert.match(m, /JVBERi0=/);
  assert.equal(T.gmailQuery({ company: "BuildCo" }, "2026-10-01T00:00:00Z"), '"BuildCo" -from:me -in:chats after:2026/10/01');
});

test("the resume keeps a relocation note, its best number and one name per skill", () => {
  const r = T.readResume(`Sam Lee
Shreveport, LA (relocating to Dallas-Fort Worth) | sam@example.com

EXPERIENCE
Buyer | Ark Supply
Jan 2020 - Present
- Talked with vendors daily
- Handled paperwork for orders
- Helped the yard crew
- Kept PO accuracy above 99%

SKILLS
Inventory, Inventory Control, OSHA, OSHA 30`);
  assert.match(r.city, /relocating to Dallas-Fort Worth/);
  const t = T.tailor(r, { title: "Purchasing Agent", company: "BuildCo", description: "Vendors and orders." }, {});
  assert.ok(t.jobs[0].bullets.some(b => /99%/.test(b)), t.jobs[0].bullets.join(" | "));
  assert.ok(!t.skills.includes("Inventory") && !t.skills.includes("OSHA"), t.skills.join(", "));
});

// Resumes as people actually write them: all caps, no bullet marks, tab columns, dates first, headings on the same line.
const ODD = {
CAPS: `TONY RIVERA
GRAND PRAIRIE TX 75050 | (972) 555-0144 | TRIVERA@GMAIL.COM

PROFESSIONAL EXPERIENCE
YARD LEAD
84 LUMBER - GRAND PRAIRIE TX
JAN 2021 - PRESENT
- RAN A CREW OF 6 LOADING CONTRACTOR ORDERS
- KEPT INVENTORY ACCURATE WITH WEEKLY CYCLE COUNTS
- RECEIVED FREIGHT AND CHECKED PURCHASE ORDERS
COUNTER SALES
HOME DEPOT PRO - ARLINGTON TX
MAR 2017 - DEC 2020
- QUOTED LUMBER AND MILLWORK FOR 40+ CONTRACTOR ACCOUNTS
- PROCESSED SPECIAL ORDERS IN SAP

SKILLS
INVENTORY, FORKLIFT, SAP, QUOTING
`,
NOMARK: `Dana Brooks
Fort Worth Texas
dana.brooks@outlook.com  817-555-0177

Experience
Inside Sales Rep, Builders Supply Co    2020 - Present
Quoted doors, windows and millwork for builders
Handled 30 calls a day from contractors
Set up new accounts in Epicor
Warehouse Associate, Lowe's    2016 - 2020
Pulled and staged contractor orders
Ran the forklift and kept the yard clean

Skills: Epicor, Excel, Quoting, Customer Service
Education: Weatherford High School
`,
INLINE: `Ray Okafor | Mesquite TX | ray.okafor@gmail.com | 469 555 0100
Skills: BisTrack; Excel; Takeoffs; Purchase Orders
Experience:
Estimator — Lone Star Truss, Mesquite TX   2019 – Present
• Built takeoffs from plans for 25 bids a week
• Priced trusses and managed vendor lead times
Framer — Self employed   2012 – 2019
• Framed 120+ homes for DFW builders
• Read blueprints and specs every day
Certifications: OSHA 30, Forklift
`,
TABCO: `Luis Garza
Arlington, TX | luis.garza@yahoo.com

EMPLOYMENT
Ferguson Enterprises\tCounter Sales Associate\t2019 - Present
o\tQuoted plumbing supplies for 50 contractors a week
o\tProcessed orders and returns in SAP
Winsupply\tWarehouse Clerk\t2016 - 2019
o\tReceived freight and checked purchase orders
`,
DATEFIRST: `KELLY NGUYEN
Plano TX
kelly.n@gmail.com

WORK HISTORY
2021 – Present   Purchasing Agent, Acme Supply, Dallas TX
• Managed purchase orders for 40 active jobs
• Negotiated pricing with 25 vendors, saved 8%
2018 – 2021   Project Coordinator, Beck Group
• Tracked submittals and RFIs for $30M projects
`,
};

test("odd resume formats keep every job, the current one first, with its own lines", () => {
  const want = {
    CAPS: [["Yard Lead", "84 Lumber", 3], ["Counter Sales", "Home Depot Pro", 2]],
    NOMARK: [["Inside Sales Rep", "Builders Supply Co", 3], ["Warehouse Associate", "Lowe's", 2]],
    INLINE: [["Estimator", "Lone Star Truss", 2], ["Framer", "Self employed", 2]],
    TABCO: [["Counter Sales Associate", "Ferguson Enterprises", 2], ["Warehouse Clerk", "Winsupply", 1]],
    DATEFIRST: [["Purchasing Agent", "Acme Supply", 2], ["Project Coordinator", "Beck Group", 1]],
  };
  for (const [k, jobs] of Object.entries(want)) {
    const r = T.readResume(ODD[k]);
    assert.deepEqual(r.jobs.map(j => [j.title, j.company, j.bullets.length]), jobs, k);
  }
  assert.equal(T.readResume(ODD.NOMARK).city, "Fort Worth, TX");
  assert.equal(T.readResume(ODD.CAPS).city, "Grand Prairie, TX");
  assert.deepEqual(T.readResume(ODD.NOMARK).education, ["Weatherford High School"]);
});

test("a Gmail message is read whole, without the quoted thread", () => {
  global.atob ||= b => Buffer.from(b, "base64").toString("binary");
  const enc = t => Buffer.from(t).toString("base64url");
  const plain = { mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: enc("Thanks for applying.\n\nWe have decided to pursue other candidates.\n\nOn Tue, Oct 28, 2026 at 8:00 AM Jordan <j@x.com> wrote:\n> Can we schedule an interview Monday at 9am?") } }] };
  const text = T.mailText(plain);
  assert.match(text, /pursue other candidates/);
  assert.doesNotMatch(text, /schedule an interview/);
  assert.equal(T.readReply("Your application", text), "closed");
  const html = { mimeType: "text/html", body: { data: enc("<p>Hi Jos&eacute;,</p><p>We&#39;d like to offer you the Estimator position.</p>") } };
  assert.equal(T.readReply("Good news", T.mailText(html)), "offer");
});

// Nine more, written by a reviewer as people really send them: Word paste, PDF letter-spacing, all caps, skills-first,
// two columns, Spanish and English, a 30-year career, one job, and a LinkedIn "Save to PDF".
test("nine real-world resume layouts each read into the right jobs", async () => {
  const { readFileSync } = await import("node:fs");
  const read = f => T.readResume(readFileSync(new URL(`./resumes/${f}.txt`, import.meta.url), "utf8"));
  const want = {
    r1_word_paste: ["Terrell W. Banks", "Mansfield, TX", [["Millwork Counter Lead", "Builders FirstSource", 4], ["Yard Associate / Forklift Operator", "Lowe's Home Improvement", 2]]],
    r2_pdf_extract: ["Katherine O'Neill", "Denton, TX", [["Purchasing Coordinator", "Lone Star Mechanical Supply", 3], ["Inventory Clerk", "Lone Star Mechanical Supply", 2]]],
    r3_all_caps: ["Raymond Espinoza Jr.", "Garland, TX", [["Electrician Foreman", "Sparks Electric Co", 4], ["Journeyman Electrician", "Metro Power LLC", 2]]],
    r4_functional: ["Destiny Harper", "Fort Worth, TX", [["Office Coordinator", "Lone Oak Roofing", 0], ["Server", "Joe T. Garcia's", 0]]],
    r5_two_column: ["Thanh Nguyen", "Arlington, TX", [["Warehouse Lead", "Ferguson Enterprises", 3], ["Material Handler", "Amazon", 1]]],
    r6_spanglish: ["José Luis Hernández-Treviño", "Irving, TX", [["Framing Superintendent", "Constructora del Norte / Pulte Homes trade partner", 3], ["Carpenter Lead", "Hernández Framing LLC", 1]]],
    r8_one_job: ["Brianna Lowe", "Little Elm, TX", [["Inside Sales Associate", "Ewing Irrigation & Landscape Supply", 4]]],
    r9_linkedin_export: ["Marisol Peña", "Dallas-Fort Worth, TX", [["Junior Estimator", "Pinnacle Drywall Inc.", 2], ["Project Assistant", "Pinnacle Drywall Inc.", 1]]],
  };
  for (const [f, [name, city, jobs]] of Object.entries(want)) {
    const r = read(f);
    assert.equal(r.name, name, f); assert.equal(r.city, city, f);
    assert.deepEqual(r.jobs.map(j => [j.title, j.company, j.bullets.length]), jobs, f);
  }
  assert.equal(read("r7_long_career").jobs.length, 5);
  assert.deepEqual(read("r7_long_career").jobs[2].company, "84 Lumber");
  assert.equal(read("r2_pdf_extract").phone, "940-555-0193");
  assert.equal(read("r5_two_column").twoColumn, true);
  assert.deepEqual(read("r9_linkedin_export").skills, ["Takeoffs", "PlanSwift", "Bluebeam"]);
});

// Nine more from a later review: Indeed's export, a table summary, military to civilian, a union electrician, no dates,
// oldest job first, a Google Docs paste with ✓ and ➢, a superintendent's projects list, and a counter purchaser moving to DFW.
test("nine more layouts: military, oldest first, projects lists, check-mark skills, a move to DFW", async () => {
  const { readFileSync } = await import("node:fs");
  const read = f => T.readResume(readFileSync(new URL(`./resumes/${f}.txt`, import.meta.url), "utf8"));
  const mil = read("b3_military");
  assert.deepEqual(mil.jobs.map(j => [j.title, j.company]), [["Supply Sergeant (92Y)", "U.S. Army"], ["Unit Supply Specialist", "U.S. Army"]]);
  assert.equal(mil.city, "Killeen, TX (relocating to Fort Worth, TX)");
  const old = read("b6_oldestfirst");
  assert.deepEqual(old.jobs.map(j => j.title), ["Purchasing Lead", "Buyer", "Purchasing Assistant", "Receptionist"]);
  const gd = read("b7_gdocs");
  assert.deepEqual(gd.jobs.map(j => j.title), ["Estimator", "Project Coordinator"]);
  assert.deepEqual(gd.skills, ["PlanSwift", "Bluebeam", "Sage 300", "Procore", "Excel"]);
  const sup = read("b8_super");
  assert.deepEqual(sup.jobs.map(j => [j.title, j.dates]), [["Senior Superintendent", "2017–Present"], ["Superintendent", "2008–2017"]]);
  assert.ok(!sup.jobs.some(j => j.bullets.some(b => /projects/i.test(b))));
  const luis = read("b9_counter_purch");
  assert.equal(luis.city, "Shreveport, LA (relocating to Dallas-Fort Worth, TX)");
  assert.deepEqual(luis.skills, ["Spruce ERP", "Purchasing", "Counter Sales", "Lumber Grading", "Spanish"]);
  const t = T.tailor(luis, { title: "Purchasing Coordinator", company: "Hilti", description: "Purchasing coordinator to manage purchasing, purchase orders and inventory. Hilti is hiring." });
  assert.deepEqual(t.missing, []);   // "Purchase lumber… place POs" and "dead stock" show the work; "hiring" is never a skill to add
  assert.match(t.summary, /^Most recently worked as a Purchaser at Red River Lumber Co\. /);
  assert.ok(!/\.\./.test(T.email(t, { title: "Purchasing Coordinator", company: "Hilti" }).body));
  assert.match(T.tailor(mil, { title: "Buyer", company: "X" }).summary, /in the U\.S\. Army\./);
  assert.deepEqual(read("b1_indeed").education[0], "High school diploma · Arlington High School - Arlington, TX · 2014 to 2018");
  assert.ok(!read("b4_union").education.includes("APPRENTICESHIP"));
});
