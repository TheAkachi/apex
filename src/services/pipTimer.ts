import type { TimerPhase } from '../types/models';
import { formatClock, formatStopwatch } from '../utils/date';

export type PipPhase = TimerPhase | 'marathon' | 'marathon-break';

export interface PipTimerState {
  phase: PipPhase;
  remainingSeconds: number;
  totalSeconds: number;
  running: boolean;
  label: string;
}

export interface PipTimerCallbacks {
  onToggleRun: () => void;
  onSwitchPhase: () => void;
  onClose: () => void;
}

interface DocumentPiP {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

function getDocumentPiP(): DocumentPiP | null {
  const w = window as unknown as { documentPictureInPicture?: DocumentPiP };
  return w.documentPictureInPicture ?? null;
}

/**
 * Módulo de Timer Flutuante (Picture-in-Picture).
 * Usa Document Picture-in-Picture (interativo, sempre no topo) quando suportado
 * pelo navegador (Chrome/Edge desktop), com fallback automático para Canvas + Video PiP.
 */
class PipTimerController {
  private pipWindow: Window | null = null;
  private callbacks: PipTimerCallbacks | null = null;

  // Fallback Canvas + Video PiP
  private canvas: HTMLCanvasElement | null = null;
  private video: HTMLVideoElement | null = null;
  private fallbackOpen = false;

  isSupported(): boolean {
    if (getDocumentPiP()) return true;
    return typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
  }

  isOpen(): boolean {
    return (this.pipWindow !== null && !this.pipWindow.closed) || this.fallbackOpen;
  }

  async open(state: PipTimerState, callbacks: PipTimerCallbacks): Promise<boolean> {
    this.callbacks = callbacks;

    if (this.isOpen()) {
      this.update(state);
      return true;
    }

    const docPiP = getDocumentPiP();
    if (docPiP) {
      try {
        const win = await docPiP.requestWindow({ width: 280, height: 176 });
        this.pipWindow = win;
        this.mountDocumentPiP(win, state);
        return true;
      } catch {
        // Tenta fallback abaixo
      }
    }

    return this.openCanvasFallback(state);
  }

  update(state: PipTimerState): void {
    if (this.pipWindow && !this.pipWindow.closed) {
      const doc = this.pipWindow.document;
      const clockEl = doc.getElementById('pip-clock');
      const phaseEl = doc.getElementById('pip-phase');
      const labelEl = doc.getElementById('pip-label');
      const toggleEl = doc.getElementById('pip-toggle');
      const barEl = doc.getElementById('pip-bar');

      const isMarathon = state.phase === 'marathon' || state.phase === 'marathon-break';
      const isBreakLike = state.phase === 'break' || state.phase === 'marathon-break';

      if (clockEl) {
        clockEl.textContent = isMarathon
          ? formatStopwatch(state.remainingSeconds)
          : formatClock(state.remainingSeconds);
      }
      if (phaseEl) {
        phaseEl.textContent =
          state.phase === 'marathon'
            ? 'MARATONA'
            : state.phase === 'marathon-break'
              ? 'MARATONA · PAUSA'
              : state.phase === 'study'
                ? 'ATIVIDADE'
                : 'DESCANSO';
        phaseEl.setAttribute('data-phase', isBreakLike ? 'break' : 'study');
      }
      if (labelEl) {
        labelEl.textContent =
          state.label.trim() ||
          (state.phase === 'marathon'
            ? 'Em fluxo'
            : state.phase === 'marathon-break'
              ? 'Descansando'
              : state.phase === 'study'
                ? 'Atividade em andamento'
                : 'Descanso');
      }
      if (toggleEl) {
        if (state.phase === 'marathon') {
          toggleEl.textContent = state.running ? 'Descansar' : 'Iniciar';
        } else if (state.phase === 'marathon-break') {
          toggleEl.textContent = 'Retomar';
        } else {
          toggleEl.textContent = state.running ? 'Pausar' : 'Iniciar';
        }
      }
      if (barEl) {
        if (isMarathon) {
          barEl.style.width = state.running ? '100%' : '0%';
        } else {
          const pct =
            state.totalSeconds > 0
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    ((state.totalSeconds - state.remainingSeconds) / state.totalSeconds) * 100
                  )
                )
              : 0;
          barEl.style.width = `${pct}%`;
        }
      }
      return;
    }

