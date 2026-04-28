export type LandingHandlers = {
  onPlay: (name: string) => void;
  onVolumeChange: (value: number) => void;
};

export class LandingScreen {
  public readonly element = document.createElement('div');
  private readonly nameInput = document.createElement('input');
  private readonly playButton = document.createElement('button');
  private readonly statusLine = document.createElement('div');
  private readonly volumeSlider = document.createElement('input');
  private readonly volumeLabel = document.createElement('div');
  private readonly onlineCount = document.createElement('div');
  private readonly version = document.createElement('div');

  public constructor(handlers: LandingHandlers, initialVolume: number, version: string) {
    const title = document.createElement('h1');
    title.textContent = 'BOXFIGHT';

    const subtitle = document.createElement('div');
    subtitle.className = 'subtitle';
    subtitle.textContent = '1 vs 1 · first to 3 eliminations';

    this.nameInput.type = 'text';
    this.nameInput.maxLength = 20;
    this.nameInput.placeholder = 'Your name';
    this.nameInput.value = `Player${Math.floor(1000 + Math.random() * 9000)}`;

    this.playButton.textContent = 'Play';
    this.playButton.addEventListener('click', () => {
      const name = this.nameInput.value.trim() || this.nameInput.placeholder;
      handlers.onPlay(name);
    });

    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.playButton.click();
      }
    });

    const volumeRow = document.createElement('div');
    volumeRow.className = 'volume-row';
    this.volumeSlider.type = 'range';
    this.volumeSlider.min = '0';
    this.volumeSlider.max = '100';
    this.volumeSlider.value = String(Math.round(initialVolume * 100));
    this.volumeLabel.className = 'volume-label';
    this.updateVolumeLabel();
    this.volumeSlider.addEventListener('input', () => {
      handlers.onVolumeChange(parseInt(this.volumeSlider.value, 10) / 100);
      this.updateVolumeLabel();
    });
    const volIcon = document.createElement('span');
    volIcon.className = 'volume-icon';
    volIcon.textContent = '♪';
    volumeRow.append(volIcon, this.volumeSlider, this.volumeLabel);

    this.onlineCount.className = 'online-count';
    this.onlineCount.textContent = '— online';

    this.statusLine.className = 'footer-note';
    this.statusLine.textContent = '';

    this.version.className = 'version';
    this.version.textContent = `v${version}`;

    this.element.append(title, subtitle, this.nameInput, this.playButton, volumeRow, this.statusLine, this.onlineCount, this.version);
  }

  public setStatus(text: string): void {
    this.statusLine.textContent = text;
  }

  public setOnlineCount(count: number): void {
    this.onlineCount.textContent = `${count} online`;
  }

  public focusName(): void {
    this.nameInput.focus();
    this.nameInput.select();
  }

  public getName(): string {
    return this.nameInput.value.trim() || this.nameInput.placeholder;
  }

  private updateVolumeLabel(): void {
    this.volumeLabel.textContent = `${this.volumeSlider.value}%`;
  }
}
