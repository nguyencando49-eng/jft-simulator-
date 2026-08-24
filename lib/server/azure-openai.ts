export const AZURE_OPENAI_PROVIDER = 'azure-openai' as const;

export interface AzureOpenAiJsonRequest {
  endpoint: string;
  apiKey: string;
  deployment: string;
  systemPrompt: string;
  input: unknown;
  maxOutputTokens?: number;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

interface AzureOpenAiErrorBody {
  error?: { code?: string; message?: string };
}

interface AzureOpenAiChatBody {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
}
type AzureMessage = { content?: string | Array<{ type?: string; text?: string }> };

export class AzureOpenAiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AzureOpenAiError';
  }
}

function chatCompletionsUrl(endpoint: string) {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (!trimmed) throw new AzureOpenAiError('AZURE_OPENAI_NOT_CONFIGURED', 'Azure OpenAI endpoint is missing.');
  if (/\/chat\/completions(?:\?|$)/.test(trimmed)) return trimmed;
  return `${trimmed}/openai/v1/chat/completions`;
}

function messageText(message?: AzureMessage) {
  const value = message?.content;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(part => typeof part?.text === 'string' ? part.text : '').join('');
  return '';
}

function parseJsonContent(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!trimmed) throw new AzureOpenAiError('AZURE_OPENAI_INVALID_OUTPUT', 'Azure OpenAI returned an empty response.');
  try { return JSON.parse(trimmed) as unknown; }
  catch { throw new AzureOpenAiError('AZURE_OPENAI_INVALID_OUTPUT', 'Azure OpenAI did not return valid JSON.'); }
}

export async function requestAzureOpenAiJson<T>(request: AzureOpenAiJsonRequest): Promise<T> {
  const deployment = request.deployment.trim();
  const apiKey = request.apiKey.trim();
  if (!deployment) throw new AzureOpenAiError('AZURE_OPENAI_DEPLOYMENT_REQUIRED', 'Azure OpenAI deployment name is missing.');
  if (!apiKey) throw new AzureOpenAiError('AZURE_OPENAI_KEY_REQUIRED', 'Azure OpenAI API key is missing.');

  let response: Response;
  try {
    response = await fetch(chatCompletionsUrl(request.endpoint), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        model: deployment,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: JSON.stringify(request.input) },
        ],
        response_format: request.jsonSchema ? {type:'json_schema',json_schema:{name:request.jsonSchema.name,strict:true,schema:request.jsonSchema.schema}} : { type: 'json_object' },
        max_completion_tokens: request.maxOutputTokens ?? 4096,
      }),
    });
  } catch (error) {
    throw new AzureOpenAiError('AZURE_OPENAI_REQUEST_FAILED', error instanceof Error ? error.message : String(error));
  }

  let body: AzureOpenAiChatBody & AzureOpenAiErrorBody = {};
  try { body = await response.json() as AzureOpenAiChatBody & AzureOpenAiErrorBody; } catch { /* normalized below */ }
  if (!response.ok) {
    const providerCode = body.error?.code || `HTTP_${response.status}`;
    const code = providerCode === 'DeploymentNotFound' ? 'AZURE_OPENAI_DEPLOYMENT_NOT_FOUND' : 'AZURE_OPENAI_REQUEST_FAILED';
    const detail = body.error?.message ? ` ${body.error.message}` : '';
    throw new AzureOpenAiError(code, `Azure OpenAI request failed (${response.status}, ${providerCode}).${detail}`);
  }

  const text = messageText(body.choices?.[0]?.message);
  return parseJsonContent(text) as T;
}

export function azureOpenAiConfig(scope: 'factory' | 'qa') {
  const qa = scope === 'qa';
  return {
    endpoint: (qa ? process.env.AI_QA_ENDPOINT : process.env.AI_FACTORY_ENDPOINT) || process.env.AOAI_ENDPOINT || '',
    apiKey: (qa ? process.env.AI_QA_API_KEY : process.env.AI_FACTORY_API_KEY) || process.env.API_KEY || '',
    deployment: (qa ? process.env.AI_QA_MODEL : process.env.AI_FACTORY_MODEL) || process.env.AZURE_OPENAI_DEPLOYMENT || '',
  };
}
