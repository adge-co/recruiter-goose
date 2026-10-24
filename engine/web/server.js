// Local test server: open http://localhost:8787, fill in the form, see matched postings.
// Keys are optional: JSEARCH_KEY=... ADZUNA_ID=... ADZUNA_KEY=... npm start
import http from "node:http";
import { readFile } from "node:fs/promises";
import { match } from "../src/match.js";
import { INDUSTRIES } from "../src/directory.js";

const PORT = Number(process.env.PORT) || 8787;
const env = { JSEARCH_KEY: process.env.JSEARCH_KEY, ADZUNA_ID: process.env.ADZUNA_ID, ADZUNA_KEY: process.env.ADZUNA_KEY };
const page = new URL("./index.html", import.meta.url);

http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(await readFile(page));
    }
    if (req.method === "GET" && req.url === "/api/options") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ industries: INDUSTRIES, keys: { jsearch: !!env.JSEARCH_KEY, adzuna: !!(env.ADZUNA_ID && env.ADZUNA_KEY) } }));
    }
    if (req.method === "POST" && req.url === "/api/match") {
      let body = "";
      for await (const chunk of req) { body += chunk; if (body.length > 100_000) throw new Error("Too much input."); }
      const out = await match(JSON.parse(body || "{}"), env);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(out));
    }
    res.writeHead(404); res.end("Not found");
  } catch (e) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
}).listen(PORT, () => console.log(`Recruiter Goose engine running at http://localhost:${PORT}`));
