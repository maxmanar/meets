// Generates a valid playable WAV data URI with pleasant voice-like harmonic tones
// so that seeded voice messages and fallback recordings play real audio in any browser.

export function generatePlayableWavDataUri(
  durationSeconds = 4,
  variant: "warm" | "bright" | "chime" = "warm"
): string {
  const sampleRate = 8000;
  const numSamples = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const bytesPerSample = 2; // 16-bit PCM
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const notes =
    variant === "warm"
      ? [220, 277.18, 329.63, 440, 329.63, 277.18]
      : variant === "bright"
      ? [261.63, 329.63, 392.0, 523.25, 392.0]
      : [293.66, 369.99, 440, 587.33];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIndex = Math.floor((t / durationSeconds) * notes.length) % notes.length;
    const freq = notes[noteIndex];
    // Speech-like syllable envelope
    const syllableEnv = 0.55 + 0.45 * Math.sin(2 * Math.PI * 3.2 * t);
    const fadeIn = Math.min(1, t / 0.08);
    const fadeOut = Math.min(1, (durationSeconds - t) / 0.12);
    const env = syllableEnv * fadeIn * fadeOut;

    const wave =
      0.6 * Math.sin(2 * Math.PI * freq * t) +
      0.25 * Math.sin(2 * Math.PI * freq * 1.5 * t) +
      0.15 * Math.sin(2 * Math.PI * freq * 2 * t);

    const sample = Math.max(-1, Math.min(1, wave * env * 0.45));
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  const uint8 = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const slice = uint8.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(slice));
  }
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(buffer).toString("base64")
      : btoa(binary);

  return `data:audio/wav;base64,${base64}`;
}

export function generateWaveformPeaks(bars = 36, seed = 1): number[] {
  const result: number[] = [];
  for (let i = 0; i < bars; i++) {
    const v =
      0.22 +
      0.45 * Math.abs(Math.sin((i + seed) * 0.45)) +
      0.3 * Math.abs(Math.cos((i * 1.7 + seed) * 0.3));
    result.push(Math.min(1, Math.max(0.16, Number(v.toFixed(2)))));
  }
  return result;
}
