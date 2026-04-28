import {
  ACESFilmicToneMapping,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer
} from 'three';
import { BuildGrid } from './build/BuildGrid';
import { BuildManager } from './build/BuildManager';
import { HUD } from './HUD';
import { InputManager } from './InputManager';
import { Pickaxe } from './Pickaxe';
import { Player } from './Player';
import { Rifle } from './Rifle';
import { createScene } from './Scene';
import { Sniper } from './Sniper';
import type { Weapon } from './Weapon';
import { WeaponManager } from './WeaponManager';
import { WeaponViewModel } from './WeaponViewModel';
import { CombatNet } from './net/CombatNet';
import { NetworkClient } from './net/NetworkClient';
import { RemotePlayer } from './net/RemotePlayer';
import { LandingScreen } from './ui/LandingScreen';
import { QueueScreen } from './ui/QueueScreen';
import { MatchEndScreen } from './ui/MatchEndScreen';
import { ScreenManager } from './ui/ScreenManager';
import { AudioManager } from './audio/AudioManager';
import { DamageNumbers } from './fx/DamageNumbers';
import { ScreenShake } from './fx/ScreenShake';

const VERSION = '0.1.0';
const TUTORIAL_KEY = 'boxfight:seen-tutorial-v1';
const DEFAULT_FOV = 75;
const SPRINT_FOV = 80;

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app element.');
}

const world = createScene();
const { scene } = world;
const camera = new PerspectiveCamera(DEFAULT_FOV, window.innerWidth / window.innerHeight, 0.1, 1000);
scene.add(camera);
const renderer = new WebGLRenderer({ antialias: true });

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.domElement.id = 'game-canvas';
renderer.domElement.tabIndex = 0;
renderer.domElement.style.display = 'none';
app.appendChild(renderer.domElement);

const input = new InputManager(renderer, camera);
const player = new Player(camera, input);
const buildGrid = new BuildGrid();
const buildManager = new BuildManager(scene, player.getCamera(), input, player, buildGrid);
const audio = new AudioManager();
const damageNumbers = new DamageNumbers(scene);
const shake = new ScreenShake();

const remotes = new Map<string, RemotePlayer>();
const network = new NetworkClient();
const combatNet = new CombatNet(network, remotes);

const rifle = new Rifle(scene, player.getCamera(), input, buildManager, combatNet, world.raycastObjects);
const sniper = new Sniper(scene, player.getCamera(), input, buildManager, combatNet, world.raycastObjects);
const pickaxe = new Pickaxe(player.getCamera(), input, buildManager, combatNet);
const weaponManager = new WeaponManager(input, new Map<1 | 2 | 3, Weapon>([
  [1, rifle],
  [2, sniper],
  [3, pickaxe]
]));
const weaponViewModel = new WeaponViewModel(camera);
const hud = new HUD(app);

const screenManager = new ScreenManager();
screenManager.setCanvas(renderer.domElement);
screenManager.injectStyles();

const landing = new LandingScreen({
  onPlay: (name) => {
    landing.setStatus('Connecting…');
    void network.enterLobby(name);
  },
  onVolumeChange: (v) => audio.setVolume(v)
}, audio.getVolume(), VERSION);
const queueScreen = new QueueScreen({
  onCancel: () => {
    network.cancelQueue();
    screenManager.show('landing');
  }
});
const matchEnd = new MatchEndScreen({
  onRematch: () => network.sendRematchRequest(),
  onLeave: () => {
    network.leaveArena();
    backToLanding('');
  }
});

app.append(landing.element, queueScreen.element, matchEnd.element);
screenManager.register('landing', landing.element);
screenManager.register('queue', queueScreen.element);
screenManager.register('match_end', matchEnd.element);
screenManager.show('landing');
hud.setVisible(false);

const originalShow = screenManager.show.bind(screenManager);
screenManager.show = (name) => {
  originalShow(name);
  hud.setVisible(name === 'in_game' || name === 'match_end');
  document.body.classList.toggle('in-match', name === 'in_game');
  hud.setPlayHint(name === 'in_game' && !input.isPointerLocked);
};

