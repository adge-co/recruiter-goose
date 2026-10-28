// The app carries its own copy of the industry and role lists so setup opens instantly, without a network call.
// This keeps those copies identical to the engine's, which is the one source the server matches on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INDUSTRIES } from "../src/directory.js";
import { ROLE_WORDS } from "../src/match.js";

const html = readFileSync(new URL("../../app/index.html", import.meta.url), "utf8");
const grab = name => (0, eval)("(" + html.match(new RegExp(`const ${name} = ([\\[{][\\s\\S]*?[\\]}]);`))[1] + ")");

test("the app's industries and roles match the engine's", () => {
  assert.deepEqual(grab("INDUSTRIES"), INDUSTRIES);
  assert.deepEqual([...grab("ROLES")].sort(), Object.keys(ROLE_WORDS).sort());
});
