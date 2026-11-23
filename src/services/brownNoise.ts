/**
 * Sintetizador leve de ruído marrom via Web Audio API (0 KB de arquivos de áudio).
 * Desligado por padrão; o usuário liga, desliga e ajusta o volume livremente.
 */
class BrownNoiseEngine {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private active = false;
  private volume = 0.28;

  start(volume = this.volume): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.active) {
      this.setVolume(this.volume);
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = this.ctx ?? new AudioCtx();
    this.ctx = ctx;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    // Buffer de 4 segundos em loop suave de ruído marrom (integração de ruído branco)
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 2.8;
    }

    // Crossfade nas pontas para loop sem clique audível
    const fadeSamples = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fadeSamples; i++) {
      const ratio = i / fadeSamples;
      data[i] *= ratio;
      data[bufferSize - 1 - i] *= ratio;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, this.volume * 0.45), ctx.currentTime + 0.35);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.source = source;
    this.gain = gain;
    this.active = true;
  }

  stop(): void {
    if (!this.active || !this.ctx || !this.gain || !this.source) {
      this.active = false;
      return;
    }

    const ctx = this.ctx;
    const gain = this.gain;
    const source = this.source;
    this.active = false;
    this.source = null;
    this.gain = null;

    try {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      setTimeout(() => {
        try {
          source.stop();
          source.disconnect();
        } catch {
          // Já encerrado
        }
      }, 240);
    } catch {
      try {
        source.stop();
      } catch {
        // Ignora
      }
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.active && this.ctx && this.gain) {
      this.gain.gain.setTargetAtTime(
        Math.max(0.0001, this.volume * 0.45),
        this.ctx.currentTime,
        0.06
      );
    }
  }

  isRunning(): boolean {
    return this.active;
  }
}

export const brownNoise = new BrownNoiseEngine();
