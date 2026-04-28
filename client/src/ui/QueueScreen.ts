export type QueueHandlers = {
  onCancel: () => void;
};

export class QueueScreen {
  public readonly element = document.createElement('div');
  private readonly count = document.createElement('div');

  public constructor(handlers: QueueHandlers) {
    const spinner = document.createElement('div');
    spinner.className = 'queue-spinner';

    const title = document.createElement('h1');
    title.style.fontSize = '32px';
    title.style.letterSpacing = '4px';
    title.innerHTML = 'Searching for opponent<span class="dots"><span>.</span><span>.</span><span>.</span></span>';

    this.count.className = 'queue-count';
    this.count.textContent = '1 player in queue';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.marginTop = '24px';
    cancelBtn.addEventListener('click', () => handlers.onCancel());

    this.element.append(spinner, title, this.count, cancelBtn);
  }

  public setQueueSize(n: number): void {
    this.count.textContent = `${n} ${n === 1 ? 'player' : 'players'} in queue`;
  }
}
