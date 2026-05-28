import { test } from "node:test";
import assert from "node:assert/strict";
import { muLawDecodeSample, muLawEncodeSample, mulawToPcm16, pcm16ToMulaw } from "../lib/transcode.js";

test("µ-law decode matches G.711 reference extremes", () => {
  assert.equal(muLawDecodeSample(0xff), 0);       // quietest
  assert.equal(muLawDecodeSample(0x00), -32124);  // most negative
  assert.equal(muLawDecodeSample(0x80), 32124);   // most positive
});

test("µ-law decode->encode is value-stable for every code", () => {
  // Byte-identity fails only at the dual-zero codes (0x7F and 0xFF both -> 0),
  // which is inherent to µ-law. The real property is that re-encoding produces a
  // code that decodes to the same PCM value.
  for (let b = 0; b < 256; b++) {
    const sample = muLawDecodeSample(b);
    const reDecoded = muLawDecodeSample(muLawEncodeSample(sample));
    assert.equal(reDecoded, sample, `code ${b} (value ${sample}) must be value-stable`);
  }
});

test("mulawToPcm16 doubles sample count (8k -> 16k upsample)", () => {
  const mulaw = Buffer.from([0x00, 0x7f, 0xff, 0x80]);
  const pcm = mulawToPcm16(mulaw);
  // 4 µ-law bytes -> 8 PCM16 samples -> 16 bytes
  assert.equal(pcm.length, 16);
});

test("pcm16ToMulaw downsamples 24k -> 8k (ratio 3)", () => {
  // 30 samples (60 bytes) at 24k -> 10 µ-law bytes at 8k
  const pcm = Buffer.alloc(60);
  for (let i = 0; i < 30; i++) pcm.writeInt16LE(((i % 7) - 3) * 1000, i * 2);
  const mulaw = pcm16ToMulaw(pcm, 24000);
  assert.equal(mulaw.length, 10);
});

test("silence stays near silence through a full round trip", () => {
  const mulawSilence = Buffer.alloc(160, muLawEncodeSample(0));
  const pcm16 = mulawToPcm16(mulawSilence);            // 8k -> 16k
  // emulate Gemini echoing back the same energy at 24k by re-stretching:
  const back = pcm16ToMulaw(pcm16, 16000);             // 16k -> 8k
  for (const b of back) {
    const v = muLawDecodeSample(b);
    assert.ok(Math.abs(v) < 16, `near-silence expected, got ${v}`);
  }
});
