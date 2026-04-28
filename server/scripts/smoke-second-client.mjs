import { Client } from 'colyseus.js';

const room = await new Client('ws://localhost:2567').joinOrCreate('arena', { roomName: 'test' });
console.log('joined:', room.roomId, 'as', room.sessionId);

let tick = 0;
const interval = setInterval(() => {
  tick++;
  room.send('input', {
    x: Math.cos(tick / 10) * 4,
    y: 0,
    z: Math.sin(tick / 10) * 4,
    rx: 0,
    ry: tick / 10,
    vy: 0,
    grounded: true
  });
}, 50);

const duration = parseInt(process.argv[2] ?? '5000', 10);
setTimeout(() => {
  clearInterval(interval);
  room.leave();
  console.log(`left after ${duration}ms`);
  process.exit(0);
}, duration);
