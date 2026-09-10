# samarthmadhivanan.com

Personal site — static HTML/CSS/JS, plus Vercel Functions powering **Samarth's Assistant**
(a grounded chat widget with lead capture and a live admin takeover console).

## Structure

| File | Purpose |
|---|---|
| `index.html` | Home |
| `projects.html` | Projects grid (filterable) |
| `blog.html` + `blog.js` | Blog — reads markdown posts from `/posts` |
| `posts.json` + `posts/*.md` | Blog content (see "Writing a post") |
| `contact.html` | Contact form → `/api/lead` |
| `site.css` | Shared styles (all pages except `index.html`, which is self-contained) |
| `nav.js` | Mobile nav toggle |
| `assistant.css` + `assistant.js` | The floating assistant widget |
| `admin.html` | Password-gated console — Chats + Leads, join as Samarth |
| `api/chat.js` | Claude proxy. **API key stays server-side.** |
| `api/lead.js` | Validates, stores and notifies — one round trip |
| `api/messages.js` | Visitor polls here for Samarth's replies |
| `api/admin.js` | Console backend (login, conversations, leads, reply, takeover) |
| `api/_lib/notify.js` | Lead notifications (Resend and/or Telegram) |
| `api/_lib/` | Knowledge base, system prompt, DB client, validation |
| `404.html`, `favicon.svg`, `robots.txt`, `sitemap.xml` | Static assets |
| `og-template.html` | Source for the social share image |

## Samarth's Assistant

A small floating blob, bottom-right. It answers basic questions about Samarth, and the
moment anything gets specific it takes a message instead.

**How hallucination is prevented**

- The model may only state facts from `api/_lib/kb.js` (built from the real GitHub repos).
  Anything else → "I don't know" plus a message form.
- Hard bans in the system prompt: prices, timelines, availability, commitments, advice,
  code, opinions, KPMG internals, anything personal.
- It never speaks as Samarth — always third person. Only admin takeover produces messages
  labelled "Samarth".
- Visitor text is treated as data, not instructions (prompt-injection resistant).
- **Lead capture is code, not the model.** The model only emits a `[[TAKE_NOTE]]` signal;
  the widget then renders a real form and `api/lead.js` validates name / email /
  phone + country code server-side. Contact details never depend on the LLM.
- Rate limits: 1000 chars per message, 60 messages per conversation, 16-turn history.
- `claude-haiku-4-5`, `temperature: 0.2`, `max_tokens: 300` (replies are 1–3 sentences).

**Admin takeover** — open `/admin.html`, enter `ADMIN_PASSWORD`. You see every conversation,
newest first, with leads flagged. Open one and hit **Join as Samarth**: the assistant goes
silent, the visitor sees "Samarth is here", and anything you type reaches them within ~5s.
Hit **Leave chat** to hand back.

## How leads reach you

**The database is the guaranteed record.** Every lead is written to Supabase and shows up
in `/admin.html` → **Leads** — name, clickable email and phone, the note, and whether a
notification went out. That works with no third-party service configured at all, and it's
the only place contact-form leads used to be missing from.

On top of that, `api/_lib/notify.js` sends you a ping. Channels are opt-in by env var,
independent, and entirely server-side — no key ever reaches the browser:

| Channel | Set | Notes |
|---|---|---|
| **Email** | `RESEND_API_KEY` | Sends from `onboarding@resend.dev` until you own and verify `samarthmadhivanan.com`, then set `LEAD_NOTIFY_FROM` |
| **Telegram** | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Instant push to your phone. No domain needed — useful before the domain is registered |

Set either, both, or neither. If one fails the other still fires, the failure is logged with
the provider's actual error message, and the lead is saved regardless.

> Web3Forms was the original choice and was removed: it returns
> `403 "This method is not allowed. Use our API in client side"` for any server-side
> submission on the free plan, which forced the access key into the browser and a
> four-step relay. Resend and Telegram both accept server-side calls, so the flow is now
> a single request from the visitor.

**Telegram setup:** message `@BotFather` → `/newbot` → copy the token. Then message your new
bot once and open `https://api.telegram.org/bot<TOKEN>/getUpdates` to read your chat id.

## Environment variables

Set these in Vercel → Settings → Environment Variables (and `.env.local` for `vercel dev`).
See `.env.example`.

| Var | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `SUPABASE_URL` | `https://bedwevhnbjvvfqmnxswg.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** (secret) |
| `ADMIN_PASSWORD` | You choose. Long. |
| `IP_SALT` | Any random string |

Optional, for lead notifications (see above) — leads are saved and visible in the console
either way:

| Var | Where to get it |
|---|---|
| `RESEND_API_KEY` | resend.com → API Keys |
| `LEAD_NOTIFY_TO` | Defaults to `samarthm04edu@gmail.com` |
| `LEAD_NOTIFY_FROM` | Defaults to `onboarding@resend.dev` |
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` |
| `TELEGRAM_CHAT_ID` | `api.telegram.org/bot<TOKEN>/getUpdates` after messaging your bot |

The database schema is already applied (`conversations`, `messages`, `leads`). RLS is on
with **no** policies and `anon`/`authenticated` grants revoked, so only the service-role key
can read or write — the browser never talks to Supabase directly.

## Local development

```bash
npm install
```

```bash
vercel dev
```

`vercel dev` runs the functions too. `python3 -m http.server 8000` still works for
static-only checks, but the assistant and contact form need the functions.

## Writing a blog post

1. Create `posts/<slug>.md`:

   ```markdown
   ---
   title: Your title
   date: 2026-09-09
   excerpt: One line that makes someone click.
   tags: [agents, tokens]
   ---

   ## A heading

   Body. **bold**, `code`, [links](https://example.com), - lists, > quotes.
   ```

2. Add `"<slug>"` to `posts.json`.
3. Commit and push — Vercel redeploys. Posts sort newest-first by `date`.

## Deploy

Import the repo on Vercel. No build command, output directory = root; it detects `/api`
automatically. Add the env vars above, then redeploy.

## Before going live — open items

1. **Domain** — register `samarthmadhivanan.com` and point it at Vercel.
2. **Env vars** — the assistant and both forms are inert until they're set.
3. ~~`og.png`~~ — done. To regenerate after editing `og-template.html`:

   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=8000 --window-size=1200,630 --screenshot=og.png "file://$PWD/og-template.html"
   ```
4. **Real images** — project cards and the "ticket" photo are CSS placeholders. Add a
   headshot and one image per project.
5. **Client claims** — verify the KPMG / NPCI / Intel / IndyRX names and the "700M daily
   transactions" line, and confirm you're permitted to display those names.
6. **Testimonials** — the hidden block on `index.html` has placeholder quotes; replace with
   real attributed ones or delete.
7. **Check the KB** — read `api/_lib/kb.js` end to end. Anything wrong in there is
   something the assistant will confidently repeat.
8. Submit `sitemap.xml` in Google Search Console; add analytics if wanted.

Contact email is `samarthm04edu@gmail.com`; LinkedIn is `/in/samarth-madhivanan2306`.
