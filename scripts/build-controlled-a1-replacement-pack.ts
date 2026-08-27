import { readFile, writeFile } from 'node:fs/promises';

type Artifact = {
  records: Array<{
    question: Record<string, unknown> & { id: string; section: string };
    audioScript?: string;
  }>;
};

const questions: Array<Record<string, unknown>> = [];
const audioScripts: Record<string, string> = {};

const sourceArtifacts = [
  'data/pilots/generator-recovery-a1-pilot.json',
  'data/pilots/generator-recovery-a1-pilot-2.json',
  ...Array.from({ length: 62 }, (_, index) => `data/production/controlled-a1-batch-${String(index + 1).padStart(3, '0')}.json`),
];

for (const sourceArtifact of sourceArtifacts) {
  const artifact = JSON.parse(await readFile(sourceArtifact, 'utf8')) as Artifact;

  for (const record of artifact.records) {
    const question = {
      ...record.question,
      status: 'review',
      audioSrc:
        record.question.section === 'listening'
          ? `/audio/controlled-a1-1320/${record.question.id.toLowerCase()}.mp3`
          : undefined,
      tags: Array.from(
        new Set([
          ...((record.question.tags as string[]) ?? []),
          'replacement-batch:CONTROLLED-A1-1320-V1',
          'qa-state:human-review-required',
        ]),
      ),
    };
    questions.push(question);
    if (record.question.section === 'listening') {
      if (!record.audioScript?.trim()) throw new Error(`${record.question.id}: missing audio script.`);
      audioScripts[record.question.id] = record.audioScript;
    }
  }
}

if (questions.length !== 1320) throw new Error(`Expected 1320 questions, received ${questions.length}.`);
if (new Set(questions.map((question) => question.id)).size !== 1320) throw new Error('Duplicate question ID.');
if (Object.keys(audioScripts).length !== 330) throw new Error('Expected 330 Listening scripts.');

await writeFile(
  'data/production/controlled-a1-replacement-1320.json',
  `${JSON.stringify(
    {
      releaseVersion: 'CONTROLLED_A1_1320_V1',
      sourceArtifacts,
      generatedAt: new Date().toISOString(),
      questions,
      audioScripts,
    },
    null,
    2,
  )}\n`,
);

console.log(JSON.stringify({ questions: questions.length, listening: Object.keys(audioScripts).length }));
