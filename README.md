# BoxFight

A browser-based 1v1 build-fight arena. Two players queue up, get matched,
and fight to 3 eliminations with a rifle, sniper, pickaxe, and Fortnite-
style placeable walls / ramps / floors / roofs. No accounts, no install,
no persistence — just open the URL, type a name, click Play.

Built with Three.js (rendering), Colyseus (server-authoritative match
state + WebSocket relay), Vite (client tooling), and TypeScript.

## Local development

This repo is an npm workspace with three packages: `client`, `server`,
`shared`.

```bash
npm install         # installs all workspaces
npm run dev:server  # terminal 1 — Colyseus on ws://localhost:2567
npm run dev:client  # terminal 2 — Vite dev server (http://localhost:5173)
```

Open two tabs to `http://localhost:5173/`. Each tab:

1. Lands on the BoxFight title screen with an editable name input
2. Click **Play** → joins the matchmaking queue
3. As soon as another tab clicks Play, both auto-match into a private arena
4. Fight to 3 eliminations
5. **Rematch** (both must agree) or **Leave** at the end

`?room=foo` skips the lobby and joins/creates a private arena named
`foo` directly — useful for ad-hoc testing.

## Controls

- `WASD` move &middot; `Shift` sprint &middot; `Ctrl` slide &middot; `Space` jump
- Mouse to look &middot; LMB to fire &middot; RMB to scope (sniper)
- `1` rifle &middot; `2` sniper &middot; `3` pickaxe &middot; `R` reload
- `Q` wall &middot; `F` ramp &middot; `C` floor &middot; `V` roof &middot; `E` rotate
- LMB to place build &middot; RMB / `X` to leave build mode

## Authority model

| What                | Who decides                                    |
|---------------------|------------------------------------------------|
| Movement            | Client (sends position to server every 33ms)   |
| Camera/look         | Client                                         |
| Hit detection       | Shooter's client (server only clamps damage)   |
| Player HP & death   | **Server**                                     |
| Build placement     | **Server** (validates slot + clear AABB)       |
| Build HP            | **Server**                                     |
| Match state / score | **Server**                                     |
| Respawn             | **Server** (3s after hp=0)                     |

Damage caps applied by the server (clamped silently above):

| Weapon  | Player damage | Build damage |
|---------|---------------|--------------|
| Rifle   | 25            | 12           |
| Sniper  | 110           | 60           |
| Pickaxe | 20            | 50           |

## Deploy

The client is a static SPA that talks to a long-running WebSocket
server. They deploy separately.

### Server: Fly.io (or Railway)

The server has a Dockerfile. Both Fly.io and Railway support
WebSockets out of the box and inject `PORT` env automatically.

```bash
cd server
fly launch       # answer "yes" to "deploy now"
# OR
railway init && railway up
```

Required env vars: none beyond `PORT` (auto-injected). The server
exposes:

- `wss://<your-host>` — Colyseus WebSocket
- `https://<your-host>/stats` — JSON `{ online, rooms }` for the client's
  online-count display
- `https://<your-host>/health` — plain text health check

### Client: Vercel (or Netlify)

```bash
cd client
npm run build    # outputs to dist/
```

In Vercel/Netlify, set:

- Build command: `npm run build` (root: `client`)
- Output directory: `client/dist`
- Env: `VITE_SERVER_URL=wss://your-fly-app.fly.dev`

Vercel does **not** support persistent WebSockets — deploy only the
client there. The server has to live somewhere with WebSocket support
(Fly.io, Railway, Render, fly.io clones, etc.).

### Env vars

`client/.env` (or platform env):

```
VITE_SERVER_URL=wss://your-server-host
```

`server` (auto-injected by host):

```
PORT=2567   # optional override
```

## Tech stack

- [Three.js](https://threejs.org/) — rendering
- [Colyseus](https://colyseus.io/) — multiplayer state sync + matchmaking
- [Vite](https://vitejs.dev/) — client dev server + build
- TypeScript everywhere

## Known limitations

These are intentional cuts. They're not bugs:

- **Hit detection is client-authoritative.** A modified client can claim
  hits it didn't make. Server-side raycasts are post-MVP work.
- **No reconnection.** If you refresh mid-match you go back to the lobby.
- **No persistence.** No accounts, ELO, friends, or stats. Matches are
  ephemeral.
- **No spectators or 3rd-tab handling.** A 3rd tab joining `?room=test`
  gets routed to a fresh `test` room rather than the in-progress one.
- **No music, voice, or chat.** Sound effects only.
- **Single map, single mode, two weapons.** Polish over breadth.
- **Browser-only.** No mobile touch controls, no controller support.

## Repo layout

```
1v1.lol/
├── package.json          (workspaces: shared, server, client)
├── shared/src/constants.ts
├── server/
│   ├── src/index.ts                 — HTTP + Colyseus boot
│   ├── src/rooms/{Lobby,Arena}Room.ts
│   ├── src/schema/*.ts
│   ├── scripts/smoke-*.mjs          — local end-to-end test scripts
│   └── Dockerfile
└── client/
    ├── src/main.ts                  — game loop + lifecycle wiring
    ├── src/{Player,Rifle,Sniper,Pickaxe,Weapon*}.ts
    ├── src/build/                    — grid + manager + pieces + preview
    ├── src/net/                      — NetworkClient, RemotePlayer, CombatNet
    ├── src/ui/                       — landing/queue/match-end/screen mgr
    ├── src/audio/AudioManager.ts
    ├── src/fx/{DamageNumbers,ScreenShake}.ts
    └── src/HUD.ts
```
