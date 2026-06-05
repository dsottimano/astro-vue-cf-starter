# Redirects

[← Back to wiki](index.md)

A **redirect** forwards an old web address to a new one, so old links and
bookmarks don't break. Open **Redirects** ↪ in the left menu.

## When to use one

- You changed a listing's or post's slug and the old link is out there.
- You're retiring a page and want visitors sent somewhere sensible.
- You printed a short link (e.g. `/promo`) and want it to point at a real page.

## Add a redirect

1. Click **Add row**.
2. **Source** — the old path, starting with `/` (e.g. `/old-listing`).
3. **Destination** — where to send people (e.g. `/en/listings/sunny-villa`, or a
   full `https://…` URL).
4. **Status** — leave at **301** unless you have a reason to change it:
   - **301** — permanent move (default; best for SEO).
   - **302 / 307** — temporary.
   - **308** — permanent, keeps the request method.
5. Click **Save redirects**.

Empty rows are ignored on save. Use the ✕ to remove a rule.

## Good to know

- Redirects take effect after the usual rebuild
  ([How publishing works](publishing.md)).
- Keep **Source** paths starting with `/`.
- Don't point a page at itself, and avoid chains (A→B→C) where you can — send
  straight to the final destination.
