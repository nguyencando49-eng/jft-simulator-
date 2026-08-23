import {
  JFT_ALIGNMENT_PROMPT_VERSION,
  JFT_ALIGNMENT_REFERENCE_VERSION,
  JFT_ALIGNMENT_SYSTEM_PROMPT_V1,
  JFT_ALIGNMENT_TAXONOMY_VERSION,
  type JftAlignmentAnalysis,
  type JftAlignmentClassificationInput,
  type JftAlignmentConfidence,
  type JftAlignmentDependency,
  type JftAlignmentIndependentAssessment,
  type JftAlignmentRealWorldValidity,
} from './jft-alignment';
import type { JftCategory } from './content-taxonomy';

export interface JftAlignmentProvider {
  name:string;
  model?:string;
  classify(input:JftAlignmentClassificationInput):Promise<unknown>;
}

function normalized(value:string){return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}_]+/gu,'')}
function containsChoice(stem:string,choices:string[]){const visible=normalized(stem);return choices.some(choice=>{const value=normalized(choice);return value.length>=2&&visible.includes(value)})}
function hasDialogue(value:string){return /(?:^|\n)\s*(?:A|B|客|店員|男の人|女の人|先生|学生|受付)\s*[:：]/imu.test(value)||/(?:A|B)[:：][\s\S]*(?:A|B)[:：]/iu.test(value)}
function result(
  input:JftAlignmentClassificationInput,
  assessment:JftAlignmentIndependentAssessment,
  dependency:JftAlignmentDependency,
  validity:JftAlignmentRealWorldValidity,
  options:{confidence?:JftAlignmentConfidence;underrepresented?:boolean;clues?:string[];referenceComplete?:boolean;categoryCertain?:boolean;multiple?:JftCategory[];evidence?:Partial<JftAlignmentAnalysis['classificationEvidence']>}={},
):JftAlignmentAnalysis {
  const evidence=options.evidence||{};
  return {
    qaVersion:JFT_ALIGNMENT_PROMPT_VERSION,
    questionId:input.questionId,
    confidence:options.confidence||'HIGH',
    independentAssessment:assessment,
    modalityDependency:dependency,
    taskValidity:{realWorldValidity:validity,constructUnderrepresented:!!options.underrepresented,constructIrrelevantClues:options.clues||[]},
    classificationEvidence:{
      section:evidence.section||`The learner operation is best represented by ${assessment.actualSection}.`,
      category:evidence.category||`The answer requires the ${assessment.actualCategory} task rather than a topic-based classification.`,
      canDo:evidence.canDo||assessment.actualCanDo,
      taskType:evidence.taskType||assessment.actualAssessmentTarget,
      modalityDependency:evidence.modalityDependency||`Required modality ${assessment.requiredModality} has ${dependency.toLowerCase()} answer dependency.`,
    },
    uncertainty:{referenceEvidenceComplete:options.referenceComplete??true,categoryCertain:options.categoryCertain??true,multiplePlausibleCategories:options.multiple||[]},
  };
}

function assessment(section:JftAlignmentIndependentAssessment['actualSection'],category:JftAlignmentIndependentAssessment['actualCategory'],canDo:string,target:string,modality:JftAlignmentIndependentAssessment['requiredModality'],purpose:string):JftAlignmentIndependentAssessment {
  return {actualSection:section,actualCategory:category,actualCanDo:canDo,actualAssessmentTarget:target,actualTaskType:category==='UNDETERMINED'?'UNDETERMINED':category,requiredModality:modality,communicativePurpose:purpose};
}

/**
 * Bounded, deterministic local classifier for tests and development. Production
 * semantic alignment should use an independently calibrated HTTP provider.
 */