    if (this.fallbackOpen && this.canvas) {
      this.drawCanvas(this.canvas, state);
    }
  }

  close(): void {
    if (this.pipWindow && !this.pipWindow.closed) {
      this.pipWindow.close();
      this.pipWindow = null;
    }
    if (this.fallbackOpen) {
      this.fallbackOpen = false;
      if (document.pictureInPictureElement) {
        void document.exitPictureInPicture().catch(() => {});
      }
      this.cleanupFallback();
    }
  }

  private mountDocumentPiP(win: Window, state: PipTimerState): void {
    const doc = win.document;
    doc.title = 'Apex — Timer';

    const style = doc.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        width: 100%; height: 100%;
        background: #000000;
        color: #f9f9f9;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        overflow: hidden;
        user-select: none;
      }
      .wrap {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 14px 16px 12px;
        background: radial-gradient(circle at 20% 0%, rgba(232,80,2,0.18), transparent 62%), #000000;
      }
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .phase {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.14em;
        padding: 3px 8px;
        border-radius: 999px;
        background: rgba(232, 80, 2, 0.18);
        color: #f16001;
      }
      .phase[data-phase="break"] {
        background: rgba(217, 195, 171, 0.14);
        color: #d9c3ab;
      }
      .label {
        font-size: 11px;
        color: #a7a7a7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 150px;
      }
      .clock {
        font-size: 46px;
        font-weight: 600;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
        text-align: center;
        line-height: 1.05;
        color: #f9f9f9;
      }
      .track {
        height: 3px;
        border-radius: 999px;
        background: rgba(249, 249, 249, 0.12);
        overflow: hidden;
      }
      .bar {
        height: 100%;
        width: 0%;
        background: #e85002;
        transition: width 250ms linear;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      button {
        flex: 1;
        height: 30px;
        border-radius: 8px;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid rgba(249, 249, 249, 0.14);
        background: #141414;
        color: #f9f9f9;
      }
      button.primary {
        background: #e85002;
        color: #f9f9f9;
        border-color: #e85002;
      }
      button:hover { filter: brightness(1.08); }
    `;
    doc.head.appendChild(style);

    doc.body.innerHTML = `
      <div class="wrap">
        <div class="top">
          <span id="pip-phase" class="phase"></span>
          <span id="pip-label" class="label"></span>
        </div>
        <div id="pip-clock" class="clock"></div>
        <div class="track"><div id="pip-bar" class="bar"></div></div>
        <div class="actions">
          <button id="pip-toggle" class="primary"></button>
          <button id="pip-switch">Trocar</button>
        </div>
      </div>
    `;

    doc.getElementById('pip-toggle')?.addEventListener('click', () => {
      this.callbacks?.onToggleRun();
    });
    doc.getElementById('pip-switch')?.addEventListener('click', () => {
      this.callbacks?.onSwitchPhase();
    });

    win.addEventListener('pagehide', () => {
      this.pipWindow = null;
      this.callbacks?.onClose();
    });

    this.update(state);
  }

  private async openCanvasFallback(state: PipTimerState): Promise<boolean> {
    if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) {
      return false;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 200;
      this.canvas = canvas;
      this.drawCanvas(canvas, state);

      const stream = canvas.captureStream(5);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      video.style.position = 'fixed';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      document.body.appendChild(video);
      this.video = video;

      await video.play();
      await video.requestPictureInPicture();
      this.fallbackOpen = true;

      video.addEventListener(
        'leavepictureinpicture',
        () => {
          this.fallbackOpen = false;
          this.cleanupFallback();
          this.callbacks?.onClose();
        },
        { once: true }
      );
      return true;
    } catch {
      this.cleanupFallback();
      return false;
    }
  }

  private drawCanvas(canvas: HTMLCanvasElement, state: PipTimerState): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const isMarathon = state.phase === 'marathon' || state.phase === 'marathon-break';
    const isBreakLike = state.phase === 'break' || state.phase === 'marathon-break';

    ctx.fillStyle = isBreakLike ? '#d9c3ab' : '#e85002';
    ctx.font = '600 15px Inter, sans-serif';
    ctx.textAlign = 'center';
    const title =
      state.phase === 'marathon'
        ? 'APEX · MARATONA'
        : state.phase === 'marathon-break'
          ? 'APEX · MARATONA (PAUSA)'
          : state.phase === 'study'
            ? 'APEX · ATIVIDADE'
            : 'APEX · DESCANSO';
    ctx.fillText(title, canvas.width / 2, 42);

    ctx.fillStyle = '#f9f9f9';
    ctx.font = '600 64px Inter, sans-serif';
    ctx.fillText(
      isMarathon ? formatStopwatch(state.remainingSeconds) : formatClock(state.remainingSeconds),
      canvas.width / 2,
      126
    );

    ctx.fillStyle = '#a7a7a7';
    ctx.font = '400 14px Inter, sans-serif';
    const subtitle = state.label.trim() || (state.running ? 'Em andamento' : 'Pausado');
    ctx.fillText(subtitle.slice(0, 32), canvas.width / 2, 168);
  }

  private cleanupFallback(): void {
    if (this.video) {
      const stream = this.video.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      this.video.remove();
      this.video = null;
    }
    this.canvas = null;
  }
}

export const pipTimer = new PipTimerController();
