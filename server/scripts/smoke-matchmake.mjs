import { Client, getStateCallbacks } from 'colyseus.js';

const c = new Client('ws://localhost:2567');
const lobby = await c.joinOrCreate('lobby');
console.log('lobby joined as', lobby.sessionId);

let arena = null;

lobby.onMessage('match_found', async (msg) => {
  console.log('match_found ->', msg.roomId);
  await lobby.leave();
  arena = await c.joinById(msg.roomId, { name: 'Bot' });
  console.log('arena joined', arena.roomId, 'as', arena.sessionId);

  const $ = getStateCallbacks(arena);
  $(arena.state).listen('matchState', (v) => console.log('matchState ->', v));
  $(arena.state).listen('winnerId', (v) => v && console.log('winnerId ->', v));

  arena.onMessage('match_start', () => console.log('match_start'));
  arena.onMessage('match_end', (msg) => console.log('match_end:', msg));
  arena.onMessage('rematch_start', () => console.log('rematch_start'));

  // After matchState is 'playing', kill the opponent thrice to win.
  let target = null;
  $(arena.state).players.onAdd((p, k) => { if (k !== arena.sessionId) target = k; });

  // Heartbeat input
  setInterval(() => {
    arena.send('input', { x: 0, y: 0, z: 0, rx: 0, ry: 0, vy: 0, grounded: true });
  }, 50);

  // After a delay, do 3 quick eliminations
  setTimeout(async () => {
    for (let kill = 0; kill < 3; kill++) {
      // 5 shots @ 25 = 125 (clamped to 25 each, takes 4 to kill from 100)
      for (let i = 0; i < 5; i++) {
        arena.send('shoot', {
          targetSessionId: target, hitBuildId: null,
          damage: 25, weapon: 'rifle',
          origin: { x: 0, y: 1.7, z: 0 }, dir: { x: 1, y: 0, z: 0 }
        });
        await new Promise(r => setTimeout(r, 60));
      }
      console.log(`bot kill ${kill + 1}/3 fired`);
      await new Promise(r => setTimeout(r, 3500));  // wait for respawn
    }
  }, 1500);
});

lobby.send('queue', { name: 'Bot' });

const dur = parseInt(process.argv[2] ?? '20000', 10);
setTimeout(() => {
  if (arena) arena.leave();
  console.log('bot done');
  process.exit(0);
}, dur);
