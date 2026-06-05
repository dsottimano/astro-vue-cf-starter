#!/usr/bin/env node
// Registers the Telegram webhook + command menu. Run once after deploy.
// Usage: TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
//        node cli/telegram-setup.mjs https://your-site.pages.dev/telegram/webhook

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url = process.argv[2];

if (!token || !secret || !url) {
  console.error(
    'Required: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET env vars and a webhook URL arg.',
  );
  process.exit(1);
}

const api = (method) => `https://api.telegram.org/bot${token}/${method}`;

async function post(method, body) {
  const res = await fetch(api(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method} failed: ${JSON.stringify(json)}`);
  return json;
}

await post('setWebhook', {
  url,
  secret_token: secret,
  allowed_updates: ['message', 'callback_query'],
});
console.log('✓ webhook set →', url);

await post('setMyCommands', {
  commands: [
    { command: 'new', description: 'Create a new listing' },
    { command: 'status', description: 'Change a listing’s status' },
    { command: 'cancel', description: 'Cancel the current action' },
  ],
});
console.log('✓ command menu set');
