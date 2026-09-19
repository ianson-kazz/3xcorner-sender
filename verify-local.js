/* Local pre-flight check — run: node verify-local.js
   Validates the seed data, the image list, and that every blog file that the
   notification links point at actually exists in this project. */
import fs from "fs";
import dns from "dns/promises";
import { messages } from "./messages-seed.js";

const rehostedPath = ["./rehosted-images.json", "./New folder (3)/rehosted-images.json"].find(p => fs.existsSync(p));
const rehosted = JSON.parse(fs.readFileSync(rehostedPath, "utf-8"));
// Works whether this script runs from the project root or from "New folder (3)".
const SITE_DIR = fs.existsSync("./New folder (3)/main-site") ? "./New folder (3)/main-site" : "./main-site";
let problems = 0;

// 1. seed data
console.log(`messages-seed.js entries: ${messages.length}`);
if (messages.length !== 120) { console.log("   expected 120"); problems++; }
const seen = new Set();
for (const m of messages) {
  if (!Number.isInteger(m.day) || m.day < 1 || m.day > 120) { console.log(`   bad day: ${m.day}`); problems++; }
  if (seen.has(m.day)) { console.log(`  ✗ duplicate day: ${m.day}`); problems++; }
  seen.add(m.day);
  if (!m.title || !m.body) { console.log(`  ✗ day ${m.day} missing title/body`); problems++; }
}
if (problems === 0) console.log("  ✓ 120 unique days, all with title + body");

// 2. rehosted images
console.log(`rehosted-images.json entries: ${rehosted.length}`);
const missingImg = rehosted.filter(r => !r.url);
if (missingImg.length) { console.log(`  ✗ ${missingImg.length} entries without a url`); problems++; }
else console.log("  ✓ all image entries have a url");

// 3. blog files referenced by the links
let missingFiles = [];
for (const m of messages) {
  const file = `${SITE_DIR}/blog/post-${String(m.day).padStart(3, "0")}.html`;
  if (!fs.existsSync(file)) missingFiles.push(file);
}
if (missingFiles.length) {
  console.log(`blog files missing: ${missingFiles.length}`);
  missingFiles.slice(0, 10).forEach(f => console.log("  ✗ " + f));
  problems++;
} else {
  console.log("  ✓ all 120 /blog/post-XXX.html files exist");
}

// 4. blog <title> matches the notification title (catches day/content drift)
let titleMismatch = 0;
for (const m of messages) {
  const file = `${SITE_DIR}/blog/post-${String(m.day).padStart(3, "0")}.html`;
  const html = fs.readFileSync(file, "utf-8");
  const t = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  const expected = m.title.replace(/\.$/, "");
  if (t.trim() !== expected + " — THE 3× CORNER") titleMismatch++;
}
console.log(`blog title mismatches: ${titleMismatch}`);
if (titleMismatch) problems++;

// 5. deploy-root wiring (Netlify root = "New folder (3)/main-site")
console.log(`site-root sw.js: ${fs.existsSync(`${SITE_DIR}/sw.js`) ? "✓" : "✗ MISSING"}`);
if (!fs.existsSync(`${SITE_DIR}/sw.js`)) problems++;
console.log(`site-root sw.boot.js: ${fs.existsSync(`${SITE_DIR}/sw.boot.js`) ? "✓" : "✗ MISSING"}`);
if (!fs.existsSync(`${SITE_DIR}/sw.boot.js`)) problems++;
const pageBPath = `${SITE_DIR}/updates-noti.html`;
console.log(`Page B inside the deploy root (${pageBPath}): ${fs.existsSync(pageBPath) ? "✓" : "✗ MISSING"}`);
if (!fs.existsSync(pageBPath)) problems++;
const pageB = fs.readFileSync(pageBPath, "utf-8");
console.log(`Page B auto-subscribe present: ${pageB.includes("getToken(messaging") && pageB.includes("window.addEventListener('load'") ? "✓" : "✗"}`);
console.log(`Page B registers ./sw.js: ${pageB.includes("register('./sw.js')") ? "✓" : "✗"}`);
console.log(`Page B sw.boot.js hook present: ${pageB.includes("sw.boot.js") ? "✓" : "✗"}`);
const indexHtml = fs.readFileSync(`${SITE_DIR}/index.html`, "utf-8");
console.log(`index.html links Page B inside the root: ${indexHtml.includes('href="updates-noti.html"') ? "✓" : "✗ still pointing outside"}`);
if (!indexHtml.includes('href="updates-noti.html"')) problems++;

// 6. Supabase host reachability (this is what blocks Step 4 seeding)
try {
  const addrs = await dns.resolve4("hrcbpdsqjaiuevtwdpfb.supabase.co");
  console.log(`Supabase host resolves: ✓ ${addrs.join(", ")}`);
  try {
    const res = await fetch("https://hrcbpdsqjaiuevtwdpfb.supabase.co/rest/v1/messages?select=day_number&limit=3", {
      headers: {
        apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyY2JwZHNxamFpdWV2dHdkcGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDc4ODEsImV4cCI6MjEwNDE4Mzg4MX0.hXvVcZD_Xb8SNqVUQhM7Pe1jr6U6ZQ6gfz1Rg6zLMXM"
      }
    });
    const text = await res.text();
    console.log(`  messages table -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  } catch (e) {
    console.log(`  REST call failed: ${e.message}`);
  }
} catch (e) {
  console.log(`Supabase host does NOT resolve (${e.code || e.message}) — the project does not exist yet, so Step 4 cannot be run.`);
}

console.log(problems === 0 ? "\nRESULT: all local checks passed." : `\nRESULT: ${problems} problem group(s) above.`);