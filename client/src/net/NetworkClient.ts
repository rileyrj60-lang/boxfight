import { Client, Room, getStateCallbacks } from 'colyseus.js';
import {
  INPUT_INTERVAL_MS,
  LOBBY_ROOM_NAME,
  ROOM_NAME,
  SERVER_PORT
} from '@boxfight/shared/constants';

export type WeaponName = 'rifle' | 'sniper' | 'pickaxe';
export type MatchState = 'waiting' | 'playing' | 'ended';

export type NetworkInputState = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  vy: number;
  grounded: boolean;
};

type Vec3 = { x: number; y: number; z: number };

type RemotePlayerSchema = {
  sessionId: string;
  name: string;
  x: number; y: number; z: number;
  rx: number; ry: number; vy: number;
  grounded: boolean;
  hp: number;
  alive: boolean;
  kills: number;
};

type RemoteBuildSchema = {
  id: string;
  buildType: string;
  gx: number; gy: number; gz: number;
  face: string;
  rampDir: string;
  hp: number;
  ownerId: string;
};

export type RemotePlayerSnapshot = {
  sessionId: string;
  name: string;
  x: number; y: number; z: number;
  rx: number; ry: number; vy: number;
  grounded: boolean;
  hp: number;
  alive: boolean;
  kills: number;
};

export type RemoteBuildSnapshot = {
  id: string;
  type: 'wall' | 'ramp' | 'floor' | 'roof';
  gx: number; gy: number; gz: number;
  face: '' | 'N' | 'S' | 'E' | 'W';
  rampDir: '' | 'N' | 'S' | 'E' | 'W';
  hp: number;
  ownerId: string;
};

export type KillEvent = {
  victimId: string; victimName: string;
  killerId: string; killerName: string;
  weapon: WeaponName;
};

export type MatchEndEvent = {
  winnerId: string;
  winnerName: string;
  finalScore: Record<string, number>;
};

export type NetworkPhase = 'idle' | 'lobby' | 'arena' | 'error';

export type NetworkStatus = {
  phase: NetworkPhase;
  selfId: string;
  occupancy: number;
  maxClients: number;
  queueSize: number;
  matchState: MatchState;
  error?: string;
};

export type NetworkEvents = {
  onPlayerJoin: (snapshot: RemotePlayerSnapshot) => void;
  onPlayerLeave: (sessionId: string) => void;
  onPlayerStateUpdate: (snapshot: RemotePlayerSnapshot) => void;
  onSelfStateUpdate: (snapshot: RemotePlayerSnapshot) => void;
  onBuildAdd: (snapshot: RemoteBuildSnapshot) => void;
  onBuildUpdate: (snapshot: RemoteBuildSnapshot) => void;
  onBuildRemove: (id: string) => void;
  onKilled: (event: KillEvent) => void;
  onPlaceRejected: (info: { id: string; reason: string }) => void;
  onMatchStart: () => void;
  onMatchEnd: (event: MatchEndEvent) => void;
  onRematchStart: () => void;
  onRematchFailed: (info: { reason: string }) => void;
  onRematchStatus: (info: { requested: string[] }) => void;
  onMatchStateChange: (state: MatchState) => void;
  onScoreChange: (scores: Record<string, number>) => void;
  onStatusChange: (status: NetworkStatus) => void;
};

export type ShootMessage = {
  targetSessionId: string | null;
  hitBuildId: string | null;
  damage: number;
  weapon: WeaponName;
  origin: Vec3;
  dir: Vec3;
};

export type PlaceBuildMessage = {
  type: 'wall' | 'ramp' | 'floor' | 'roof';
  gx: number; gy: number; gz: number;
  face: '' | 'N' | 'S' | 'E' | 'W';
  rampDir: '' | 'N' | 'S' | 'E' | 'W';
};

export type DamageBuildMessage = {
  buildId: string;
  damage: number;
  weapon: WeaponName;
};

function resolveDefaultHost(): string {
  const envUrl = (import.meta as unknown as { env?: { VITE_SERVER_URL?: string } }).env?.VITE_SERVER_URL;
  if (envUrl && envUrl.length > 0) return envUrl;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.hostname}:${SERVER_PORT}`;
  }
  return `ws://localhost:${SERVER_PORT}`;
}

const DEFAULT_HOST = resolveDefaultHost();

export class NetworkClient {
  private readonly client: Client;
  private lobby?: Room;
  private arena?: Room;
  private inputTimer = 0;
  private events: Partial<NetworkEvents> = {};
  private status: NetworkStatus = {
    phase: 'idle',
    selfId: '',
    occupancy: 0,
    maxClients: 2,
    queueSize: 0,
    matchState: 'waiting'
  };
  private playerScores: Record<string, number> = {};

