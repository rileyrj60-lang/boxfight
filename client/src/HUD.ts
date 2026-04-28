import type { WeaponStatus } from './Weapon';
import type { BuildType } from './build/BuildPiece';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

export class HUD {
  private readonly root = document.createElement('div');
  private readonly crosshair = document.createElement('div');
  private readonly ammo = document.createElement('div');
  private readonly health = document.createElement('div');
  private readonly reload = document.createElement('div');
  private readonly weapon = document.createElement('div');
  private readonly build = document.createElement('div');
  private readonly scope = document.createElement('div');
  private readonly slots = document.createElement('div');
  private readonly buildPalette = document.createElement('div');
  private readonly netStatus = document.createElement('div');
  private readonly killFeed = document.createElement('div');
  private readonly eliminated = document.createElement('div');
  private readonly score = document.createElement('div');
  private readonly waiting = document.createElement('div');
  private readonly hitMarker = document.createElement('div');
  private readonly vignette = document.createElement('div');
  private readonly tutorial = document.createElement('div');
  private readonly playHint = document.createElement('div');
  private hitMarkerExpiry = 0;
  private readonly slotElements = new Map<1 | 2 | 3, HTMLDivElement>();
  private readonly buildElements = new Map<BuildType, HTMLDivElement>();
  private readonly killFeedEntries: Array<{ el: HTMLDivElement; expiresAt: number }> = [];

  public constructor(parent: HTMLElement) {
    this.root.id = 'hud';
    this.crosshair.id = 'crosshair';
    this.ammo.id = 'ammo';
    this.health.id = 'health';
    this.reload.id = 'reload';
    this.weapon.id = 'weapon';
    this.build.id = 'build';
    this.scope.id = 'scope';
    this.slots.id = 'slots';
    this.buildPalette.id = 'build-palette';
    this.netStatus.id = 'net-status';
    this.killFeed.id = 'kill-feed';
    this.eliminated.id = 'eliminated';
    this.score.id = 'match-score';
    this.waiting.id = 'match-waiting';
    this.hitMarker.id = 'hit-marker';
    this.vignette.id = 'damage-vignette';
    this.tutorial.id = 'tutorial-overlay';
    this.playHint.id = 'play-hint';
    this.health.textContent = 'HP 100';
    this.reload.textContent = 'RELOADING';
    this.netStatus.textContent = 'Connecting…';
    this.eliminated.textContent = 'ELIMINATED';
    this.waiting.textContent = 'Waiting for opponent…';
    this.hitMarker.textContent = '✕';
    this.playHint.textContent = 'Click canvas to capture mouse';
    this.tutorial.innerHTML = `
      <div class="tutorial-card">
        <h3>How to play</h3>
        <ul>
          <li><b>WASD</b> move &middot; <b>Shift</b> sprint &middot; <b>Space</b> jump</li>
          <li><b>Mouse</b> look &middot; <b>LMB</b> fire</li>
          <li><b>1</b> rifle &middot; <b>2</b> sniper &middot; <b>3</b> pickaxe &middot; <b>R</b> reload</li>
          <li><b>Q</b> wall &middot; <b>F</b> ramp &middot; <b>C</b> floor &middot; <b>V</b> roof &middot; <b>E</b> rotate</li>
          <li>First to 3 eliminations wins.</li>
        </ul>
        <button id="tutorial-dismiss">Got it</button>
      </div>
    `;

    this.createSlots();
    this.createBuildPalette();
    this.root.append(
      this.vignette,
      this.scope,
      this.crosshair,
      this.hitMarker,
      this.ammo,
      this.health,
      this.reload,
      this.weapon,
      this.build,
      this.buildPalette,
      this.slots,
      this.netStatus,
      this.killFeed,
      this.eliminated,
      this.score,
      this.waiting,
      this.playHint,
      this.tutorial
    );
    parent.appendChild(this.root);
    this.injectStyles();
  }