export class MockJftAlignmentProvider implements JftAlignmentProvider {
  name='mock-jft-alignment';
  model='deterministic-alignment-v1';
  async classify(input:JftAlignmentClassificationInput):Promise<JftAlignmentAnalysis>{
    const instruction=input.instruction||'',stem=input.stem||'',audio=input.audioScript||'',visible=`${instruction}\n${stem}`,all=`${visible}\n${audio}`;
    const readingCue=/読み方|よみかた|何と読み|どう読み/iu.test(visible);
    const visualCue=/画像|写真|イラスト|図を見|絵を見|look at (?:the )?(?:image|picture|diagram)/iu.test(visible);
    const dialogue=hasDialogue(audio);
    const visibleAnswer=containsChoice(stem,input.choices);

    if(visualCue&&!input.visualEvidence?.present){
      return result(input,assessment('UNDETERMINED','UNDETERMINED','UNDETERMINED','Understand information in a required visual.','VISUAL','visual information retrieval'),'NONE','PLAUSIBLE',{confidence:'MEDIUM',referenceComplete:false,categoryCertain:false,evidence:{section:'The item explicitly requires a visual, but no visual evidence was supplied.',category:'A category cannot be inferred without the missing visual.',modalityDependency:'The required visual dependency cannot be assessed because the visual is absent.'}});
    }
    if(readingCue){
      return result(input,assessment('script_vocabulary','kanji_reading','Recognize the reading of a Japanese kanji.','Recognize the reading of an isolated kanji.','TEXT','kanji reading'),'STRONG','PLAUSIBLE',{underrepresented:!!audio||/文章|文を読|読んで/iu.test(instruction),evidence:{section:'The learner only needs to identify a kanji pronunciation.',category:'The explicit task asks for 読み方, which is kanji reading.'}});
    }

    const grammarCue=/（\s*[　 ]*\s*）|\(\s*\)|＿{2,}|_{2,}/u.test(stem)&&/入る|完成|正しい|助詞|形|いちばんいい|complete|particle|grammar/iu.test(visible);
    const conversationBlank=grammarCue&&/(?:^|\n)\s*(?:A|B)\s*[:：]/imu.test(stem);
    if(grammarCue&&!conversationBlank){
      return result(input,assessment('conversation_expression','grammar','Choose a grammatical form that completes a sentence.','Select the grammatical form or particle that completes the sentence.','TEXT','grammatical form selection'),'STRONG','ARTIFICIAL');
    }
    if(conversationBlank||(/会話|response|返事/iu.test(instruction)&&/(?:A|B)\s*[:：]/iu.test(stem))){
      return result(input,assessment('conversation_expression','expression','Choose an appropriate expression for a conversational situation.','Select an appropriate response for the speaker intent and situation.','TEXT','communicative response selection'),'STRONG','PLAUSIBLE');
    }

    if(input.audioScript?.trim()){
      if(visibleAnswer){
        const clues=['Visible question text repeats an answer option, so audio is not needed to discriminate the answer.'];
        const practical=/【|営業時間|予定表|時刻表|お知らせ|メニュー|メール|メッセージ/iu.test(stem);
        return result(input,assessment(practical?'reading':'script_vocabulary',practical?'information_search':'word_meaning',practical?'Locate visible practical information in written text.':'Recognize information stated directly in visible text.',practical?'Locate the answer from visible written information.':'Match visible wording to an option.','TEXT',practical?'information retrieval':'visible-text recognition'),'NONE',practical?'PLAUSIBLE':'ARTIFICIAL',{clues,underrepresented:true,evidence:{modalityDependency:'The decisive option is already present in learner-visible text; audio only repeats or confirms it.'}});
      }
      const announcement=/店内放送|お知らせ|ご案内|アナウンス|announcement|まもなく|運休|閉店/iu.test(audio);
      const service=/店員|お客様|客[:：]|受付|病院|市役所|銀行|郵便局|スーパー|レジ|shop|reception/iu.test(audio);
      const category=announcement?'announcement_instruction':dialogue&&service?'shop_public':dialogue?'conversation':/ください|してください|までに|始めます|案内|指示/iu.test(audio)?'announcement_instruction':'conversation';
      const canDo=category==='conversation'?'Understand key information in a simple conversation.':category==='shop_public'?'Understand key information in a shop or public-service interaction.':'Understand a simple spoken announcement or instruction.';
      const purpose=category==='conversation'?'conversation comprehension':category==='shop_public'?'shop or public-life communication':'announcement or instruction comprehension';
      return result(input,assessment('listening',category,canDo,`Process audio to ${purpose}.`,'AUDIO',purpose),'STRONG','AUTHENTIC',{confidence:category==='conversation'&& !dialogue?'MEDIUM':'HIGH',categoryCertain:category!=='conversation'||dialogue,referenceComplete:category!=='conversation'||dialogue,evidence:{modalityDependency:'No answer option is supplied by the visible stem; the discriminating fact must be recovered from the audio script.'}});
    }

    const practicalReading=/【|営業時間|予定表|時刻表|お知らせ|メニュー|メール|メッセージ|掲示|schedule|opening hours|notice|poster/iu.test(stem);
    const readingInstruction=/文章|文を読|読んで|read (?:the )?(?:text|notice|message|schedule)/iu.test(instruction);
    if(practicalReading||readingInstruction){
      const search=/営業時間|予定表|時刻表|メニュー|料金|何時|いつ|どこ|いくら|schedule|opening|closing|price|when|where/iu.test(stem);
      const category=search?'information_search':'content_comprehension';
      const hasPassage=practicalReading||stem.split(/[。！？\n]/u).filter(Boolean).length>=2;
      if(!hasPassage){
        return result(input,assessment('script_vocabulary','word_meaning','Understand an isolated word or sentence.','Answer from the question itself without processing a passage.','TEXT','visible-text recognition'),'NONE','ARTIFICIAL',{underrepresented:true,clues:['The reading instruction has no answer-discriminating passage.'],evidence:{modalityDependency:'No separate written material is necessary to answer the question.'}});
      }
      const canDo=search?'Locate and match practical information in a written schedule or notice.':'Understand key content and intent in a practical written text.';
      return result(input,assessment('reading',category,canDo,search?'Locate a requested fact in practical written information.':'Understand the content or intent of a practical written message.','TEXT',search?'written information retrieval':'written content comprehension'),'STRONG','AUTHENTIC');
    }

    if(/意味|どういう意味|word mean|meaning of/iu.test(visible))return result(input,assessment('script_vocabulary','word_meaning','Understand the meaning of a Japanese word.','Identify the lexical meaning of an isolated word.','TEXT','word-meaning recognition'),'STRONG','PLAUSIBLE');
    if(/使い方|使って|文として正しい|usage|used correctly/iu.test(visible))return result(input,assessment('script_vocabulary','word_usage','Choose appropriate word usage in context.','Identify contextually appropriate word usage.','TEXT','word-usage recognition'),'STRONG','PLAUSIBLE');
    if(/漢字|かんじ/iu.test(visible))return result(input,assessment('script_vocabulary','kanji_meaning_usage','Understand the meaning or contextual use of a kanji expression.','Identify kanji meaning or usage.','TEXT','kanji meaning recognition'),'STRONG','PLAUSIBLE');

    return result(input,assessment('script_vocabulary','word_usage','Choose language that fits a short written context.','Identify contextual word usage from visible text.','TEXT','contextual language recognition'),'STRONG','PLAUSIBLE',{confidence:'MEDIUM',referenceComplete:false,categoryCertain:false,multiple:['word_meaning','word_usage'],evidence:{category:'The content lacks enough structure to distinguish word meaning from word usage confidently.'}});
  }
}

