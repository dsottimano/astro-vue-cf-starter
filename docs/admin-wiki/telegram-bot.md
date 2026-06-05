# Telegram bot (on your phone)

[← Back to wiki](index.md)

The Telegram bot lets you post a listing or change its status from your phone —
ideal when you're out at a property. It does the same thing as the web admin, just
through a chat.

> This page is for **using** the bot. Setting it up (one-time, technical) is
> covered in [docs/telegram-bot.md](../telegram-bot.md).

## Before you start

- You need **Telegram** installed and your account must be **on the approved
  list**. If the bot ignores you, ask whoever set it up to add your Telegram ID.
- Open a chat with your bot (the person who set it up will share its @name).

## Commands

| Command | What it does |
|---|---|
| `/new` | Start creating a new listing (guided step by step) |
| `/status` | Change an existing listing to For sale / Pending / Sold / Draft |
| `/cancel` | Stop the current action and start over |
| `/start` | Show a short reminder of what the bot can do |

## Create a listing with `/new`

Send **`/new`** and the bot walks you through it, one question at a time. Most
steps are just **tapping a button**; some ask you to type.

The bot will ask, in order, for:

1. **Language** (English / Español) — tap one.
2. **Title** — type it.
3. **Property type** — House / Condo / Lot / Commercial.
4. **Price**, then **currency**.
5. **Beds / baths / area** (for houses & condos) or **lot size** (for lots) — tap
   numbers, or **Skip**.
6. **Address** — street, city, region, country.
7. **Location** — tap **📍 Share location** while standing at the property to set
   the map pin automatically, or **Skip** and fix it later in the admin.
8. **Features** — type them comma-separated, or Skip.
9. **Photos** — send photos right in the chat (you can send several), then tap
   **Done**.
10. **Description**, then **Status**.
11. A **preview** — review it and tap **✅ Confirm** to publish, or **✖️ Cancel**.

After you confirm, the listing is saved and appears on the site after the usual
short rebuild ([How publishing works](publishing.md)).

### Tips for the wizard
- **Photos:** send them during the photo step, one or several, then tap **Done**.
  Very large photos may be rejected — see [Photos & media](media-photos.md).
- **Made a mistake?** Tap **Cancel** (or send `/cancel`) and start again with
  `/new`.
- **Sharing location** uses your phone's GPS — handiest when you're physically at
  the property.

## Mark a property Sold/Pending with `/status`

1. Send **`/status`**.
2. Tap the listing from the list.
3. Tap the new status (For sale / Pending / Sold / Draft).

Done — the change goes live after the short rebuild. This is the quickest way to
flip a property to **Sold** from your phone.

## Troubleshooting

- **Bot doesn't respond at all:** your account may not be on the approved list.
- **A photo won't upload:** it's likely over 15 MB or an unsupported format.
- **It "expired":** if you leave a half-finished `/new` for a long time, the bot
  forgets it. Just start again with `/new`.
