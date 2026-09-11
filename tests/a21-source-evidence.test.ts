import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {hashA1ReleaseBank} from '@/lib/server/a1-release-bank';
import type {A1ReleaseBankArtifact,A1ReleaseManifest} from '@/lib/server/a1-release-bank';

type SourceDocument={sourceDocumentId:string;lessonId:string;lesson:number;sourcePath:string;status:string};
type SourceChunk={sourceDocumentId:string;lessonId:string;chunkId:string;chunkType:string;sourceText:string;normalizedText:string;sourceLocation:{document:string;paragraph:number};extractionConfidence:number};
type KnowledgeUnit={id:string;lessonId:string;sourceDocumentId:string;sourceChunkIds:string[];evidenceStatus:'SOURCE_VERIFIED'|'INFERRED_REVIEW_REQUIRED'|'UNSUPPORTED';approvedForGeneration:boolean};
type EvidenceMap={curriculumUnitId:string;lessonId:string;sourceDocumentId:string;knowledgeUnitId:string;planningCatalogStatus:string;knowledgeUnitStatus:string;approvedForGeneration:boolean;sourceChunkIds:string[]};

function readJson<T>(path:string):T {
  return JSON.parse(readFileSync(path,'utf8')) as T;
}

describe('A2.1 source evidence layer',()=>{
  const docs=readJson<{documents:SourceDocument[]}>('data/curriculum/a21/source-documents.json').documents;
  const chunks=readJson<{allowedChunkTypes:string[];chunks:SourceChunk[]}>('data/curriculum/a21/source-chunks.json');
  const units=readJson<{allowedStatuses:string[];knowledgeUnits:KnowledgeUnit[]}>('data/curriculum/a21/knowledge-units.json').knowledgeUnits;
  const map=readJson<{mappings:EvidenceMap[];coverage:Array<{lessonId:string;supportedGenerationSections:string[]}>;report:{finalClassification:string}}>('data/curriculum/a21/curriculum-evidence-map.json');

  it('extracts all 18 local Irodori 初級1 source documents',()=>{
    expect(docs).toHaveLength(18);
    expect(new Set(docs.map(doc=>doc.sourceDocumentId)).size).toBe(18);
    expect(docs.map(doc=>doc.lesson).sort((a,b)=>a-b)).toEqual(Array.from({length:18},(_,index)=>index+1));
    expect(docs.every(doc=>doc.sourcePath.startsWith('TAI LIEU SACH/初級1第'))).toBe(true);
    expect(docs.every(doc=>doc.status==='SOURCE_EXTRACTED')).toBe(true);
  });

  it('creates unique linked SourceChunks with allowed chunk types',()=>{
    expect(chunks.chunks.length).toBeGreaterThan(0);
    expect(new Set(chunks.chunks.map(chunk=>chunk.chunkId)).size).toBe(chunks.chunks.length);
    const docIds=new Set(docs.map(doc=>doc.sourceDocumentId));
    const allowed=new Set(chunks.allowedChunkTypes);
    for(const chunk of chunks.chunks) {
      expect(docIds.has(chunk.sourceDocumentId)).toBe(true);
      expect(chunk.sourceText.trim()).not.toBe('');
      expect(chunk.normalizedText.trim()).not.toBe('');
      expect(allowed.has(chunk.chunkType)).toBe(true);
      expect(chunk.extractionConfidence).toBeGreaterThanOrEqual(0);
      expect(chunk.extractionConfidence).toBeLessThanOrEqual(1);
    }
  });

  it('creates SOURCE_VERIFIED KnowledgeUnits without unsupported approved statuses',()=>{
    const chunkIds=new Set(chunks.chunks.map(chunk=>chunk.chunkId));
    const docIds=new Set(docs.map(doc=>doc.sourceDocumentId));
    expect(units).toHaveLength(18);
    expect(new Set(units.map(unit=>unit.id)).size).toBe(18);
    expect(units.every(unit=>unit.evidenceStatus==='SOURCE_VERIFIED')).toBe(true);
    expect(units.every(unit=>unit.approvedForGeneration)).toBe(true);
    for(const unit of units) {
      expect(docIds.has(unit.sourceDocumentId)).toBe(true);
      expect(unit.sourceChunkIds.length).toBeGreaterThan(0);
      expect(unit.sourceChunkIds.every(id=>chunkIds.has(id))).toBe(true);
      expect(unit.approvedForGeneration ? unit.evidenceStatus==='SOURCE_VERIFIED' : true).toBe(true);
    }
  });

  it('confirms every planning catalog unit by source evidence',()=>{
    expect(map.mappings).toHaveLength(18);
    expect(map.mappings.every(item=>item.planningCatalogStatus==='CONFIRMED_BY_SOURCE')).toBe(true);
    expect(map.mappings.every(item=>item.knowledgeUnitStatus==='SOURCE_VERIFIED')).toBe(true);
    expect(map.mappings.every(item=>item.approvedForGeneration)).toBe(true);
    expect(map.report.finalClassification).toBe('A21_SOURCE_EVIDENCE_READY');
  });

  it('reports section coverage without pretending every lesson supports every modality',()=>{
    const coverageBySection={
      script_vocabulary: map.coverage.filter(row=>row.supportedGenerationSections.includes('script_vocabulary')).length,
      conversation_expression: map.coverage.filter(row=>row.supportedGenerationSections.includes('conversation_expression')).length,
      listening: map.coverage.filter(row=>row.supportedGenerationSections.includes('listening')).length,
      reading: map.coverage.filter(row=>row.supportedGenerationSections.includes('reading')).length,
    };
    expect(coverageBySection.script_vocabulary).toBe(18);
    expect(coverageBySection.conversation_expression).toBeGreaterThan(0);
    expect(coverageBySection.listening).toBeGreaterThan(0);
    expect(coverageBySection.reading).toBeGreaterThan(0);
  });

  it('keeps closed A1 V1 release identity unchanged',()=>{
    const bank=readJson<A1ReleaseBankArtifact>('data/production/releases/a1-machine-bank-v1.json');
    const manifest=readJson<A1ReleaseManifest>('data/production/releases/a1-machine-bank-v1.manifest.json');
    expect(bank.questions).toHaveLength(486);
    expect(hashA1ReleaseBank(bank)).toBe('3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079');
    expect(manifest.releaseBankHash).toBe(hashA1ReleaseBank(bank));
  });
});
