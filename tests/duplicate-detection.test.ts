import { describe,expect,it } from 'vitest';
import { findNearDuplicates,textSimilarity } from '@/lib/server/duplicate-detection';
describe('duplicate detection',()=>{
  it('scores near-identical Japanese prompts higher than unrelated prompts',()=>{const near=textSimilarity('会社で電話をしてください。','会社で電話してください。');const far=textSimilarity('会社で電話をしてください。','駅で切符を買います。');expect(near>far).toBe(true);expect(near>0.5).toBe(true);});
  it('keeps normalized-empty punctuation prompts equivalent',()=>{
    const matches=findNearDuplicates(['…','!!!'],value=>value);
    expect(matches).toEqual([{a:'…',b:'!!!',score:1}]);
  });
});