  public update(
    weaponStatus: WeaponStatus,
    buildModeLabel: string | undefined,
    selectedSlot: 1 | 2 | 3
  ): void {
    const scoped = weaponStatus.weaponName === 'SNIPER' && weaponStatus.isAiming;

    this.ammo.textContent = weaponStatus.hasAmmo
      ? `${weaponStatus.currentAmmo} / ${weaponStatus.maxAmmo}`
      : '';
    this.reload.style.opacity = weaponStatus.isReloading ? '1' : '0';
    this.weapon.textContent = weaponStatus.weaponName;
    this.build.textContent = buildModeLabel ? `BUILD ${buildModeLabel}` : '';
    this.buildPalette.classList.toggle('active', buildModeLabel !== undefined);
    this.scope.classList.toggle('active', scoped);
    this.crosshair.classList.toggle('hidden', scoped);

    for (const [slot, element] of this.slotElements.entries()) {
      element.classList.toggle('active', slot === selectedSlot);
    }

    for (const [buildType, element] of this.buildElements.entries()) {
      element.classList.toggle('active', buildModeLabel === buildType.toUpperCase());
    }
  }

  public setNetworkStatus(text: string, ok: boolean): void {
    this.netStatus.textContent = text;
    this.netStatus.classList.toggle('ok', ok);
    this.netStatus.classList.toggle('bad', !ok);
  }

  public setLocalHealth(hp: number): void {
    this.health.textContent = `HP ${Math.max(0, Math.round(hp))}`;
    this.health.classList.toggle('low', hp < 35);
  }

  public setEliminated(visible: boolean): void {
    this.eliminated.classList.toggle('active', visible);
  }

  public setScore(yourScore: number, theirScore: number, target: number): void {
    this.score.innerHTML = `<span class="me">YOU ${yourScore}</span> <span class="dash">–</span> <span class="them">${theirScore} OPP</span> <span class="target">first to ${target}</span>`;
  }

  public clearScore(): void {
    this.score.textContent = '';
  }

  public setWaiting(visible: boolean): void {
    this.waiting.classList.toggle('active', visible);
  }

  public setVisible(visible: boolean): void {
    this.root.style.display = visible ? '' : 'none';
  }

  public flashHitMarker(): void {
    this.hitMarker.classList.add('active');
    this.hitMarkerExpiry = performance.now() + 120;
  }

  public tickHitMarker(): void {
    if (this.hitMarkerExpiry > 0 && performance.now() > this.hitMarkerExpiry) {
      this.hitMarker.classList.remove('active');
      this.hitMarkerExpiry = 0;
    }
  }

  public setDamageVignette(hp: number): void {
    const intensity = Math.max(0, Math.min(1, (100 - hp) / 100));
    this.vignette.style.opacity = String(intensity * 0.7);
  }

  public setPlayHint(visible: boolean): void {
    this.playHint.classList.toggle('active', visible);
  }

  public showTutorial(onDismiss: () => void): void {
    this.tutorial.classList.add('active');
    const btn = this.tutorial.querySelector<HTMLButtonElement>('#tutorial-dismiss');
    btn?.addEventListener('click', () => {
      this.tutorial.classList.remove('active');
      onDismiss();
    }, { once: true });
  }

  public addKillFeedEntry(killerName: string, weapon: string, victimName: string): void {
    const entry = document.createElement('div');
    entry.className = 'kill-entry entering';
    entry.innerHTML = `<span class="killer">${escapeHtml(killerName)}</span> <span class="weapon">[${escapeHtml(weapon)}]</span> <span class="victim">${escapeHtml(victimName)}</span>`;
    this.killFeed.appendChild(entry);
    requestAnimationFrame(() => entry.classList.remove('entering'));
    this.killFeedEntries.push({ el: entry, expiresAt: performance.now() + 4000 });
    while (this.killFeedEntries.length > 4) {
      const old = this.killFeedEntries.shift();
      old?.el.remove();
    }
  }

