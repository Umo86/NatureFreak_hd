# NatureFreak_hd

The naturefreak.org site: a nature journal, a free directory of nature photographers, and paid features on @naturefreak_hd.

## What's here

- `index.html`, `directory.html`, `profile.html`, `join.html`, `get-featured.html`, `blog.html`, `404.html` and the info pages (`about.html`, `contact.html`, `faq.html`, `terms.html` …)
- `journal/` — one page per article
- `js/site.js` — directory search and filters, the three-step registration, the forms, journal topic filters
- `api/` — Vercel serverless functions behind the forms (`register`, `photographers`, `booking`, `subscribe`, `contact`)
- `db/schema.sql` — the Postgres tables those functions use
- `data/` — article and page copy, and the example directory listings

The HTML is generated, so edit the copy in `data/` rather than the pages.

## Forms and the database

The forms post to `/api/*`. Those functions need a Postgres connection string in the `DATABASE_URL` environment variable on Vercel
(the tables are in `db/schema.sql`). Until it is set, each endpoint answers `503 not_configured` and the site tells the visitor that
nothing was sent. Registration keeps the visitor's details in their own browser so they don't have to retype them.

New directory listings are saved as `pending`. They appear in the directory once their `status` is set to `approved`.
Email addresses are never returned by the API. While there are no approved listings, the directory shows example listings, labelled as such.

## Still placeholders

- Feature prices ("Price on request")
- Terms, privacy, cookies, refunds and paid partnership pages are drafts for review
- Payment for features is not built yet: a booking is a request, confirmed by email
- Sample photos: Pexels and Unsplash contributors
