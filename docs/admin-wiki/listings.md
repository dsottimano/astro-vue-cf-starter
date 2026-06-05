# Listings

[← Back to wiki](index.md)

Listings are the properties shown on the site. Open **Listings** 🏠 in the left
menu to see them all.

## Add a listing

1. Click **Listings → Add** (or the new-listing button).
2. Choose the **language** for this listing.
3. Fill in the form (sections explained below).
4. Click **Save**. Wait a minute or two for it to appear on the site
   (see [How publishing works](publishing.md)).

> 📱 You can also create listings from your phone with the
> [Telegram bot](telegram-bot.md).

## The form, section by section

### Basics
- **Title** — the property name shown to visitors.
- **Slug** — the web address piece (e.g. `sunny-villa` →
  `/en/listings/sunny-villa`). It's **filled in automatically from the title**;
  you only need to touch it if you want a custom address. Avoid changing the slug
  after a listing is live (it changes the URL).
- **Translation key** — links this listing to its other-language version. Leave
  the auto-filled value unless you're deliberately pairing translations.
- **Status** — **Draft** (hidden/not ready), **For sale**, **Pending**, or
  **Sold**.
- **Featured** — tick to highlight it (e.g. on the homepage).

### Price & type
- **Price** and **Currency** (e.g. `USD`).
- **Type** — House, Condo, Lot, or Commercial.
- **Beds**, **Baths**, **Area** + **Unit** (sqft/sqm), **Lot size** — fill what
  applies (a lot won't have beds/baths; leave those blank).

### Address
- **Street / City / Region / Country**.
- **Lat / Lng** — map coordinates. If you don't know them, you can leave them and
  fix later, or use the [Telegram bot](telegram-bot.md) which lets you share your
  phone's location.

### Features
A list of selling points ("Ocean view", "Solar panels"). Click **+ Add feature**
for each; ✕ removes one.

### Photos & floorplans
Upload images here. See **[Photos & media](media-photos.md)** for formats and tips.
Floorplans also accept PDFs.

### Description
The longer write-up shown on the listing page. Plain text works; basic
**Markdown** is supported (e.g. `**bold**`, `- bullet lists`).

## Edit a listing

Open **Listings**, click the one you want, change anything, and **Save**.

## Change a listing's status

The fastest everyday task — marking a property **Pending** or **Sold**:

- **In the admin:** open the listing, change **Status**, Save.
- **On your phone:** use the Telegram bot's **`/status`** command —
  see [Telegram bot](telegram-bot.md).

## Delete a listing

In the listings view, use the delete control for that row. Deletion is also a
versioned change, so it can be undone by whoever maintains the site if needed.

## Tips

- **A title is required** to save (it creates the slug). If you see "A title/slug
  is required," fill in the title.
- Keep a property **Draft** until it's ready, then switch to **For sale** when you
  want it public.
