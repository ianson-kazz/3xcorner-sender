# THE 3× CORNER — Push Notification System

Automated 120-day push sequence: page B auto-subscribes visitors, Supabase stores
subscribers + messages, GitHub Actions sends one notification per day at 6am local time.

## Files

| File | Purpose |
| --- | --- |
| `sw.js` | Root service worker (also copied to `New folder (3)/sw.js` and `New folder (3)/main-site/sw.js`) |
| `New folder (3)/updates-noti/updates-noti.html` | Page B — runs the subscribe flow automatically on load |
| `New folder (3)/updates-noti/sw.boot.js` | Registers `/sw.js` from the page `<head>` |
| `messages-seed.js` | The 120 messages (day, title, body) |
| `seed-database.js` | Seeds the Supabase `messages` table (skips if already populated) |
| `supabase-schema.sql` | Creates `messages` + `subscribers` and the anon insert/update policies |
| `send.js` | Sender job: one message per subscriber per local 6am |
| `.github/workflows/schedule.yml` | Runs `send.js` every 15 minutes |
| `verify-local.js` | Pre-flight check: seed data, image list, blog files, DNS |

## Status of each step

1. **Service worker** — done (root + both site folders, so `/sw.js` resolves either way).
2. **Page B** — done. The existing image and button are untouched; the subscribe flow
   runs automatically on load and fails silently. A `base href="/"` was intentionally
   **not** added, because it would break the site's relative links — instead the
   service worker + blog links must be served from the site root (see Hosting).
3. **Blog path pattern** — `/blog/post-001.html` … `/blog/post-120.html` (zero-padded 3 digits).
4. **Seeding** — `seed-database.js` is ready with `BLOG_PATH_PATTERN = "/blog/post-{n}.html"`,
   but it has **not been run yet**: the Supabase host `hrcbpdsqjaiuevtwdpfb.supabase.co`
   does not resolve (NXDOMAIN). See "Blocking item" below. The script checks for existing
   rows first, so it can never duplicate.
5. **send.js** — done. `PUT_THE_LIVE_SITE_URL_HERE` is still a placeholder (line 12).
6. **Scheduler** — `schedule.yml` is ready. No GitHub repo is connected yet (no `.git`
   anywhere in this project), so nothing has been pushed and no secrets exist yet.
7. Report — see the chat summary.

## Blocking item (Step 4)

`https://hrcbpdsqjaiuevtwdpfb.supabase.co` returns NXDOMAIN from the authoritative
nameservers — the project reference in the anon/service keys does not exist. Once the
Supabase project exists with that exact ref:

1. SQL editor → paste and run `supabase-schema.sql`.
2. `npm install`
3. `node seed-database.js` → inserts 120 rows (prints "skipping seed" if already filled).
4. `node verify-local.js` → pre-flight recap.

## What only you can do in a browser (one-time clicks)

These cannot be automated — each one is a button inside a website:

1. **Firebase Console → Project settings → Cloud Messaging**: enable the
   *Firebase Cloud Messaging API (V1)*. The VAPID key pair in the code is
   `BH7au4hAj4omMwPLPZdetvsTz5JnejdTYnG-6dFk1eIjwKAeWUT9trZan93Mat2l5OCH48LHfsZjtriKunvi2D0`
   — if the sender job reports `messaging/mismatched-credential` or 404 `SenderId`, the
   **Generate key pair** button must be pressed and the new key pasted into
   `updates-noti.html` (`VAPID_KEY`).
2. **Firebase Console → Project settings → Service accounts → Generate new private key**
   — this downloads the JSON used as the `FIREBASE_SERVICE_ACCOUNT` secret.
3. **Supabase dashboard**: create the project (ref must be `hrcbpdsqjaiuevtwdpfb`, or
   update the URL/keys in `updates-noti.html`, `seed-database.js`, `sw.js` if the ref differs).
4. **GitHub**: create a repository, connect this folder, then add three repository
   secrets — `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `FIREBASE_SERVICE_ACCOUNT` — before
   the workflow can run. Paste the service-account JSON as one single line.
5. **Hosting**: once the site is live, replace `PUT_THE_LIVE_SITE_URL_HERE` in `send.js`.

## Hosting requirement

Both these must be reachable at the site root, or notifications will not work:

* `/sw.js` (already copied into the site folder)
* `/blog/post-001.html` … `/blog/post-120.html`

If the site is deployed as a static root (Netlify / Vercel / GitHub Pages / Cloudflare
Pages) with `New folder (3)/main-site` as the publish directory, both resolve and the
links in `send.js` (`/blog/post-0NN.html`) are correct as-is. If the site stays under a
sub-path, register the service worker with a relative path and prefix the links instead.

## Update — Supabase resumed, 120 rows verified, hosting prepared

Supabase was *paused* (which withdraws the subdomain from DNS and looks exactly like
NXDOMAIN), not missing. After the resume, verified live through the REST API:

* `hrcbpdsqjaiuevtwdpfb.supabase.co` resolves → 104.18.38.10 / 172.64.149.246
* `messages` — **120 rows**, `day_number` 1…120 contiguous, `link_url` = `/blog/post-0NN.html`,
  `image_url` populated, title prefixed `THE 3X CORNER: `
* `subscribers` — exists; live columns `id, fcm_token, timezone, created_at, last_sent_date`
  (no `messages_sent`), so `send.js` runs in date mode via its column probe

Deployment root is `New folder (3)/main-site` (Netlify drag-and-drop):

* Page B moved inside it → final URL `/updates-noti.html`
* `index.html` footer link updated to `updates-noti.html` (previously pointed outside the root)
* Service-worker registration is now relative (`./sw.js`) instead of absolute `/sw.js`
* `sw.boot.js` added inside the deploy root
