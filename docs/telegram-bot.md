# Telegram Listings Bot — operator setup

1. **Create the bot** with @BotFather; copy the token.
2. **Get allowed user IDs** from @userinfobot.
3. **Create the KV namespace:** `wrangler kv namespace create SESSIONS`,
   put the printed id in `wrangler.toml` under `[[kv_namespaces]]`.
4. **Set secrets:**
   - `wrangler pages secret put TELEGRAM_BOT_TOKEN`
   - `wrangler pages secret put TELEGRAM_WEBHOOK_SECRET`
5. **Set vars:** `TELEGRAM_ALLOWED_IDS` in `wrangler.toml` (comma-separated).
6. **Deploy**, then register the webhook:
   `TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... npm run telegram:setup -- https://<site>/telegram/webhook`
7. **Cloudflare Access:** if Access protects the whole zone, add a **bypass**
   policy for `/telegram/*` so Telegram can POST unauthenticated.

## Local dev

`/telegram/*` only runs under `wrangler pages dev` (not `astro dev`). Expose it
with a tunnel (`cloudflared tunnel --url http://localhost:8788`) and point
`setWebhook` at the tunnel URL with the same secret.

## Commands

- `/new` — guided create-listing wizard
- `/status` — flip a listing to draft/for-sale/pending/sold
- `/cancel` — abort the current wizard
