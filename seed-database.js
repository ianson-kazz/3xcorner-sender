import { createClient } from "@supabase/supabase-js";
import { messages } from "./messages-seed.js";
import fs from "fs";

const supabase = createClient(
  "https://hrcbpdsqjaiuevtwdpfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyY2JwZHNxamFpdWV2dHdkcGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODYwNzg4MSwiZXhwIjoyMTA0MTgzODgxfQ.mvQFnmHDxSHQtdTRm62_WA4xnUxtG0_ImzHOFp55tpk"
);

// Works whether this script runs from the project root or from "New folder (3)".
const rehostedPath = ["./rehosted-images.json", "./New folder (3)/rehosted-images.json"].find(p => fs.existsSync(p));
if (!rehostedPath) {
  console.error("rehosted-images.json not found — run rehost-images.js first.");
  process.exit(1);
}
const rehosted = JSON.parse(fs.readFileSync(rehostedPath, "utf-8"));

// STEP 3 finding: the 120 blog files live at main-site/blog/post-001.html … post-120.html
// (zero-padded to 3 digits), which on the live site is the path below.
const BLOG_PATH_PATTERN = "/blog/post-{n}.html"; // e.g. "/blog/post-001.html"

async function seed() {
  // Never duplicate: stop early if the table already has rows.
  const { count, error: countError } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true });
  if (countError) {
    console.error("Could not read the messages table:", countError.message);
    console.error("Create the table first (supabase-schema.sql), then run this again.");
    return;
  }
  if (count && count > 0) {
    console.log(`messages already contains ${count} row(s) — skipping seed to avoid duplicates.`);
    return;
  }

  const rows = messages.map((msg) => {
    const imageIndex = ((msg.day - 1) % 37) + 1;
    const imageEntry = rehosted.find(r => r.index === imageIndex);
    return {
      day_number: msg.day,
      title: "THE 3X CORNER: " + msg.title,
      body: msg.body,
      image_url: imageEntry ? imageEntry.url : null,
      link_url: BLOG_PATH_PATTERN.replace("{n}", String(msg.day).padStart(3, "0"))
    };
  });
  const { error } = await supabase.from("messages").insert(rows);
  if (error) console.error("Insert failed:", error);
  else console.log("All 120 messages inserted.");
}
seed();