  public constructor(endpoint: string = DEFAULT_HOST) {
    this.client = new Client(endpoint);
  }

  public on<K extends keyof NetworkEvents>(event: K, handler: NetworkEvents[K]): void {
    this.events[event] = handler;
  }

  public getStatus(): NetworkStatus {
    return this.status;
  }

  public getSelfId(): string {
    return this.status.selfId;
  }

  public isInArena(): boolean {
    return this.status.phase === 'arena' && !!this.arena;
  }

  public async enterLobby(name: string): Promise<void> {
    if (this.lobby) {
      this.lobby.send('queue', { name });
      return;
    }
    try {
      const lobby = await this.client.joinOrCreate<Record<string, unknown>>(LOBBY_ROOM_NAME);
      this.lobby = lobby;
      this.status = { ...this.status, phase: 'lobby' };
      this.emitStatus();

      const $ = getStateCallbacks(lobby) as unknown as (s: unknown) => {
        listen: (prop: string, cb: (v: unknown) => void) => void;
      };
      const stateCb = $(lobby.state);
      stateCb.listen('queueSize', (value: unknown) => {
        if (typeof value === 'number') {
          this.status = { ...this.status, queueSize: value };
          this.emitStatus();
        }
      });

      lobby.onMessage<{ roomId: string; name: string }>('match_found', async (msg) => {
        await this.joinArena(msg.roomId, msg.name);
      });

      lobby.onMessage('match_failed', () => {
        this.status = { ...this.status, error: 'match_failed' };
        this.emitStatus();
      });

      lobby.onLeave(() => {
        this.lobby = undefined;
        if (this.status.phase === 'lobby') {
          this.status = { ...this.status, phase: 'idle' };
          this.emitStatus();
        }
      });

      lobby.send('queue', { name });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.status = { ...this.status, phase: 'error', error: message };
      this.emitStatus();
      console.error('[net] lobby join failed:', err);
    }
  }

  public cancelQueue(): void {
    this.lobby?.send('cancel_queue');
    if (this.lobby) {
      void this.lobby.leave();
    }
    this.lobby = undefined;
    this.status = { ...this.status, phase: 'idle', queueSize: 0 };
    this.emitStatus();
  }

  public async joinPrivateRoom(roomName: string, name: string): Promise<void> {
    try {
      const arena = await this.client.joinOrCreate<Record<string, unknown>>(ROOM_NAME, { roomName, name });
      this.attachArena(arena);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.status = { ...this.status, phase: 'error', error: message };
      this.emitStatus();
      console.error('[net] private join failed:', err);
    }
  }

  private async joinArena(roomId: string, name: string): Promise<void> {
    try {
      if (this.lobby) {
        await this.lobby.leave();
        this.lobby = undefined;
      }
      const arena = await this.client.joinById<Record<string, unknown>>(roomId, { name });
      this.attachArena(arena);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.status = { ...this.status, phase: 'error', error: message };
      this.emitStatus();
      console.error('[net] arena join failed:', err);
    }
  }

  public sendInput(deltaSeconds: number, state: NetworkInputState): void {
    if (!this.arena) return;
    this.inputTimer += deltaSeconds * 1000;
    if (this.inputTimer < INPUT_INTERVAL_MS) return;
    this.inputTimer = 0;
    this.arena.send('input', state);
  }

  public sendShoot(message: ShootMessage): void {
    this.arena?.send('shoot', message);
  }

  public sendPlaceBuild(message: PlaceBuildMessage): void {
    this.arena?.send('place_build', message);
  }

  public sendDamageBuild(message: DamageBuildMessage): void {
    this.arena?.send('damage_build', message);
  }

  public sendRematchRequest(): void {
    this.arena?.send('rematch_request');
  }

  public leaveArena(): void {
    if (this.arena) {
      void this.arena.leave();
      this.arena = undefined;
    }
    this.status = {
      ...this.status,
      phase: 'idle',
      selfId: '',
      occupancy: 0,
      matchState: 'waiting'
    };
    this.playerScores = {};
    this.emitStatus();
  }

