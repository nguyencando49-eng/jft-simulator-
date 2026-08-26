import { readFile, writeFile } from 'node:fs/promises';

type Artifact = {
  records: Array<{
    question: Record<string, unknown> & { id: string; section: string };
    audioScript?: string;
  }>;
};

const questions: Array<Record<string, unknown>> = [];
const audioScripts: Record<string, string> = {};

for (let batchNumber = 38; batchNumber <= 62; batchNumber += 1) {
  const batch = String(batchNumber).padStart(3, '0');
  const artifact = JSON.parse(
    await readFile(`data/production/controlled-a1-batch-${batch}.json`, 'utf8'),
  ) as Artifact;

  for (const record of artifact.records) {
    const question = {
      ...record.question,
      status: 'review',
      audioSrc:
        record.question.section === 'listening'
          ? `/audio/controlled-a1-500/${record.question.id.toLowerCase()}.mp3`
          : undefined,
      tags: Array.from(
        new Set([
          ...((record.question.tags as string[]) ?? []),
          'replacement-batch:CONTROLLED-A1-500-V1',
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

if (questions.length !== 500) throw new Error(`Expected 500 questions, received ${questions.length}.`);
if (new Set(questions.map((question) => question.id)).size !== 500) throw new Error('Duplicate question ID.');
if (Object.keys(audioScripts).length !== 125) throw new Error('Expected 125 Listening scripts.');

await writeFile(
  'data/production/controlled-a1-replacement-500.json',
  `${JSON.stringify(
    {
      releaseVersion: 'CONTROLLED_A1_500_V1',
      sourceBatches: { first: 38, last: 62 },
      generatedAt: new Date().toISOString(),
      questions,
      audioScripts,
    },
    null,
    2,
  )}\n`,
);

console.log(JSON.stringify({ questions: questions.length, listening: Object.keys(audioScripts).length }));
