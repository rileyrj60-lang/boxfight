export type MatchEndHandlers = {
  onRematch: () => void;
  onLeave: () => void;
};

export class MatchEndScreen {
  public readonly element = document.createElement('div');
  private readonly title = document.createElement('h1');
  private readonly score = document.createElement('div');
  private readonly rematchBtn = document.createElement('button');
  private readonly leaveBtn = document.createElement('button');
  private readonly note = document.createElement('div');
  private rematchPending = false;

  public constructor(handlers: MatchEndHandlers) {
    this.title.className = 'match-result';
    this.score.className = 'score-line';

    this.rematchBtn.textContent = 'Rematch';
    this.rematchBtn.classList.add('primary-action');
    this.rematchBtn.addEventListener('click', () => {
      if (this.rematchPending) return;
      this.rematchPending = true;
      this.rematchBtn.textContent = 'Waiting for opponent…';
      this.rematchBtn.disabled = true;
      handlers.onRematch();
    });

    this.leaveBtn.textContent = 'Leave';
    this.leaveBtn.className = 'secondary';
    this.leaveBtn.addEventListener('click', () => handlers.onLeave());

    const row = document.createElement('div');
    row.className = 'row';
    row.append(this.rematchBtn, this.leaveBtn);

    this.note.className = 'footer-note';
    this.note.textContent = '';

    this.element.append(this.title, this.score, row, this.note);
  }

  public setResult(youWon: boolean, yourScore: number, theirScore: number): void {
    this.title.textContent = youWon ? 'VICTORY' : 'DEFEAT';
    this.title.className = `match-result ${youWon ? 'victory' : 'defeat'}`;
    this.score.innerHTML = `<span class="you-score">${yourScore}</span><span class="dash">–</span><span class="them-score">${theirScore}</span>`;
    this.rematchPending = false;
    this.rematchBtn.textContent = 'Rematch';
    this.rematchBtn.disabled = false;
    this.note.textContent = '';
  }

  public setNote(text: string): void {
    this.note.textContent = text;
  }
}