  private attachArena(arena: Room): void {
    this.arena = arena;
    this.status = {
      ...this.status,
      phase: 'arena',
      selfId: arena.sessionId,
      occupancy: 0,
      matchState: 'waiting',
      error: undefined
    };
    this.playerScores = {};
    this.emitStatus();

    const $ = getStateCallbacks(arena) as unknown as ((state: unknown) => {
      players: {
        onAdd: (cb: (player: RemotePlayerSchema, key: string) => void) => void;
        onRemove: (cb: (player: RemotePlayerSchema, key: string) => void) => void;
      };
      builds: {
        onAdd: (cb: (build: RemoteBuildSchema, key: string) => void) => void;
        onRemove: (cb: (build: RemoteBuildSchema, key: string) => void) => void;
      };
      listen: (prop: string, cb: (v: unknown) => void) => void;
    });

    const cb = $(arena.state);

    cb.listen('matchState', (value: unknown) => {
      if (typeof value === 'string') {
        const next = value as MatchState;
        this.status = { ...this.status, matchState: next };
        this.emitStatus();
        this.events.onMatchStateChange?.(next);
      }
    });

    cb.players.onAdd((player: RemotePlayerSchema, key: string) => {
      const snapshot = this.playerSnapshot(player, key);
      this.status = { ...this.status, occupancy: this.status.occupancy + 1 };
      this.emitStatus();

      this.playerScores[key] = snapshot.kills;
      this.events.onScoreChange?.({ ...this.playerScores });

      const isSelf = key === arena.sessionId;
      if (!isSelf) {
        this.events.onPlayerJoin?.(snapshot);
      }

      const playerCb = ($ as unknown as (s: unknown) => { onChange: (cb: () => void) => void })(player);
      playerCb.onChange(() => {
        const next = this.playerSnapshot(player, key);
        if (this.playerScores[key] !== next.kills) {
          this.playerScores[key] = next.kills;
          this.events.onScoreChange?.({ ...this.playerScores });
        }
        if (isSelf) {
          this.events.onSelfStateUpdate?.(next);
        } else {
          this.events.onPlayerStateUpdate?.(next);
        }
      });
    });

    cb.players.onRemove((_player: RemotePlayerSchema, key: string) => {
      this.status = { ...this.status, occupancy: Math.max(0, this.status.occupancy - 1) };
      this.emitStatus();
      delete this.playerScores[key];
      this.events.onScoreChange?.({ ...this.playerScores });
      if (key === arena.sessionId) return;
      this.events.onPlayerLeave?.(key);
    });

    cb.builds.onAdd((build: RemoteBuildSchema, key: string) => {
      this.events.onBuildAdd?.(this.buildSnapshot(build, key));
      const buildCb = ($ as unknown as (s: unknown) => { onChange: (cb: () => void) => void })(build);
      buildCb.onChange(() => {
        this.events.onBuildUpdate?.(this.buildSnapshot(build, key));
      });
    });

    cb.builds.onRemove((_build: RemoteBuildSchema, key: string) => {
      this.events.onBuildRemove?.(key);
    });

    arena.onMessage<KillEvent>('killed', (msg) => {
      this.events.onKilled?.(msg);
    });

    arena.onMessage<{ id: string; reason: string }>('place_rejected', (msg) => {
      this.events.onPlaceRejected?.(msg);
    });

    arena.onMessage('match_start', () => {
      this.events.onMatchStart?.();
    });

    arena.onMessage<MatchEndEvent>('match_end', (msg) => {
      this.events.onMatchEnd?.(msg);
    });

    arena.onMessage('rematch_start', () => {
      this.events.onRematchStart?.();
    });

    arena.onMessage<{ reason: string }>('rematch_failed', (msg) => {
      this.events.onRematchFailed?.(msg);
    });

    arena.onMessage<{ requested: string[] }>('rematch_status', (msg) => {
      this.events.onRematchStatus?.(msg);
    });

    arena.onLeave(() => {
      if (this.arena === arena) {
        this.arena = undefined;
        this.status = { ...this.status, phase: 'idle', selfId: '', occupancy: 0, matchState: 'waiting' };
        this.playerScores = {};
        this.emitStatus();
      }
    });

    arena.onError((code, message) => {
      console.error('[net] arena error', code, message);
    });
  }

  private playerSnapshot(player: RemotePlayerSchema, key: string): RemotePlayerSnapshot {
    return {
      sessionId: key,
      name: player.name ?? key,
      x: player.x ?? 0,
      y: player.y ?? 0,
      z: player.z ?? 0,
      rx: player.rx ?? 0,
      ry: player.ry ?? 0,
      vy: player.vy ?? 0,
      grounded: player.grounded ?? true,
      hp: player.hp ?? 100,
      alive: player.alive ?? true,
      kills: player.kills ?? 0
    };
  }

  private buildSnapshot(build: RemoteBuildSchema, key: string): RemoteBuildSnapshot {
    return {
      id: key,
      type: (build.buildType ?? 'wall') as RemoteBuildSnapshot['type'],
      gx: build.gx ?? 0,
      gy: build.gy ?? 0,
      gz: build.gz ?? 0,
      face: (build.face ?? '') as RemoteBuildSnapshot['face'],
      rampDir: (build.rampDir ?? '') as RemoteBuildSnapshot['rampDir'],
      hp: build.hp ?? 0,
      ownerId: build.ownerId ?? ''
    };
  }

  private emitStatus(): void {
    this.events.onStatusChange?.(this.status);
  }
}
