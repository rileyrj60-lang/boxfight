import { Client, getStateCallbacks } from 'colyseus.js';

const c = new Client('ws://localhost:2567');
const lobby = await c.joinOrCreate('lobby');
console.log('lobby joined as', lobby.sessionId);

let arena = null;
let target = null;
let matchEndCount = 0;

lobby.onMessage('match_found', async (msg) => {
  console.log('match_found ->', msg.roomId);
  await lobby.leave();
  arena = await c.joinById(msg.roomId, { name: 'Bot' });
  console.log('arena joined as', arena.sessionId);

  const $ = getStateCallbacks(arena);
  $(arena.state).players.onAdd((_p, k) => { if (k !== arena.sessionId) target = k; });

  arena.onMessage('match_start', () => console.log('match_start'));
  arena.onMessage('rematch_start', () => console.log('rematch_start'));
  arena.onMessage('match_end', () => {
    matchEndCount++;
    console.log('match_end #' + matchEndCount, '— sending rematch_request');
    setTimeout(() => arena.send('rematch_request'), 500);
  });

  setInterval(() => {
    arena.send('input', { x: 0, y: 0, z: 0, rx: 0, ry: 0, vy: 0, grounded: true });
  }, 50);

  // Don't actually shoot — let browser do it. Bot just waits for rematch.
});

lobby.send('queue', { name: 'Bot' });

setTimeout(() => {
  if (arena) arena.leave();
  process.exit(0);
}, parseInt(process.argv[2] ?? '60000', 10));
