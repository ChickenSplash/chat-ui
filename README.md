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

## Screens

- **Welcome:** join as a guest, log in or register
- **Friends** (`/`): All, Pending, Blocked, Add Friend by ID
- **DM** (`/dm/:id`): messages show grey until HMS saves them, red with Retry / Discard on failure
- **Group** (`/groups/:id`): chat plus a member list; click a member for role, kick and ban options
- **Group settings** (`/groups/:id/settings`): details, invite link, bans, leave, delete
- **Create or join** (`/groups/new`), **Explore** (`/groups/explore`), **Invite** (`/invite/:code`)
- **Settings** (`/settings`): display name, password, live connection ping
- **Everywhere:** status dots, a status menu on your avatar, typing indicators and a red "New"
  line at the first unread message

The layout copies Discord's three columns; the visual design gets an overhaul later. Under
768 px it shows the navigation or the page, never both (`src/lib/nav.ts`). It can be installed
from the browser menu (web app manifest, no service worker).

Sign-in is Sanctum session auth: `GET /sanctum/csrf-cookie` once, then every write sends the
`XSRF-TOKEN` cookie back as `X-XSRF-TOKEN` (`src/lib/api.ts`). Signed-in users get one Echo
connection (`src/lib/realtime.tsx`) and listen on their private `user.{id}` channel;
`src/lib/live.ts` applies every event there (friends, messages, reads) to the query cache.

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

Playwright, against a deployed instance, best a local Docker copy (Chromium and Firefox):

```bash
BASE_URL=http://localhost:8090 npx playwright test --project=chromium --project=firefox
```

The `mobile` project (`tests/mobile.spec.ts`) runs WebKit at iPhone size. WebKit needs
Ubuntu's libraries, so on Arch run it in Playwright's image:

```bash
docker run --rm --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -e BASE_URL=http://localhost:8090 \
  -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.65.0-noble npx playwright test --project=mobile
```

WebKit won't keep a `Secure` cookie over plain `http://localhost`, so a local HMS for it needs
`SESSION_SECURE_COOKIE=false`.

Registered test accounts use `e2e-*@example.com` addresses; delete them afterwards.
