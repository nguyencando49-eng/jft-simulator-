import type {ExamDraft, QuestionRecord} from '@/lib/admin-types';
import type {Question} from '@/lib/types';
import {isA1OnlyDraft, loadA1ReleaseBank} from './a1-release-bank';
import {loadA21ReleaseBank} from './a21-release-bank';

export type RuntimeReleaseLevel=Question['level'];

export function draftReleaseLevel(draft:ExamDraft):RuntimeReleaseLevel|null {
  const levels=Array.from(new Set(draft.rules.flatMap(rule=>rule.levels)));
  if(levels.length!==1) return null;
  return levels[0] ?? null;
}

export async function loadReleaseBankForDraft(draft:ExamDraft):Promise<{
  source:'release'|'repository';
  releaseLevel:RuntimeReleaseLevel|null;
  questions:QuestionRecord[];
  releaseVersion?:string;
  releaseHash?:string;
}> {
  if(isA1OnlyDraft(draft)) {
    const loaded=await loadA1ReleaseBank();
    return {source:'release',releaseLevel:'A1',questions:loaded.questions,releaseVersion:loaded.manifest.releaseVersion,releaseHash:loaded.manifest.releaseBankHash};
  }
  const level=draftReleaseLevel(draft);
  if(level==='A2.1') {
    const loaded=await loadA21ReleaseBank();
    return {source:'release',releaseLevel:'A2.1',questions:loaded.questions,releaseVersion:loaded.manifest.releaseVersion,releaseHash:loaded.manifest.releaseBankHash};
  }
  return {source:'repository',releaseLevel:level,questions:[]};
}