let eliminatedUntil = 0;
let lastScores: Record<string, number> = {};
let lastNames: Record<string, string> = {};
let lastSelfHp = 100;
let pendingFireShake = 0;

player.onLanding = (fall) => {
  shake.add(Math.min(2, fall * 0.4), 0.12);
};

weaponManager.onSwap = () => {
  // suppression handled in WeaponManager; nothing else needed here
};

buildManager.onPlaceRequest = (placement) => {
  if (network.getStatus().matchState !== 'playing') return;
  network.sendPlaceBuild({
    type: placement.type,
    gx: placement.cell.x,
    gy: placement.cell.y,
    gz: placement.cell.z,
    face: placement.face as '' | 'N' | 'S' | 'E' | 'W',
    rampDir: (placement.rampDirection ?? placement.roofDirection ?? '') as '' | 'N' | 'S' | 'E' | 'W'
  });
};

buildManager.onBuildPlaced = () => {
  audio.play('buildPlace');
};

buildManager.onBuildBreak = () => {
  audio.play('buildBreak');
};

rifle.audio = audio;
sniper.audio = audio;
pickaxe.audio = audio;
rifle.onShoot = () => { pendingFireShake = 1; };
sniper.onShoot = () => { pendingFireShake = 2; };

input.onReload = () => {
  if (weaponManager.getSelectedSlot() === 1 || weaponManager.getSelectedSlot() === 2) {
    audio.play('rifleReload');
  }
};

network.on('onPlayerJoin', (snapshot) => {
  if (remotes.has(snapshot.sessionId)) return;
  const remote = new RemotePlayer(scene, snapshot.sessionId, snapshot.name);
  remote.buffer.push({
    t: performance.now(),
    x: snapshot.x, y: snapshot.y, z: snapshot.z,
    rx: snapshot.rx, ry: snapshot.ry, vy: snapshot.vy, grounded: snapshot.grounded
  });
  remote.setVitals(snapshot.hp, snapshot.alive);
  remotes.set(snapshot.sessionId, remote);
  lastNames[snapshot.sessionId] = snapshot.name;
});

network.on('onPlayerLeave', (sessionId) => {
  const remote = remotes.get(sessionId);
  if (!remote) return;
  remote.dispose();
  remotes.delete(sessionId);
});

network.on('onPlayerStateUpdate', (snapshot) => {
  const remote = remotes.get(snapshot.sessionId);
  if (!remote) return;
  remote.buffer.push({
    t: performance.now(),
    x: snapshot.x, y: snapshot.y, z: snapshot.z,
    rx: snapshot.rx, ry: snapshot.ry, vy: snapshot.vy, grounded: snapshot.grounded
  });
  const prevHp = (remote as unknown as { _prevHp?: number })._prevHp ?? snapshot.hp;
  remote.setVitals(snapshot.hp, snapshot.alive);
  (remote as unknown as { _prevHp?: number })._prevHp = snapshot.hp;

  if (prevHp > snapshot.hp && snapshot.alive) {
    const delta = prevHp - snapshot.hp;
    damageNumbers.spawn(new Vector3(snapshot.x, snapshot.y + 2.0, snapshot.z), delta, 'opponent');
    audio.play('hitConfirm');
    hud.flashHitMarker();
  }
  lastNames[snapshot.sessionId] = snapshot.name;
});

network.on('onSelfStateUpdate', (snapshot) => {
  hud.setLocalHealth(snapshot.hp);
  hud.setDamageVignette(snapshot.hp);

  if (snapshot.hp < lastSelfHp && snapshot.alive) {
    const delta = lastSelfHp - snapshot.hp;
    shake.add(Math.min(4, delta * 0.18), 0.08);
    audio.play('playerHit');
  }
  lastSelfHp = snapshot.hp;

  if (!snapshot.alive) {
    if (performance.now() > eliminatedUntil) {
      eliminatedUntil = performance.now() + 3000;
      hud.setEliminated(true);
      player.respawnAtSpawn();
      audio.play('eliminationDie');
    }
  } else if (eliminatedUntil > 0) {
    eliminatedUntil = 0;
    hud.setEliminated(false);
    player.respawnAtSpawn(snapshot.x, snapshot.y, snapshot.z);
    lastSelfHp = snapshot.hp;
  }
  lastNames[snapshot.sessionId] = snapshot.name;
});

