// Checks every company board in the directory, one at a time, and prints which ones answer.
import { DIRECTORY } from "../src/directory.js";
import { readBoard } from "../src/sources/index.js";
let bad = 0;
for (const c of DIRECTORY) {
  try { const jobs = await readBoard(c); console.log(`✓ ${c.name} (${c.ats}/${c.token}): ${jobs.length} open jobs`); }
  catch (e) { bad++; console.log(`✗ ${c.name} (${c.ats}/${c.token}): ${e.message || e}`); }
}
console.log(`${DIRECTORY.length - bad} of ${DIRECTORY.length} boards answered.`);
process.exitCode = bad ? 1 : 0;
