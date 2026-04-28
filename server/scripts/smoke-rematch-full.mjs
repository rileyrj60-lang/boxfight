import { Client, getStateCallbacks } from 'colyseus.js';

const c = new Client('ws://localhost:2567');
const lobby = await c.joinOrCreate('lobby');
console.log('lobby joined as', lobby.sessionId);

let arena = null;
let target = null;

lobby.onMessage('match_found', async (msg) => {
  console.log('match_found ->', msg.roomId);
  await lobby.leave();
  arena = await c.joinById(msg.roomId, { name: 'Bot' });
  console.log('arena joined as', arena.sessionId);

  const $ = getStateCallbacks(arena);
  $(arena.state).players.onAdd((_p, k) => { if (k !== arena.sessionId) target = k; });
  $(arena.state).listen('matchState', (v) => console.log('matchState ->', v));

  arena.onMessage('match_start', () => console.log('[bot] match_start'));
  arena.onMessage('rematch_start', () => console.log('[bot] rematch_start'));
  arena.onMessage('match_end', (msg) => {
    console.log('[bot] match_end winner=' + msg.winnerId);
    setTimeout(() => {
      console.log('[bot] sending rematch_request');
      arena.send('rematch_request');
    }, 500);
  });

  setInterval(() => {
    arena.send('input', { x: 0, y: 0, z: 0, rx: 0, ry: 0, vy: 0, grounded: true });
  }, 50);

  // Bot wins by killing browser thrice
  setTimeout(async () => {
    for (let kill = 0; kill < 3; kill++) {
      for (let i = 0; i < 5; i++) {
        arena.send('shoot', {
          targetSessionId: target, hitBuildId: null,
          damage: 25, weapon: 'rifle',
          origin: { x: 0, y: 1.7, z: 0 }, dir: { x: 1, y: 0, z: 0 }
        });
        await new Promise(r => setTimeout(r, 60));
      }
      console.log(`[bot] kill ${kill + 1}/3 fired`);
      await new Promise(r => setTimeout(r, 3500));
    }
  }, 1500);
});

lobby.send('queue', { name: 'Bot' });

setTimeout(() => {
  if (arena) arena.leave();
  process.exit(0);
}, parseInt(process.argv[2] ?? '40000', 10));