network.on('onBuildAdd', (snapshot) => buildManager.applyServerPlacement(snapshot));
network.on('onBuildUpdate', (snapshot) => {
  buildManager.applyServerBuildHp(snapshot.id, snapshot.hp);
  audio.play('buildHit');
});
network.on('onBuildRemove', (id) => buildManager.applyServerBuildRemove(id));

network.on('onKilled', (event) => {
  hud.addKillFeedEntry(event.killerName, event.weapon, event.victimName);
  if (event.killerId === network.getSelfId()) {
    audio.play('eliminationGet');
    shake.add(3, 0.12);
  }
});

network.on('onPlaceRejected', () => buildManager.flashPreviewRejected());

network.on('onScoreChange', (scores) => {
  lastScores = scores;
  refreshScore(scores, lastNames);
});

network.on('onMatchStateChange', (state) => {
  if (state === 'playing') {
    screenManager.show('in_game');
    hud.setWaiting(false);
    refreshScore(lastScores, lastNames);
  } else if (state === 'waiting') {
    screenManager.show('in_game');
    hud.setWaiting(true);
  }
});

network.on('onMatchStart', () => {
  hud.setWaiting(false);
  hud.setEliminated(false);
  eliminatedUntil = 0;
  lastSelfHp = 100;
  audio.play('matchStart');
  maybeShowTutorial();
});

network.on('onMatchEnd', (event) => {
  const selfId = network.getSelfId();
  const yours = event.finalScore[selfId] ?? 0;
  const otherEntry = Object.entries(event.finalScore).find(([id]) => id !== selfId);
  const theirs = otherEntry ? otherEntry[1] : 0;
  const youWon = event.winnerId === selfId;
  matchEnd.setResult(youWon, yours, theirs);
  screenManager.show('match_end');
  audio.play(youWon ? 'matchVictory' : 'matchDefeat');
});

network.on('onRematchStart', () => {
  matchEnd.setNote('');
  screenManager.show('in_game');
});

network.on('onRematchFailed', () => {
  matchEnd.setNote('Opponent left.');
  setTimeout(() => {
    network.leaveArena();
    backToLanding('Opponent left the match.');
  }, 1500);
});

network.on('onRematchStatus', (info) => {
  const selfId = network.getSelfId();
  if (info.requested.includes(selfId) && info.requested.length === 1) {
    matchEnd.setNote('Waiting for opponent…');
  }
});

network.on('onStatusChange', (status) => {
  if (status.error && status.phase === 'error') {
    backToLanding(`Connection error: ${status.error}`);
    return;
  }
  if (status.phase === 'lobby') {
    screenManager.show('queue');
    queueScreen.setQueueSize(status.queueSize || 1);
  } else if (status.phase === 'arena') {
    if (status.matchState === 'waiting') {
      screenManager.show('in_game');
      hud.setWaiting(true);
    } else if (status.matchState === 'playing') {
      screenManager.show('in_game');
      hud.setWaiting(false);
    }
  }
});

const url = new URL(window.location.href);
const debugRoom = url.searchParams.get('room');
if (debugRoom) {
  void network.joinPrivateRoom(debugRoom, `Player${Math.floor(1000 + Math.random() * 9000)}`);
} else {
  landing.focusName();
  pollOnlineCount();
  setInterval(pollOnlineCount, 5000);
}

