import { createServer } from 'http';
import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { LOBBY_ROOM_NAME, ROOM_NAME, SERVER_PORT } from '@boxfight/shared/constants';
import { ArenaRoom } from './rooms/ArenaRoom';
import { LobbyRoom } from './rooms/LobbyRoom';

const port = Number(process.env.PORT ?? SERVER_PORT);

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(404).end();
    return;
  }
  if (req.method === 'GET' && req.url.startsWith('/stats')) {
    try {
      const rooms = await matchMaker.query({});
      const online = rooms.reduce((sum, r) => sum + (r.clients ?? 0), 0);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ online, rooms: rooms.length }));
    } catch (err) {
      res.writeHead(500).end(JSON.stringify({ error: String(err) }));
    }
    return;
  }
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('boxfight server ok');
    return;
  }
  res.writeHead(404).end();
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer })
});

gameServer.define(LOBBY_ROOM_NAME, LobbyRoom).filterBy([]);
gameServer.define(ROOM_NAME, ArenaRoom).filterBy(['roomName']);

gameServer.listen(port).then(() => {
  console.log(`[colyseus] listening on :${port}`);
}).catch((err) => {
  console.error('[colyseus] failed to start:', err);
  process.exit(1);
});
