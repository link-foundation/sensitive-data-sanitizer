#!/usr/bin/env node
// Smoke test for vendored Betterleaks rules: builds runtime sample tokens
// (never literal credentials) and prints which rule redacts them.
import { inspect } from '../../src/index.js';

const alnum = 'aB3dE5gH7jK9mN2pQ4sT6vW8yZ1cF0xR';
const repeat = (length) =>
  alnum.repeat(Math.ceil(length / alnum.length)).slice(0, length);
const samples = [
  [
    'cerebras',
    `CEREBRAS_API_KEY=${['csk', '-'].join('')}${repeat(48).toLowerCase()}`,
  ],
  ['xai', `key ${['xai', '-'].join('')}${repeat(80)}`],
  ['groq', `GROQ=${['gsk', '_'].join('')}${repeat(52)}`],
  ['cloudflare cfut', `token ${['cfut', '_'].join('')}${repeat(40)}0a1b2c3d `],
  ['unkey weak', `${['unkey', '_'].join('')}${'a'.repeat(24)}`],
  ['plain prose', 'a cold mistral wind blew over the hills'],
];
for (const [label, text] of samples) {
  const findings = await inspect(text);
  console.log(label.padEnd(14), findings.map((f) => f.rule).join(', ') || '-');
}