  public tickKillFeed(): void {
    const now = performance.now();
    while (this.killFeedEntries.length > 0 && this.killFeedEntries[0].expiresAt <= now) {
      const expired = this.killFeedEntries.shift();
      expired?.el.remove();
    }
  }

  private createSlots(): void {
    const slotData: Array<[1 | 2 | 3, string]> = [
      [1, 'RIFLE'],
      [2, 'SNIPER'],
      [3, 'PICK']
    ];

    for (const [slot, label] of slotData) {
      const element = document.createElement('div');
      element.className = 'slot';
      element.innerHTML = `<span>${slot}</span>${label}`;
      this.slotElements.set(slot, element);
      this.slots.appendChild(element);
    }
  }

  private createBuildPalette(): void {
    const buildData: Array<[BuildType, string]> = [
      ['wall', 'WALL'],
      ['ramp', 'RAMP'],
      ['floor', 'FLOOR'],
      ['roof', 'ROOF']
    ];

    for (const [buildType, label] of buildData) {
      const element = document.createElement('div');
      element.className = `build-item ${buildType}`;
      element.textContent = label;
      this.buildElements.set(buildType, element);
      this.buildPalette.appendChild(element);
    }
  }


  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --color-you: #4df2ca;
        --color-opponent: #ff8a4c;
        --color-warning: #ff5470;
        --hud-shadow: 0 1px 2px rgba(0, 0, 0, 0.85), 0 0 6px rgba(0, 0, 0, 0.55);
      }

      #hud,
      #hud * {
        box-sizing: border-box;
        pointer-events: none;
        user-select: none;
      }

      #hud {
        position: fixed;
        inset: 0;
        z-index: 10;
        color: #fff;
        font-family:
          ui-monospace,
          SFMono-Regular,
          Consolas,
          "Liberation Mono",
          monospace;
      }

      #crosshair {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 24px;
        height: 24px;
        transform: translate(-50%, -50%);
        opacity: 0.95;
        transition: opacity 120ms linear;
      }

      #crosshair::before,
      #crosshair::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        background: #f8fbff;
        box-shadow: 0 0 8px rgba(58, 229, 206, 0.85), 0 1px 2px rgba(0, 0, 0, 0.7);
        transform: translate(-50%, -50%);
      }

      #crosshair::before {
        width: 3px;
        height: 18px;
      }

      #crosshair::after {
        width: 18px;
        height: 3px;
      }

      #crosshair.hidden {
        opacity: 0;
      }

      #scope {
        position: absolute;
        inset: 0;
        opacity: 0;
        transition: opacity 110ms linear;
        background:
          radial-gradient(circle at center, transparent 0 31%, rgba(0, 0, 0, 0.94) 31.5% 100%),
          radial-gradient(circle at center, transparent 0 21%, rgba(255, 255, 255, 0.2) 21.2% 21.6%, transparent 21.8% 100%);
      }

      #scope.active {
        opacity: 1;
      }

      #scope::before,
      #scope::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        background: rgba(255, 255, 255, 0.82);
        transform: translate(-50%, -50%);
      }

      #scope::before {
        width: min(54vw, 520px);
        height: 2px;
      }

      #scope::after {
        width: 2px;
        height: min(54vw, 520px);
      }

      #ammo,
      #health,
      #reload,
      #weapon,
      #build {
        position: absolute;
        font-size: 18px;
        line-height: 1;
        letter-spacing: 0;
        text-shadow: var(--hud-shadow);
      }

      #hit-marker {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 28px;
        font-weight: 900;
        color: #ffffff;
        text-shadow: 0 0 6px rgba(0, 0, 0, 0.9), 0 0 2px rgba(0, 0, 0, 0.9);
        opacity: 0;
        transition: opacity 60ms linear;
      }
      #hit-marker.active { opacity: 1; }

      #damage-vignette {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0;
        transition: opacity 140ms linear;
        background: radial-gradient(ellipse at center, transparent 40%, rgba(255, 60, 80, 0.85) 100%);
      }

      #play-hint {
        position: absolute;
        left: 50%;
        top: 60%;
        transform: translateX(-50%);
        font-size: 16px;
        letter-spacing: 2px;
        color: rgba(255, 255, 255, 0.9);
        text-shadow: var(--hud-shadow);
        background: rgba(8, 12, 18, 0.55);
        padding: 8px 18px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        opacity: 0;
        transition: opacity 140ms linear;
      }
      #play-hint.active { opacity: 1; }

      #tutorial-overlay {
        position: absolute;
        inset: 0;
        background: rgba(6, 9, 14, 0.72);
        display: none;
        align-items: center;
        justify-content: center;
      }
      #tutorial-overlay.active { display: flex; }
      #tutorial-overlay * { pointer-events: auto; }
      #tutorial-overlay .tutorial-card {
        background: rgba(15, 22, 30, 0.98);
        border: 1px solid rgba(77, 242, 202, 0.4);
        padding: 28px 36px;
        max-width: 460px;
        color: #ffffff;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        text-align: left;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
      }
      #tutorial-overlay h3 {
        margin: 0 0 14px;
        font-size: 22px;
        letter-spacing: 4px;
        color: var(--color-you);
      }
      #tutorial-overlay ul {
        list-style: none;
        margin: 0 0 18px;
        padding: 0;
        font-size: 14px;
        line-height: 1.8;
        color: rgba(255, 255, 255, 0.85);
      }
      #tutorial-overlay ul b {
        color: var(--color-you);
        font-weight: 700;
        margin-right: 4px;
      }
      #tutorial-overlay button {
        font: inherit;
        font-size: 15px;
        padding: 10px 28px;
        background: var(--color-you);
        border: none;
        color: #051a16;
        font-weight: 700;
        letter-spacing: 2px;
        cursor: pointer;
        text-transform: uppercase;
      }

      #ammo {
        right: 28px;
        bottom: 28px;
        min-width: 92px;
        text-align: right;
      }

      #health {
        left: 28px;
        bottom: 28px;
      }

      #reload {
        left: 50%;
        top: calc(50% + 42px);
        transform: translateX(-50%);
        color: #ffe082;
        opacity: 0;
        transition: opacity 80ms linear;
      }

      #weapon {
        left: 50%;
        bottom: 96px;
        transform: translateX(-50%);
        color: #dffcff;
      }

      #build {
        left: 50%;
        top: 28px;
        transform: translateX(-50%);
        color: #4df2ca;
      }

      #health.low {
        color: #ff7a85;
      }

      #kill-feed {
        position: absolute;
        right: 18px;
        top: 14px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        max-width: 360px;
      }

      .kill-entry {
        font-size: 13px;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.5);
        border-left: 2px solid rgba(255, 255, 255, 0.4);
        color: #ffffff;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.7);
        transform: translateX(0);
        opacity: 1;
        transition: transform 220ms ease-out, opacity 220ms ease-out;
      }
      .kill-entry.entering {
        transform: translateX(40px);
        opacity: 0;
      }

      .kill-entry .killer { color: var(--color-you); }
      .kill-entry .weapon { color: rgba(255, 255, 255, 0.6); }
      .kill-entry .victim { color: var(--color-warning); }

      #eliminated {
        position: absolute;
        left: 50%;
        top: 38%;
        transform: translateX(-50%);
        font-size: 56px;
        font-weight: 900;
        letter-spacing: 6px;
        color: #ff5470;
        text-shadow: 0 4px 14px rgba(0, 0, 0, 0.85);
        opacity: 0;
        transition: opacity 140ms linear;
      }

      #eliminated.active {
        opacity: 1;
      }

      #match-score {
        position: absolute;
        left: 50%;
        top: 14px;
        transform: translateX(-50%);
        font-size: 20px;
        letter-spacing: 3px;
        color: #ffffff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
        padding: 6px 16px;
        background: rgba(10, 18, 24, 0.46);
        border: 1px solid rgba(255, 255, 255, 0.15);
        white-space: nowrap;
      }

      #match-score .me { color: #4df2ca; }
      #match-score .them { color: #ff8a4c; }
      #match-score .dash { color: rgba(255, 255, 255, 0.5); margin: 0 6px; }
      #match-score .target { font-size: 12px; color: rgba(255, 255, 255, 0.55); margin-left: 12px; }

      #match-waiting {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 28px;
        letter-spacing: 4px;
        color: rgba(255, 255, 255, 0.95);
        background: rgba(10, 18, 24, 0.6);
        padding: 12px 24px;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
        opacity: 0;
        pointer-events: none;
        transition: opacity 140ms linear;
      }

      #match-waiting.active {
        opacity: 1;
      }

      #net-status {
        position: absolute;
        left: 16px;
        top: 14px;
        font-size: 12px;
        line-height: 1;
        padding: 6px 9px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(10, 18, 24, 0.42);
        color: rgba(255, 255, 255, 0.78);
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.7);
      }

      #net-status.ok {
        border-color: rgba(77, 242, 202, 0.7);
        color: #c8fff0;
      }

      #net-status.bad {
        border-color: rgba(255, 110, 120, 0.7);
        color: #ffd0d4;
      }

      #slots {
        position: absolute;
        left: 50%;
        bottom: 28px;
        display: flex;
        gap: 8px;
        transform: translateX(-50%);
      }

      #build-palette {
        position: absolute;
        left: 50%;
        top: 58px;
        display: flex;
        gap: 8px;
        opacity: 0;
        transform: translateX(-50%);
        transition: opacity 120ms linear;
      }

      #build-palette.active {
        opacity: 1;
      }

      .slot {
        min-width: 74px;
        height: 38px;
        padding: 6px 9px;
        border: 1px solid rgba(255, 255, 255, 0.24);
        background: rgba(10, 18, 24, 0.38);
        color: rgba(255, 255, 255, 0.68);
        font-size: 13px;
        line-height: 1;
        text-align: center;
      }

      .slot span {
        display: block;
        margin-bottom: 4px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 10px;
      }

      .slot.active {
        border-color: rgba(77, 242, 202, 0.9);
        background: rgba(23, 68, 75, 0.64);
        color: #ffffff;
        box-shadow: inset 0 0 18px rgba(77, 242, 202, 0.2);
      }

      .slot.active span {
        color: #7ff7df;
      }

      .build-item {
        width: 66px;
        height: 30px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        background: rgba(9, 16, 22, 0.38);
        color: rgba(255, 255, 255, 0.68);
        font-size: 12px;
        line-height: 28px;
        text-align: center;
      }

      .build-item.active {
        border-color: rgba(77, 242, 202, 0.9);
        background: rgba(31, 93, 91, 0.68);
        color: #ffffff;
        box-shadow: inset 0 0 16px rgba(77, 242, 202, 0.22);
      }

      @media (max-width: 640px) {
        #ammo,
        #health,
        #reload,
        #weapon,
        #build {
          font-size: 16px;
        }

        #ammo {
          left: 50%;
          right: auto;
          bottom: 92px;
          transform: translateX(-50%);
          min-width: 74px;
          text-align: center;
        }

        #health {
          left: 16px;
          bottom: 92px;
        }

        #weapon {
          bottom: 132px;
        }

        #slots {
          bottom: 24px;
          gap: 6px;
        }

        #build-palette {
          top: 56px;
          gap: 5px;
        }

        .build-item {
          width: 55px;
          height: 28px;
          font-size: 11px;
          line-height: 26px;
        }

        .slot {
          min-width: 70px;
          height: 36px;
          padding: 6px 7px;
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
