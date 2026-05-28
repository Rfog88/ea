// G.711 µ-law (8kHz) <-> PCM16 transcoding.
// Twilio Media Streams send/expect 8kHz µ-law base64. Gemini Live expects 16kHz
// 16-bit little-endian PCM on input and emits 24kHz PCM16 on output (per the Live
// API audio contract). We therefore:
//   inbound  (Twilio->Gemini): µ-law 8k  -> PCM16 8k -> upsample x2 -> PCM16 16k
//   outbound (Gemini->Twilio): PCM16 24k -> downsample to 8k -> µ-law 8k
//
// Linear interpolation is sufficient for speech-band telephony audio. No external deps.

const BIAS = 0x84;
const CLIP = 32635;

// --- µ-law decode/encode (single sample) ---

export function muLawDecodeSample(uVal) {
  uVal = ~uVal & 0xff;
  let t = ((uVal & 0x0f) << 3) + BIAS;
  t <<= (uVal & 0x70) >> 4;
  return (uVal & 0x80) ? BIAS - t : t - BIAS;
}

export function muLawEncodeSample(sample) {
  let sign = (sample >> 8) & 0x80;
  if (sign) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; exponent--, mask >>= 1);
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

// --- Buffer-level conversions ---

// µ-law 8kHz buffer -> PCM16 16kHz buffer (decode + 2x linear upsample).
export function mulawToPcm16(mulawBuf) {
  const n = mulawBuf.length;
  const out = Buffer.allocUnsafe(n * 2 * 2); // 2x samples, 2 bytes each
  let prev = muLawDecodeSample(mulawBuf[0]);
  for (let i = 0; i < n; i++) {
    const cur = muLawDecodeSample(mulawBuf[i]);
    const mid = (prev + cur) >> 1;
    out.writeInt16LE(clamp16(mid), i * 4);
    out.writeInt16LE(clamp16(cur), i * 4 + 2);
    prev = cur;
  }
  return out;
}

// PCM16 (sourceRate, default 24000) -> µ-law 8kHz buffer (downsample + encode).
export function pcm16ToMulaw(pcmBuf, sourceRate = 24000) {
  const samples = pcmBuf.length / 2;
  const ratio = sourceRate / 8000;
  const outLen = Math.floor(samples / ratio);
  const out = Buffer.allocUnsafe(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = Math.floor(i * ratio) * 2;
    const s = pcmBuf.readInt16LE(Math.min(srcIdx, pcmBuf.length - 2));
    out[i] = muLawEncodeSample(s);
  }
  return out;
}

function clamp16(v) {
  return v > 32767 ? 32767 : v < -32768 ? -32768 : v;
}
