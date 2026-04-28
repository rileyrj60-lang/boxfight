import { Client, Room } from 'colyseus';
import { MAX_CLIENTS, PATCH_RATE_MS, SPAWN_RANGE, WINS_REQUIRED } from '@boxfight/shared/constants';
import { ArenaState } from '../schema/ArenaState';
import { BuildPieceState } from '../schema/BuildPieceState';
import { PlayerState } from '../schema/PlayerState';

type InputPayload = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  vy: number;
  grounded: boolean;
};

type Vec3 = { x: number; y: number; z: number };

type ShootPayload = {
  targetSessionId: string | null;
  hitBuildId: string | null;
  damage: number;
  weapon: 'rifle' | 'sniper' | 'pickaxe';
  origin: Vec3;
  dir: Vec3;
};

type PlaceBuildPayload = {
  type: 'wall' | 'ramp' | 'floor' | 'roof';
  gx: number;
  gy: number;
  gz: number;
  face: '' | 'N' | 'S' | 'E' | 'W';
  rampDir: '' | 'N' | 'S' | 'E' | 'W';
};

type DamageBuildPayload = {
  buildId: string;
  damage: number;
  weapon: 'rifle' | 'sniper' | 'pickaxe';
};

const RESPAWN_DELAY_MS = 3000;
const BUILD_HP = 150;
const CELL_SIZE = 4;

const MAX_PLAYER_DAMAGE: Record<ShootPayload['weapon'], number> = {
  rifle: 25,
  sniper: 110,
  pickaxe: 20
};

const MAX_BUILD_DAMAGE: Record<DamageBuildPayload['weapon'], number> = {
  rifle: 12,
  sniper: 60,
  pickaxe: 50
};

function buildKey(type: string, gx: number, gy: number, gz: number, face: string): string {
  return `${type}:${gx},${gy},${gz}:${face}`;
}

function aabbForBuild(build: PlaceBuildPayload): { min: Vec3; max: Vec3 } {
  const cx = build.gx * CELL_SIZE;
  const cy = build.gy * CELL_SIZE;
  const cz = build.gz * CELL_SIZE;

  if (build.type === 'wall') {
    if (build.face === 'E') {
      return { min: { x: cx + CELL_SIZE / 2 - 0.1, y: cy, z: cz - CELL_SIZE / 2 }, max: { x: cx + CELL_SIZE / 2 + 0.1, y: cy + CELL_SIZE, z: cz + CELL_SIZE / 2 } };
    }
    if (build.face === 'W') {
      return { min: { x: cx - CELL_SIZE / 2 - 0.1, y: cy, z: cz - CELL_SIZE / 2 }, max: { x: cx - CELL_SIZE / 2 + 0.1, y: cy + CELL_SIZE, z: cz + CELL_SIZE / 2 } };
    }
    if (build.face === 'N') {
      return { min: { x: cx - CELL_SIZE / 2, y: cy, z: cz - CELL_SIZE / 2 - 0.1 }, max: { x: cx + CELL_SIZE / 2, y: cy + CELL_SIZE, z: cz - CELL_SIZE / 2 + 0.1 } };
    }
    return { min: { x: cx - CELL_SIZE / 2, y: cy, z: cz + CELL_SIZE / 2 - 0.1 }, max: { x: cx + CELL_SIZE / 2, y: cy + CELL_SIZE, z: cz + CELL_SIZE / 2 + 0.1 } };
  }

  if (build.type === 'floor') {
    return { min: { x: cx - 2, y: cy - 0.1, z: cz - 2 }, max: { x: cx + 2, y: cy + 0.1, z: cz + 2 } };
  }

  if (build.type === 'roof') {
    return { min: { x: cx - 2, y: cy, z: cz - 2 }, max: { x: cx + 2, y: cy + 2.25, z: cz + 2 } };
  }

  return { min: { x: cx - 2, y: cy, z: cz - 2 }, max: { x: cx + 2, y: cy + 4, z: cz + 2 } };
}

function playerAABB(player: PlayerState): { min: Vec3; max: Vec3 } {
  return {
    min: { x: player.x - 0.5, y: player.y, z: player.z - 0.5 },
    max: { x: player.x + 0.5, y: player.y + 1.7, z: player.z + 0.5 }
  };
}

function aabbIntersects(a: { min: Vec3; max: Vec3 }, b: { min: Vec3; max: Vec3 }): boolean {
  return (
    a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.z < b.max.z && a.max.z > b.min.z
  );
}

export class ArenaRoom extends Room<ArenaState> {
  public maxClients = MAX_CLIENTS;
  public autoDispose = true;
  public state = new ArenaState();
  private respawnTimers = new Map<string, NodeJS.Timeout>();
  private rematchRequests = new Set<string>();
  private privateRoom = false;

