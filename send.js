import { createClient } from "@supabase/supabase-js";
import admin from "firebase-admin";

// ═══════════════════════════════════════════════════════════════════════════
// !!! THE ONE VALUE YOU MUST UPDATE ONCE THE SITE IS LIVE !!!
// Replace the placeholder below with the live site origin (no trailing slash),
// e.g. "https://the3xcorner.com" or "https://your-project.pages.dev".
// Every notification link is built as: PUT_THE_LIVE_SITE_URL_HERE + msg.link_url
// while the site is not hosted yet, notification links will open a dead link.
// ════════════════════════════════════════════════════════════════════════════
const LIVE_SITE_URL = "https://the-3x-corner.netlify.app/";
const MAX_DAY = 120;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });

// The live "subscribers" table may expose either the plain counter
// (messages_sent + last_sent_at) or only the calendar column
// (last_sent_date). Detect which one exists, once, and use it.
//   counter mode: nextDay = messages_sent + 1, guarded by a 20 hour cooldown
//   date mode   : one message per local calendar day, day number derived from
//                 the subscriber's own local start date (never repeats a day)
let PROGRESS_MODE = "counter";

async function detectSchema() {
  const counterProbe = await supabase.from("subscribers").select("messages_sent").limit(1);
  if (!counterProbe.error) { PROGRESS_MODE = "counter"; return true; }
  const dateProbe = await supabase.from("subscribers").select("last_sent_date").limit(1);
  if (!dateProbe.error) { PROGRESS_MODE = "date"; return true; }
  console.error("subscribers has neither messages_sent nor last_sent_date:", counterProbe.error.message);
  return false;
}

function getLocalHour(timezone) {
  return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(new Date()));
}

// en-CA renders as YYYY-MM-DD, comparable as a string and safe for both
// `date` and `timestamptz` columns.
function getLocalDate(timezone, when = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(when);
}

function daysBetween(startDate, endDate) {
  const a = Date.parse(startDate + "T00:00:00Z");
  const b = Date.parse(endDate + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

async function run() {
  if (!(await detectSchema())) return;

  const { data: subscribers, error } = await supabase.from("subscribers").select("*");
  if (error) { console.error("Could not load subscribers:", error.message); return; }
  if (!subscribers || !subscribers.length) { console.log("No subscribers yet."); return; }

  console.log(`Subscribers: ${subscribers.length} | progress mode: ${PROGRESS_MODE}`);

  for (const sub of subscribers) {
    const timezone = sub.timezone || "UTC";
    let localHour;
    try { localHour = getLocalHour(timezone); }
    catch (e) { console.error(`Bad timezone for ${sub.id}: ${timezone}`); continue; }
    if (localHour !== 6) continue;                       // only at 6am local time

    const today = getLocalDate(timezone);
    let nextDay;

    if (PROGRESS_MODE === "counter") {
      const sent = Number(sub.messages_sent) || 0;
      if (sent >= MAX_DAY) continue;                     // finished the sequence
      const hoursSinceLast = sub.last_sent_at ? (Date.now() - new Date(sub.last_sent_at).getTime()) / 3600000 : 999;
      if (hoursSinceLast < 20) continue;                 // never twice in a day
      nextDay = sent + 1;
    } else {
      if (sub.last_sent_date === today) continue;        // already sent today
      const startDate = getLocalDate(timezone, new Date(sub.created_at || Date.now()));
      nextDay = daysBetween(startDate, today) + 1;
      if (nextDay < 1 || nextDay > MAX_DAY) continue;
    }

    const { data: msg } = await supabase.from("messages").select("*").eq("day_number", nextDay).single();
    if (!msg) { console.error(`No message row for day ${nextDay}`); continue; }

    const fullLink = LIVE_SITE_URL + msg.link_url;
    try {
      await admin.messaging().send({
        token: sub.fcm_token,
        notification: { title: msg.title, body: msg.body, image: msg.image_url },
        webpush: { fcmOptions: { link: fullLink } }
      });
      await markSent(sub, nextDay, today);
      console.log(`Sent day ${nextDay} to ${sub.id}`);
    } catch (err) { console.error(`Failed for ${sub.id}:`, err.message); }
  }
}

// Records progress in whichever columns the table actually has.
async function markSent(sub, nextDay, today) {
  const patch = PROGRESS_MODE === "counter"
    ? { messages_sent: nextDay, last_sent_at: new Date().toISOString() }
    : { last_sent_date: today };
  await supabase.from("subscribers").update(patch).eq("id", sub.id);
  // Best effort: keep last_sent_date in step even in counter mode, in case the
  // column exists. Ignored silently when it does not.
  if (PROGRESS_MODE === "counter") {
    try { await supabase.from("subscribers").update({ last_sent_date: today }).eq("id", sub.id); } catch (e) {}
  }
}
run();