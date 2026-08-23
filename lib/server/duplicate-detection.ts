function normalize(s:string){return s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');}
function grams(s:string,n=3){const x=normalize(s);const set=new Set<string>();if(x.length<=n){if(x)set.add(x);return set;}for(let i=0;i<=x.length-n;i++)set.add(x.slice(i,i+n));return set;}
function gramSimilarity(A:Set<string>,B:Set<string>){if(!A.size&&!B.size)return 1;let inter=0;for(const x of A)if(B.has(x))inter++;return inter/(A.size+B.size-inter||1);}
export function textSimilarity(a:string,b:string){return gramSimilarity(grams(a),grams(b));}
export function findNearDuplicates<T>(items:T[],text:(x:T)=>string,threshold=.82){
  const prepared=items.map(item=>({item,grams:grams(text(item))}));
  const out:Array<{a:T;b:T;score:number}>=[];
  for(let i=0;i<prepared.length;i++)for(let j=i+1;j<prepared.length;j++){
    const left=prepared[i],right=prepared[j];
    if(!left.grams.size&&!right.grams.size){
      if(threshold<=1)out.push({a:left.item,b:right.item,score:1});
      continue;
    }
    if(threshold>0&&Math.min(left.grams.size,right.grams.size)/Math.max(1,Math.max(left.grams.size,right.grams.size))<threshold)continue;
    const score=gramSimilarity(left.grams,right.grams);if(score>=threshold)out.push({a:left.item,b:right.item,score});
  }
  return out;
}
