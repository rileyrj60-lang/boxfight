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

const heartbeat = setInterval(() => {
  room.send('input', { x: 0, y: 0, z: 0, rx: 0, ry: 0, vy: 0, grounded: true });
}, 50);

await new Promise(r => setTimeout(r, 1500));
if (!target) { console.log('no target'); process.exit(0); }

console.log('shot 1 (HP -> 75)');
room.send('shoot', { targetSessionId: target, hitBuildId: null, damage: 25, weapon: 'rifle', origin: {x:0,y:1.7,z:0}, dir: {x:1,y:0,z:0}});
await new Promise(r => setTimeout(r, 1500));

console.log('shot 2 (HP -> 50)');
room.send('shoot', { targetSessionId: target, hitBuildId: null, damage: 25, weapon: 'rifle', origin: {x:0,y:1.7,z:0}, dir: {x:1,y:0,z:0}});
await new Promise(r => setTimeout(r, 1500));

console.log('shot 3 (HP -> 25)');
room.send('shoot', { targetSessionId: target, hitBuildId: null, damage: 25, weapon: 'rifle', origin: {x:0,y:1.7,z:0}, dir: {x:1,y:0,z:0}});
await new Promise(r => setTimeout(r, 1500));

console.log('shot 4 (HP -> 0, kill)');
room.send('shoot', { targetSessionId: target, hitBuildId: null, damage: 25, weapon: 'rifle', origin: {x:0,y:1.7,z:0}, dir: {x:1,y:0,z:0}});
await new Promise(r => setTimeout(r, 5000));

console.log('done');
clearInterval(heartbeat);
room.leave();
process.exit(0);
