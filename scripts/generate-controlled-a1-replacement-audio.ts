import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

process.loadEnvFile('.env.local');

const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
const voice = process.env.AZURE_SPEECH_VOICE || 'ja-JP-NanamiNeural';
const rate = process.env.AZURE_SPEECH_RATE || '-5%';
if (!key || !region) throw new Error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are required.');

const pack = JSON.parse(
  await readFile('data/production/controlled-a1-replacement-500.json', 'utf8'),
) as {
  questions: Array<{ id: string; section: string; audioSrc?: string }>;
  audioScripts: Record<string, string>;
};
const listening = pack.questions.filter((question) => question.section === 'listening');
const escapeXml = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!,
  );

let cursor = 0;
let created = 0;
let cached = 0;

async function synthesize(question: (typeof listening)[number]) {
  if (!question.audioSrc) throw new Error(`${question.id}: missing audioSrc.`);
  const script = pack.audioScripts[question.id];
  if (!script) throw new Error(`${question.id}: missing audio script.`);
  const output = join(process.cwd(), 'public', question.audioSrc.replace(/^\//, ''));
  await mkdir(join(output, '..'), { recursive: true });
  if (existsSync(output) && (await stat(output)).size > 1000) {
    cached += 1;
    return;
  }

  const ssml = `<speak version="1.0" xml:lang="ja-JP"><voice name="${escapeXml(voice)}"><prosody rate="${escapeXml(rate)}">${escapeXml(script)}</prosody></voice></speak>`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key!,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'jft-simulator',
        },
        body: ssml,
      },
    );
    if (response.ok) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 1000) throw new Error(`${question.id}: audio is unexpectedly small.`);
      await writeFile(output, bytes);
      created += 1;
      return;
    }
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`${question.id}: Azure TTS HTTP ${response.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  throw new Error(`${question.id}: Azure TTS retries exhausted.`);
}

async function worker() {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= listening.length) return;
    await synthesize(listening[index]);
    if ((created + cached) % 25 === 0) console.log(`audio ${created + cached}/${listening.length}`);
  }
}

await Promise.all(Array.from({ length: 4 }, () => worker()));
console.log(JSON.stringify({ total: listening.length, created, cached, voice, rate }));
