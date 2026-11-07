# chat-ui

The front end of a homelab chat app (Discord / WhatsApp / Telegram inspired), live at
`chat.chickensplash.dpdns.org`. The back end is
[HMS](https://github.com/ChickenSplash/homelab-management-system); its roadmap is in
`docs/plans/messaging-service.md` there.

## Stack

- React 19 + TypeScript, Vite, Tailwind CSS 4
- TanStack Query for API data, React Router
- Laravel Echo + pusher-js for Reverb WebSockets

## How it talks to HMS

Everything is same-origin: nginx (or the Vite dev server) forwards

- `/api/` and `/sanctum/` to `hms:3000`
- `/app/` (WebSocket) to `hms-reverb:8080`

Sign-in is Sanctum session auth: `GET /sanctum/csrf-cookie` once, then every write sends the
`XSRF-TOKEN` cookie back as `X-XSRF-TOKEN` (`src/lib/api.ts`). Signed-in users get one Echo
connection (`src/lib/realtime.tsx`) and listen on their private `user.{id}` channel.

## Develop

Needs a running HMS (`php artisan serve`, `reverb:start`, `queue:work`):

```bash
npm install
npm run dev   # proxies to localhost:8000 and :8080; override with HMS_URL / REVERB_URL
```

## Deploy

On the homelab, in `~/homelab/chat-ui`:

```bash
git pull
docker compose up -d --build
```

The container joins the external `edge` network; point the tunnel's public hostname at
`http://chat-ui:80`. The hostname must be in HMS's `SANCTUM_STATEFUL_DOMAINS` and
`REVERB_ALLOWED_ORIGINS`.

## End-to-end tests

Playwright, against a deployed instance (Chromium and Firefox):

```bash
BASE_URL=https://chat.chickensplash.dpdns.org npx playwright test
```

Registered test accounts use `e2e-*@example.com` addresses; delete them afterwards.
