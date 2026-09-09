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
| `admin.html` | Password-gated console — watch chats, join as Samarth |
| `api/chat.js` | Claude proxy. **API key stays server-side.** |
| `api/lead.js` | Validates + stores a lead, emails via Web3Forms |
| `api/messages.js` | Visitor polls here for Samarth's replies |
| `api/admin.js` | Console backend (login, list, messages, reply, takeover) |
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

## Environment variables

Set these in Vercel → Settings → Environment Variables (and `.env.local` for `vercel dev`).
See `.env.example`.

| Var | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `SUPABASE_URL` | `https://bedwevhnbjvvfqmnxswg.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** (secret) |
| `WEB3FORMS_ACCESS_KEY` | web3forms.com — enter `samarthm04edu@gmail.com`, it emails a key |
| `ADMIN_PASSWORD` | You choose. Long. |
| `IP_SALT` | Any random string |

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
3. **`og.png`** — referenced by every page's Open Graph tags but not yet generated. Open
   `og-template.html`, capture the frame at exactly 1200×630, save as `og.png` in the root.
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
