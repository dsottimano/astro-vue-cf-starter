# Getting started

[← Back to wiki](index.md)

## Logging in

1. Go to **`https://your-site.com/admin`** (replace with your real address).
2. You'll be asked to sign in through **Cloudflare Access** — usually a one-time
   code sent to your work email, or a single-sign-on button. This is the security
   gate; only approved people can reach the admin.
3. After signing in you land on the **Dashboard**.

> If you can't get in, your email may not be on the access list. Ask whoever set
> up the site to add you in Cloudflare Access.

## The layout

The admin looks like WordPress. On the left is the menu:

| Menu item | What it's for |
|---|---|
| **Dashboard** | The home screen / overview |
| **Listings** 🏠 | Properties for sale |
| **Posts** 📝 | Blog articles |
| **Categories** 🏷 | Folders for organizing blog posts |
| **Redirects** ↪ | Forwarding old web addresses to new ones |
| **View site ↗** | Opens the live public website in a new tab |

Click a menu item to open that section. Lists show what already exists; a button
lets you add a new one.

## Languages

The site is **bilingual** — every listing and post exists per language
(for example **English** and **Spanish**). When you create or edit content you
choose the language it belongs to.

- A property or article in English and the same one in Spanish are **linked**
  together (they share a "translation key") so visitors can switch languages.
- You don't have to create both at once. If a translation is missing, the site
  falls back to the default language.

## Saving vs. publishing

When you click **Save**, your change is recorded immediately — but the **public
website takes a minute or two to update**. This is normal and important to
understand. See **[How publishing works](publishing.md)**.

## A note on the Save button

After you save you'll see a small confirmation like *"Saved — commit a1b2c3d."*
That code is just a receipt; you can ignore it. If you see a red error message
instead, your change was **not** saved — try again, and if it keeps failing,
report the message.
