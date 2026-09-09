# samarthmadhivanan.com

Static personal site — plain HTML/CSS/JS, no build step.

## Structure

| File | Purpose |
|---|---|
| `index.html` | Home |
| `projects.html` | Projects grid (filterable) |
| `blog.html` + `blog.js` | Blog — reads markdown posts from `/posts` |
| `posts.json` + `posts/*.md` | Blog content (see "Writing a post" below) |
| `contact.html` | Contact form (opens a pre-filled `mailto:`) |
| `site.css` | Shared styles (all pages except `index.html`, which is self-contained) |
| `nav.js` | Mobile nav toggle |
| `404.html` | Not-found page |
| `favicon.svg`, `robots.txt`, `sitemap.xml` | Static assets |
| `og-template.html` | Source for the social share image — see below |

## Local preview

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

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

Rendering is client-side (`fetch` from `/posts`), so it needs to be served over HTTP — the local `python3 -m http.server` works; opening the file directly does not.

## Deploy

Any static host. Vercel/Netlify: point at this repo, no build command, output dir = root.

## Before going live — open items

1. **Domain** — register `samarthmadhivanan.com` and point it at Vercel.
2. **`og.png`** — referenced by every page's Open Graph tags but not yet generated. Open `og-template.html`, screenshot the frame at exactly 1200×630, save as `og.png` in the root.
3. **Real images** — project cards, the "ticket" photo and testimonial photos are CSS placeholders. Add a headshot and one image per project.
5. **Client claims** — verify the KPMG / NPCI / Intel / IndyRX names and the "700M daily transactions" line, and confirm you're permitted to display those names/logos.
6. **Testimonials** — the hidden block on `index.html` has placeholder quotes; replace with real attributed ones or delete.
7. Submit `sitemap.xml` in Google Search Console; add analytics if wanted.

Contact email is `samarthm04edu@gmail.com`; LinkedIn is `/in/samarth-madhivanan2306`.