function pollOnlineCount(): void {
  const httpHost = (import.meta as unknown as { env?: { VITE_SERVER_URL?: string } }).env?.VITE_SERVER_URL?.replace(/^ws/, 'http') ??
    `http://${window.location.hostname}:2567`;
  fetch(`${httpHost}/stats`).then(r => r.json()).then((d: { online: number }) => {
    if (typeof d.online === 'number') landing.setOnlineCount(d.online);
  }).catch(() => {});
}

function maybeShowTutorial(): void {
  try {
    if (localStorage.getItem(TUTORIAL_KEY)) return;
  } catch { return; }
  hud.showTutorial(() => {
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch {}
  });
}

function clearLocalArena(): void {
  for (const remote of remotes.values()) remote.dispose();
  remotes.clear();
  for (const piece of buildManager.getBuildPieces()) {
    buildManager.applyServerBuildRemove(piece.gridKey);
  }
  player.respawnAtSpawn();
  hud.clearScore();
  hud.setWaiting(false);
  hud.setEliminated(false);
  hud.setDamageVignette(100);
  lastSelfHp = 100;
}

function backToLanding(message: string): void {
  clearLocalArena();
  screenManager.show('landing');
  if (message) landing.setStatus(message);
  else landing.setStatus('');
}

function refreshScore(scores: Record<string, number>, _names: Record<string, string>): void {
  const selfId = network.getSelfId();
  if (!selfId) return;
  const yours = scores[selfId] ?? 0;
  const theirEntry = Object.entries(scores).find(([id]) => id !== selfId);
  const theirs = theirEntry ? theirEntry[1] : 0;
  hud.setScore(yours, theirs, 3);
}

let previousFrameTime = performance.now();

function animate(): void {
  requestAnimationFrame(animate);

  const now = performance.now();
  const deltaSeconds = Math.min((now - previousFrameTime) / 1000, 0.05);
  previousFrameTime = now;

  input.update(deltaSeconds);
  player.update(deltaSeconds);
  for (const staticAABB of world.staticAABBs) {
    player.resolveAABBCollision(staticAABB);
  }
  buildManager.resolvePlayerCollision();
  buildManager.update(deltaSeconds);

  const status = network.getStatus();
  const matchActive = status.matchState === 'playing';
  weaponManager.update(deltaSeconds, buildManager.isBuildModeActive() || !matchActive);

  if (network.isInArena()) {
    network.sendInput(deltaSeconds, player.getNetworkState());
  }

  for (const remote of remotes.values()) {
    remote.update(now, camera.position);
  }

  damageNumbers.update(deltaSeconds);

  // Sprint FOV — only when not sniper-aiming
  if (!sniper.getStatus().isAiming) {
    const sprintBlend = player.getSprintBlend();
    const targetFov = MathUtils.lerp(DEFAULT_FOV, SPRINT_FOV, sprintBlend);
    const amount = 1 - Math.exp(-6 * deltaSeconds);
    camera.fov = MathUtils.lerp(camera.fov, targetFov, amount);
    camera.updateProjectionMatrix();
  }

  // Apply screen shake to camera
  if (pendingFireShake > 0) {
    shake.add(pendingFireShake, 0.06);
    pendingFireShake = 0;
  }
  shake.update(deltaSeconds);
  camera.position.x += shake.offsetX * 0.05;
  camera.position.y += shake.offsetY * 0.05;

  hud.tickKillFeed();
  hud.tickHitMarker();
  if (eliminatedUntil > 0 && now > eliminatedUntil) {
    eliminatedUntil = 0;
    hud.setEliminated(false);
  }

  hud.setPlayHint(screenManager.getCurrent() === 'in_game' && !input.isPointerLocked && status.matchState === 'playing');

  const weaponStatus = weaponManager.getStatus();
  weaponViewModel.update(
    weaponStatus.weaponName,
    deltaSeconds,
    weaponStatus.isAiming,
    player.getHorizontalSpeed(),
    weaponManager.isSwapping() ? weaponManager.getSwapProgress() : 1
  );
  hud.update(weaponStatus, buildManager.getBuildModeLabel(), weaponManager.getSelectedSlot());
  renderer.render(scene, camera);
}

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);
animate();
