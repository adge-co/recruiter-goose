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
