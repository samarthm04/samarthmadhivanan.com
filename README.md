# samarthmadhivanan.com

Static personal site — plain HTML/CSS/JS, no build step.

## Structure

| File | Purpose |
|---|---|
| `index.html` | Home |
| `projects.html` | Projects grid (filterable) |
| `blog.html` + `blog.js` | Blog — **posts currently live in the visitor's `localStorage` only.** See note below. |
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

## Deploy

Any static host. Vercel/Netlify: point at this repo, no build command, output dir = root.

## Before going live — open items

1. **Domain + email** — every page assumes `https://samarthmadhivanan.com` and `hello@samarthmadhivanan.com`. Register the domain, set up the mailbox, or find-and-replace both strings.
2. **`og.png`** — referenced by every page's Open Graph tags but not yet generated. Open `og-template.html`, screenshot the frame at exactly 1200×630, save as `og.png` in the root.
3. **LinkedIn URL** — links point to `https://www.linkedin.com/in/samarth-madhivanan`; confirm that's the real handle.
4. **Blog** — `blog.js` stores posts in the browser only, so visitors see an empty feed. Either bake posts into static HTML, move to a real CMS/build, or remove Blog from the nav until it's ready.
5. **Real images** — project cards, the "ticket" photo and testimonial photos are CSS placeholders. Add a headshot and one image per project.
6. **Client claims** — verify the KPMG / NPCI / Intel / IndyRX names and the "700M daily transactions" line, and confirm you're permitted to display those names/logos.
7. **Testimonials** — the hidden block on `index.html` has placeholder quotes; replace with real attributed ones or delete.
8. Submit `sitemap.xml` in Google Search Console; add analytics if wanted.
