/**
 * Alerta sonoro suave gerado via Web Audio API (sem arquivos MP3/WAV).
 */
export function playChime(kind: 'focus-done' | 'break-done' | 'reminder' = 'focus-done'): void {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const notes =
      kind === 'focus-done'
        ? [523.25, 659.25, 783.99] // C5 -> E5 -> G5
        : kind === 'break-done'
          ? [659.25, 523.25] // E5 -> C5
          : [587.33, 880.0]; // D5 -> A5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.14;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });

    setTimeout(() => {
      void ctx.close();
    }, 1200);
  } catch {
    // Navegador pode bloquear áudio antes de interação do usuário
  }
}
