import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { CASES } from "./reply-cases.js";
const T = createRequire(import.meta.url)("../../app/tailor.js");

test("replies read the way a person would read them", () => {
  const wrong = CASES.filter(([want, subj, body]) => T.readReply(subj, body) !== want).map(([want, subj, body]) => `${want} <- ${T.readReply(subj, body)}: ${body}`);
  assert.deepEqual(wrong, []);
});