  public onCreate(options: { roomName?: string; private?: boolean } = {}): void {
    this.setPatchRate(PATCH_RATE_MS);
    this.privateRoom = options.private === true;
    this.setMetadata({ roomName: options.roomName ?? 'default' });
    this.state.matchState = 'waiting';
    this.state.winsRequired = WINS_REQUIRED;

    this.onMessage<InputPayload>('input', (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !payload || !player.alive) {
        return;
      }

      if (typeof payload.x === 'number') player.x = payload.x;
      if (typeof payload.y === 'number') player.y = payload.y;
      if (typeof payload.z === 'number') player.z = payload.z;
      if (typeof payload.rx === 'number') player.rx = payload.rx;
      if (typeof payload.ry === 'number') player.ry = payload.ry;
      if (typeof payload.vy === 'number') player.vy = payload.vy;
      if (typeof payload.grounded === 'boolean') player.grounded = payload.grounded;
    });

    this.onMessage<ShootPayload>('shoot', (client, payload) => {
      this.handleShoot(client, payload);
    });

    this.onMessage<PlaceBuildPayload>('place_build', (client, payload) => {
      this.handlePlaceBuild(client, payload);
    });

    this.onMessage<DamageBuildPayload>('damage_build', (client, payload) => {
      this.handleDamageBuild(client, payload);
    });

    this.onMessage('rematch_request', (client) => {
      this.handleRematchRequest(client);
    });

