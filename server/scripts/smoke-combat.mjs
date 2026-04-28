import { Client, getStateCallbacks } from 'colyseus.js';

const room = await new Client('ws://localhost:2567').joinOrCreate('arena', { roomName: 'combat' });
console.log('joined:', room.roomId, 'as', room.sessionId);

let target = null;
const $ = getStateCallbacks(room);
$(room.state).players.onAdd((player, key) => {
  if (key !== room.sessionId && !target) {
    target = key;
    console.log('targeting', key, player.name);
  }
});

room.onMessage('killed', (msg) => {
  console.log('KILLED:', msg);
});

const heartbeat = setInterval(() => {
  room.send('input', { x: 0, y: 0, z: 0, rx: 0, ry: 0, vy: 0, grounded: true });
}, 50);

setTimeout(() => {
  if (!target) {
    console.log('no target found, exiting');
    clearInterval(heartbeat);
    room.leave();
    process.exit(0);
  }

  console.log('shooting target with rifle (25hp x4 = 100)');
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      room.send('shoot', {
        targetSessionId: target,
        hitBuildId: null,
        damage: 25,
        weapon: 'rifle',
        origin: { x: 0, y: 1.7, z: 0 },
        dir: { x: 1, y: 0, z: 0 }
      });
      console.log('  shot', i + 1);
    }, 200 + i * 250);
  }
}, 1500);

setTimeout(() => {
  console.log('placing wall');
  room.send('place_build', { type: 'wall', gx: 2, gy: 0, gz: 0, face: 'N', rampDir: '' });
}, 800);

setTimeout(() => {
  console.log('damaging wall');
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      room.send('damage_build', { buildId: 'wall:2,0,0:N', damage: 50, weapon: 'pickaxe' });
    }, 100 + i * 200);
  }
}, 1200);

const totalDuration = parseInt(process.argv[2] ?? '8000', 10);
setTimeout(() => {
  clearInterval(heartbeat);
  room.leave();
  console.log(`done after ${totalDuration}ms`);
  process.exit(0);
}, totalDuration);
