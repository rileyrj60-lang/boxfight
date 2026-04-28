import { Client, Room, matchMaker } from 'colyseus';
import { ROOM_NAME } from '@boxfight/shared/constants';
import { LobbyState } from '../schema/LobbyState';

type QueueEntry = {
  sessionId: string;
  name: string;
  client: Client;
};

export class LobbyRoom extends Room<LobbyState> {
  public maxClients = 1024;
  public autoDispose = false;
  public state = new LobbyState();
  private queue: QueueEntry[] = [];
  private matched = new Set<string>();

  public onCreate(): void {
    this.setPatchRate(200);
    this.setMetadata({ kind: 'lobby' });

    this.onMessage<{ name?: string }>('queue', (client, payload) => {
      if (this.matched.has(client.sessionId)) return;
      if (this.queue.some((e) => e.sessionId === client.sessionId)) return;
      const name = (payload?.name ?? '').toString().trim().slice(0, 20) ||
        `Player${Math.floor(1000 + Math.random() * 9000)}`;
      this.queue.push({ sessionId: client.sessionId, name, client });
      this.refreshState();
      console.log(`[LobbyRoom] queue add ${client.sessionId} (${name}) — ${this.queue.length} waiting`);
    });

    this.onMessage('cancel_queue', (client) => {
      this.removeFromQueue(client.sessionId);
    });

    this.setSimulationInterval(() => {
      void this.tryMatch();
    }, 1000);
  }

  public onLeave(client: Client): void {
    this.removeFromQueue(client.sessionId);
    this.matched.delete(client.sessionId);
  }

  public onDispose(): void {
    console.log('[LobbyRoom] disposed');
  }

  private removeFromQueue(sessionId: string): void {
    const next = this.queue.filter((e) => e.sessionId !== sessionId);
    if (next.length !== this.queue.length) {
      this.queue = next;
      this.refreshState();
      console.log(`[LobbyRoom] queue remove ${sessionId} — ${this.queue.length} waiting`);
    }
  }

  private async tryMatch(): Promise<void> {
    while (this.queue.length >= 2) {
      const a = this.queue.shift()!;
      const b = this.queue.shift()!;

      try {
        const reservation = await matchMaker.createRoom(ROOM_NAME, { roomName: 'matchmade' });
        const roomId = reservation.roomId;
        this.matched.add(a.sessionId);
        this.matched.add(b.sessionId);
        a.client.send('match_found', { roomId, name: a.name });
        b.client.send('match_found', { roomId, name: b.name });
        console.log(`[LobbyRoom] matched ${a.sessionId} + ${b.sessionId} -> ${roomId}`);
      } catch (err) {
        console.error('[LobbyRoom] match creation failed:', err);
        a.client.send('match_failed', { reason: 'create_failed' });
        b.client.send('match_failed', { reason: 'create_failed' });
      }
      this.refreshState();
    }
  }

  private refreshState(): void {
    this.state.queueSize = this.queue.length;
  }
}