    this.setSimulationInterval(() => {
      this.state.tick++;
    }, 1000);
  }

  public onJoin(client: Client, options: { name?: string } = {}): void {
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    const supplied = typeof options.name === 'string' ? options.name.trim().slice(0, 20) : '';
    player.name = supplied || `Player${Math.floor(1000 + Math.random() * 9000)}`;
    this.placeAtSpawn(player);
    this.state.players.set(client.sessionId, player);

    if (this.state.players.size === this.maxClients && this.state.matchState === 'waiting') {
      this.startMatch();
    }

    console.log(`[ArenaRoom ${this.roomId}] join ${client.sessionId} (${player.name}) — ${this.state.players.size}/${this.maxClients}`);
  }

  public onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.rematchRequests.delete(client.sessionId);
    const timer = this.respawnTimers.get(client.sessionId);
    if (timer) {
      clearTimeout(timer);
      this.respawnTimers.delete(client.sessionId);
    }

    if (this.state.matchState === 'ended') {
      const remaining = [...this.state.players.keys()];
      if (remaining.length === 1) {
        this.broadcast('rematch_failed', { reason: 'opponent_left' });
      }
    }

    if (this.state.matchState === 'playing' && this.state.players.size < this.maxClients) {
      this.state.matchState = 'waiting';
    }

    console.log(`[ArenaRoom ${this.roomId}] leave ${client.sessionId} — ${this.state.players.size}/${this.maxClients}`);
  }

  public onDispose(): void {
    for (const timer of this.respawnTimers.values()) {
      clearTimeout(timer);
    }
    this.respawnTimers.clear();
    console.log(`[ArenaRoom ${this.roomId}] disposed`);
  }

  private handleShoot(client: Client, payload: ShootPayload | undefined): void {
    if (!payload) return;
    if (this.state.matchState !== 'playing') return;
    const shooter = this.state.players.get(client.sessionId);
    if (!shooter || !shooter.alive) return;

    const weapon = payload.weapon;
    const maxDamage = MAX_PLAYER_DAMAGE[weapon];
    if (typeof maxDamage !== 'number') return;
    const damage = Math.max(0, Math.min(payload.damage, maxDamage));
    if (damage <= 0) return;

    if (payload.targetSessionId) {
      const victim = this.state.players.get(payload.targetSessionId);
      if (!victim || !victim.alive || victim.sessionId === shooter.sessionId) return;

      victim.hp = Math.max(0, victim.hp - damage);
      if (victim.hp <= 0) {
        this.killPlayer(victim, shooter, weapon);
      }
      return;
    }

    if (payload.hitBuildId) {
      this.applyBuildDamage(payload.hitBuildId, Math.min(damage, MAX_BUILD_DAMAGE[weapon] ?? damage));
    }
  }

  private handlePlaceBuild(client: Client, payload: PlaceBuildPayload | undefined): void {
    if (!payload) return;
    if (this.state.matchState !== 'playing') return;
    const placer = this.state.players.get(client.sessionId);
    if (!placer || !placer.alive) return;

    const validTypes = new Set(['wall', 'ramp', 'floor', 'roof']);
    if (!validTypes.has(payload.type)) return;

    const face = payload.type === 'wall' ? payload.face : '';
    const id = buildKey(payload.type, payload.gx, payload.gy, payload.gz, face);

    if (this.state.builds.has(id)) {
      client.send('place_rejected', { id, reason: 'occupied' });
      return;
    }

    const candidate = aabbForBuild({ ...payload, face });
    for (const other of this.state.players.values()) {
      if (!other.alive) continue;
      if (aabbIntersects(candidate, playerAABB(other))) {
        client.send('place_rejected', { id, reason: 'blocked' });
        return;
      }
    }

    const piece = new BuildPieceState();
    piece.id = id;
    piece.buildType = payload.type;
    piece.gx = payload.gx;
    piece.gy = payload.gy;
    piece.gz = payload.gz;
    piece.face = face;
    piece.rampDir = payload.type === 'ramp' || payload.type === 'roof' ? payload.rampDir : '';
    piece.hp = BUILD_HP;
    piece.ownerId = client.sessionId;
    this.state.builds.set(id, piece);
  }

  private handleDamageBuild(client: Client, payload: DamageBuildPayload | undefined): void {
    if (!payload) return;
    if (this.state.matchState !== 'playing') return;
    const shooter = this.state.players.get(client.sessionId);
    if (!shooter || !shooter.alive) return;

    const max = MAX_BUILD_DAMAGE[payload.weapon];
    if (typeof max !== 'number') return;
    const damage = Math.max(0, Math.min(payload.damage, max));
    if (damage <= 0) return;
    this.applyBuildDamage(payload.buildId, damage);
  }

  private applyBuildDamage(buildId: string, damage: number): void {
    const piece = this.state.builds.get(buildId);
    if (!piece) return;
    piece.hp = Math.max(0, piece.hp - damage);
    if (piece.hp <= 0) {
      this.state.builds.delete(buildId);
    }
  }

  private killPlayer(victim: PlayerState, killer: PlayerState, weapon: ShootPayload['weapon']): void {
    victim.alive = false;
    victim.hp = 0;
    if (killer.sessionId !== victim.sessionId) {
      killer.kills += 1;
    }

    this.broadcast('killed', {
      victimId: victim.sessionId,
      victimName: victim.name,
      killerId: killer.sessionId,
      killerName: killer.name,
      weapon
    });

    if (killer.kills >= this.state.winsRequired && killer.sessionId !== victim.sessionId) {
      this.endMatch(killer);
      return;
    }

    const previousTimer = this.respawnTimers.get(victim.sessionId);
    if (previousTimer) clearTimeout(previousTimer);

    const timer = setTimeout(() => {
      this.respawnTimers.delete(victim.sessionId);
      if (this.state.matchState !== 'playing') return;
      const stillHere = this.state.players.get(victim.sessionId);
      if (!stillHere) return;
      this.placeAtSpawn(stillHere);
      stillHere.hp = 100;
      stillHere.alive = true;
    }, RESPAWN_DELAY_MS);
    this.respawnTimers.set(victim.sessionId, timer);
  }

  private startMatch(): void {
    this.state.matchState = 'playing';
    this.state.winnerId = '';
    this.rematchRequests.clear();
    for (const player of this.state.players.values()) {
      player.kills = 0;
      player.hp = 100;
      player.alive = true;
      this.placeAtSpawn(player);
    }
    this.state.builds.clear();
    for (const timer of this.respawnTimers.values()) {
      clearTimeout(timer);
    }
    this.respawnTimers.clear();
    this.broadcast('match_start', {});
  }

  private endMatch(winner: PlayerState): void {
    this.state.matchState = 'ended';
    this.state.winnerId = winner.sessionId;
    for (const timer of this.respawnTimers.values()) {
      clearTimeout(timer);
    }
    this.respawnTimers.clear();
    this.rematchRequests.clear();

    const finalScore: Record<string, number> = {};
    for (const [sid, p] of this.state.players.entries()) {
      finalScore[sid] = p.kills;
    }

    this.broadcast('match_end', {
      winnerId: winner.sessionId,
      winnerName: winner.name,
      finalScore
    });
  }

  private handleRematchRequest(client: Client): void {
    if (this.state.matchState !== 'ended') return;
    if (!this.state.players.has(client.sessionId)) return;
    this.rematchRequests.add(client.sessionId);

    this.broadcast('rematch_status', {
      requested: [...this.rematchRequests]
    });

    if (this.state.players.size === this.maxClients &&
        this.rematchRequests.size === this.maxClients) {
      this.startMatch();
      this.broadcast('rematch_start', {});
    }
  }

  private placeAtSpawn(player: PlayerState): void {
    player.x = (Math.random() * 2 - 1) * SPAWN_RANGE;
    player.y = 0;
    player.z = (Math.random() * 2 - 1) * SPAWN_RANGE;
    player.vy = 0;
    player.grounded = true;
  }
}
