export type ScreenName = 'landing' | 'queue' | 'in_game' | 'match_end';

export class ScreenManager {
  private current: ScreenName | null = null;
  private readonly screens = new Map<ScreenName, HTMLElement>();
  private canvas?: HTMLElement;

  public setCanvas(canvas: HTMLElement): void {
    this.canvas = canvas;
  }

  public register(name: ScreenName, element: HTMLElement): void {
    element.classList.add('screen');
    element.dataset.screen = name;
    element.style.display = 'none';
    this.screens.set(name, element);
  }

  public show(name: ScreenName): void {
    if (this.current === name) return;
    this.current = name;

    for (const [n, el] of this.screens.entries()) {
      el.style.display = n === name ? 'flex' : 'none';
    }

    if (this.canvas) {
      const canvasVisible = name === 'in_game' || name === 'match_end';
      this.canvas.style.display = canvasVisible ? 'block' : 'none';
    }
  }

  public getCurrent(): ScreenName | null {
    return this.current;
  }

  public injectStyles(): void {
    const style = document.createElement('style');
    style.id = 'screen-styles';
    style.textContent = `
      :root {
        --color-you: #4df2ca;
        --color-opponent: #ff8a4c;
        --color-warning: #ff5470;
      }

      html, body { cursor: default; }
      body.in-match { cursor: none; }

      .screen {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        color: #ffffff;
      }

      .screen[data-screen="landing"],
      .screen[data-screen="queue"] {
        background:
          radial-gradient(ellipse at top, rgba(35, 70, 96, 0.6) 0%, transparent 60%),
          radial-gradient(ellipse at center, #0d1820 0%, #050709 100%);
      }

      .screen[data-screen="landing"]::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(77, 242, 202, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(77, 242, 202, 0.04) 1px, transparent 1px);
        background-size: 60px 60px;
        mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
        pointer-events: none;
      }

      .screen[data-screen="match_end"] {
        background: rgba(4, 7, 11, 0.86);
        backdrop-filter: blur(4px);
      }

      .screen h1 {
        font-size: 96px;
        margin: 0 0 4px;
        letter-spacing: 14px;
        font-weight: 900;
        color: var(--color-you);
        text-shadow: 0 6px 28px rgba(77, 242, 202, 0.4), 0 0 1px rgba(77, 242, 202, 0.6);
      }

      .screen[data-screen="landing"] h1 {
        font-size: 96px;
      }

      .screen .subtitle {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.65);
        margin-bottom: 28px;
      }

      .screen input[type="text"] {
        font: inherit;
        font-size: 18px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.18);
        color: #ffffff;
        outline: none;
        width: 280px;
        text-align: center;
        margin-bottom: 16px;
      }

      .screen input[type="text"]:focus {
        border-color: rgba(77, 242, 202, 0.7);
      }

      .screen button {
        font: inherit;
        font-size: 18px;
        padding: 12px 36px;
        background: linear-gradient(180deg, rgba(77, 242, 202, 0.92), rgba(35, 178, 152, 0.92));
        border: none;
        color: #051a16;
        font-weight: 700;
        letter-spacing: 2px;
        cursor: pointer;
        text-transform: uppercase;
        transition: transform 80ms ease, filter 80ms ease;
      }

      .screen button:hover {
        filter: brightness(1.08);
      }

      .screen button:active {
        transform: translateY(1px);
      }

      .screen button.secondary {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.22);
      }

      .screen button[disabled] {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .screen .row {
        display: flex;
        gap: 12px;
        margin-top: 16px;
      }

      .screen .footer-note {
        margin-top: 28px;
        color: rgba(255, 255, 255, 0.45);
        font-size: 12px;
      }

      .screen .queue-spinner {
        width: 64px;
        height: 64px;
        border: 4px solid rgba(255, 255, 255, 0.08);
        border-top-color: #4df2ca;
        border-radius: 50%;
        animation: queueSpin 1s linear infinite;
        margin-bottom: 18px;
      }

      .screen .queue-count {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
        margin-top: 8px;
      }

      @keyframes queueSpin {
        to { transform: rotate(360deg); }
      }

      .screen .dots span {
        display: inline-block;
        opacity: 0.25;
        animation: dotPulse 1.4s infinite;
      }
      .screen .dots span:nth-child(2) { animation-delay: 0.2s; }
      .screen .dots span:nth-child(3) { animation-delay: 0.4s; }

      @keyframes dotPulse {
        0%, 80%, 100% { opacity: 0.25; }
        40% { opacity: 1; }
      }

      .screen .match-result {
        font-size: 120px;
        letter-spacing: 20px;
        margin-bottom: 4px;
      }
      .screen .match-result.victory { color: var(--color-you); text-shadow: 0 8px 36px rgba(77, 242, 202, 0.55); }
      .screen .match-result.defeat { color: var(--color-warning); text-shadow: 0 8px 36px rgba(255, 84, 112, 0.5); }

      .screen .score-line {
        font-size: 88px;
        font-weight: 900;
        letter-spacing: 8px;
        color: #ffffff;
        margin: 18px 0 32px;
        display: flex;
        align-items: center;
        gap: 24px;
      }
      .screen .score-line .you-score { color: var(--color-you); }
      .screen .score-line .them-score { color: var(--color-opponent); }
      .screen .score-line .dash { color: rgba(255, 255, 255, 0.35); font-weight: 400; font-size: 64px; }

      .screen button.primary-action {
        background: linear-gradient(180deg, var(--color-you), #2bc8a4);
        font-size: 22px;
        padding: 16px 56px;
        letter-spacing: 4px;
      }

      .screen .volume-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 18px;
        color: rgba(255, 255, 255, 0.7);
        font-size: 13px;
      }
      .screen .volume-row .volume-icon {
        font-size: 18px;
        color: var(--color-you);
      }
      .screen input[type="range"] {
        width: 180px;
        -webkit-appearance: none;
        appearance: none;
        height: 4px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 2px;
        outline: none;
      }
      .screen input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--color-you);
        cursor: pointer;
        border: 2px solid #051a16;
      }
      .screen input[type="range"]::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--color-you);
        cursor: pointer;
        border: 2px solid #051a16;
      }
      .screen .volume-label {
        min-width: 36px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .screen .online-count {
        position: absolute;
        bottom: 18px;
        left: 18px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.4);
        letter-spacing: 2px;
      }

      .screen .version {
        position: absolute;
        bottom: 18px;
        right: 18px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.35);
        letter-spacing: 2px;
      }
    `;
    document.head.appendChild(style);
  }
}