export class HttpJftAlignmentProvider implements JftAlignmentProvider {
  name='http-jft-alignment';
  model=process.env.JFT_ALIGNMENT_MODEL||'external';
  async classify(input:JftAlignmentClassificationInput):Promise<unknown>{
    const endpoint=process.env.JFT_ALIGNMENT_ENDPOINT;if(!endpoint)throw new Error('JFT_ALIGNMENT_ENDPOINT is required for the HTTP provider.');
    const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(process.env.JFT_ALIGNMENT_API_KEY?{authorization:`Bearer ${process.env.JFT_ALIGNMENT_API_KEY}`}:{})},body:JSON.stringify({task:'jft_alignment_classification',promptVersion:JFT_ALIGNMENT_PROMPT_VERSION,referenceVersion:JFT_ALIGNMENT_REFERENCE_VERSION,taxonomyVersion:JFT_ALIGNMENT_TAXONOMY_VERSION,systemPrompt:JFT_ALIGNMENT_SYSTEM_PROMPT_V1,input})});
    if(!response.ok)throw new Error(`JFT alignment provider failed: ${response.status}`);
    return response.json();
  }
}

export function getJftAlignmentProvider():JftAlignmentProvider{return process.env.JFT_ALIGNMENT_PROVIDER==='http'?new HttpJftAlignmentProvider():new MockJftAlignmentProvider()}
