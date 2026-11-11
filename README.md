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

- **Signing in:** on the shared sign-in site (see below)
- **Friends** (`/`): All, Pending, Blocked, Add Friend by ID
- **DM** (`/dm/:id`): messages show grey until HMS saves them, red with Retry / Discard on failure
- **Group** (`/groups/:id`): chat plus a member list; click a member for role, kick and ban options
- **Explore** (`/groups/explore`), **Invite** (`/invite/:code`)
- **Modals** (`src/components/Modal.tsx`, no URL of their own, opened through `src/lib/modals.ts`):
  - **User settings** (cog by your name): Profile (display name, password) and Developer (live
    connection ping), plus Log out
  - **Group settings** (group name or cog): Overview, Invites, Bans, Leave, Delete
  - **Create or join a group** (the + on the rail)
  - **Confirmations:** `useConfirm()` (`src/lib/confirm.ts`) instead of the browser's
    `confirm()`/`prompt()`; shift-click Delete on a message skips it. Tests accept one with
    `confirmModal()` from `tests/helpers.ts`.
- **Everywhere:** status dots, a status menu on your avatar, typing indicators and a red "New"
  line at the first unread message
- **Messages:** edit your own text (inline, Enter saves, Esc cancels, Up in an empty composer
  edits your latest loaded message), and reply with a clickable original-message preview.
  Edits and deletions update reply previews live. Hover/focus a message for tools, or tap it
  on a phone. Failed edits retain your draft; failed reply retries keep their original target.

The layout copies Discord's three columns. The implementation plan is closed after editing
and replies; further features and the visual redesign are deferred. Under
768 px it shows the navigation or the page, never both (`src/lib/nav.ts`). It can be installed
from the browser menu (web app manifest, no service worker).

There's no sign-in screen here. Accounts live on HMS's shared sign-in site
(`https://chickensplash.dpdns.org`, `VITE_ACCOUNTS_URL` at build time, `src/lib/accounts.ts`):
signed out, the app sends you to its `/login?return=<this page>`, and you come back signed in
to every app at once. Logging out here logs you out everywhere and lands on that site. The
terms page is there too (`/terms` here redirects). nginx expires the per-host cookies HMS set
before the switch, which would otherwise break every write with a 419.

The session is Sanctum's cookie auth: every write sends the `XSRF-TOKEN` cookie back as
`X-XSRF-TOKEN` (`src/lib/api.ts`). Signed-in users get one Echo
connection (`src/lib/realtime.tsx`) and listen on their private `user.{id}` channel;
`src/lib/live.ts` applies every event there (friends, messages, reads) to the query cache.

## Develop

Needs a running HMS (`php artisan serve`, `reverb:start`, `queue:work`):

```bash
npm install
VITE_ACCOUNTS_URL=http://localhost:8000 npm run dev   # proxies to localhost:8000 and :8080; override with HMS_URL / REVERB_URL
```

Or the whole thing in Docker (`dev/docker-compose.yml`, expects the HMS repo next to this one):
the app on `http://localhost:8090`, the sign-in site on `http://localhost:8091`.

```bash
docker compose -f dev/docker-compose.yml up -d --build
```

## Deploy

On the homelab, in `~/homelab/chat-ui`:

```bash
git pull
docker compose up -d --build
```

The container joins the external `edge` network; point the tunnel's public hostname at
`http://chat-ui:80`. The hostname must be in HMS's `SANCTUM_STATEFUL_DOMAINS` and
`REVERB_ALLOWED_ORIGINS`, and its URL in HMS's `CHAT_URL`.

## End-to-end tests

Playwright, against the local Docker stack above (Chromium and Firefox). The tests sign in
through the sign-in site at `ACCOUNTS_URL` (default `http://localhost:8091`):

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
