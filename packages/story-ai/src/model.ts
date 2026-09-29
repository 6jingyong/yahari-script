export type ModelProvider = 'openrouter' | 'chatgpt-account';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  jsonMode: boolean;
  apiKey?: string;
  baseUrl?: string;
  accountEndpoint?: string;
}

export function parseJson(text: string): unknown {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('模型没有返回完整 JSON；可能输出被截断。请重试或缩短故事。');
  }
}

function cancelled(signal: AbortSignal): void {
  if(signal.aborted) throw new Error('请求已取消或超时；已完成场景仍保留。');
}

async function readPayload(response: Response, signal: AbortSignal): Promise<unknown> {
  try {
    const payload=await response.json();
    cancelled(signal);
    return payload;
  } catch {
    cancelled(signal);
    throw new Error('平台返回了无法解析的响应；请稍后重试。');
  }
}

function chatCompletionText(payload: unknown): string | null {
  if(!payload||typeof payload!=='object'||Array.isArray(payload)) return null;
  const data=payload as {error?:unknown;choices?:Array<{finish_reason?:string;message?:{content?:string;refusal?:string}}>};
  const choice=data.choices?.[0];
  if(data.error || choice?.message?.refusal || choice?.finish_reason==='content_filter') throw new Error('平台拒绝生成或返回错误，当前剧本未更改。');
  if(choice?.finish_reason==='length') throw new Error('模型输出被截断，请缩短故事或改用输出额度更高的模型。');
  return typeof choice?.message?.content==='string'?choice.message.content:null;
}

export async function requestJson(
  config: ModelConfig,
  system: string,
  user: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  cancelled(signal);

  if(config.provider==='chatgpt-account') {
    const endpoint=(config.accountEndpoint||'/api/chatgpt/responses').trim();
    if(!endpoint.startsWith('/') || endpoint.startsWith('//')) throw new Error('ChatGPT 账户通道必须使用同源站点接口。');
    let response: Response;
    try {
      response=await fetcher(endpoint,{
        method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:config.model.trim()||null,system,user,jsonMode:config.jsonMode}),
      });
    } catch {
      if(signal.aborted) throw new Error('请求已取消或超时；已完成场景仍保留。');
      throw new Error('ChatGPT 账户通道连接失败。请确认当前部署已提供账户额度推理桥，或改用 OpenRouter。');
    }
    cancelled(signal);
    if(response.status===404 || response.status===501) throw new Error('当前部署未提供 ChatGPT 账户额度推理桥。请改用 OpenRouter；账户额度模式会在受支持的站点运行时接入后启用。');
    if(!response.ok) throw new Error(`ChatGPT 账户通道返回 HTTP ${response.status}。请检查登录状态或账户额度。`);
    const payload=await readPayload(response,signal);
    if(payload&&typeof payload==='object'&&!Array.isArray(payload)&&'output' in payload) return (payload as {output:unknown}).output;
    const text=chatCompletionText(payload);
    if(text!==null) return parseJson(text);
    if(payload&&typeof payload==='object'&&!Array.isArray(payload)&&typeof (payload as {content?:unknown}).content==='string') return parseJson((payload as {content:string}).content);
    throw new Error('ChatGPT 账户通道未返回可用 JSON。');
  }

  const baseUrl=(config.baseUrl||'https://openrouter.ai/api/v1').trim();
  let url: URL;
  try {
    url=new URL(baseUrl.replace(/\/+$/,'')+'/chat/completions');
  } catch {
    throw new Error('OpenRouter API 地址不正确。');
  }
  if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash) throw new Error('OpenRouter API 地址必须是无凭据、无查询参数的 HTTPS 基础地址。');
  const apiKey=config.apiKey?.trim()||'';
  if(!apiKey || !config.model.trim()) throw new Error('请填写 OpenRouter API Key 和模型 ID。');
  let response: Response;
  try {
    response=await fetcher(url,{
      method:'POST',redirect:'error',signal,
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
      body:JSON.stringify({
        model:config.model.trim(),
        messages:[{role:'system',content:system},{role:'user',content:user}],
        ...(config.jsonMode?{response_format:{type:'json_object'}}:{}),
        stream:false,
      }),
    });
  } catch {
    if(signal.aborted) throw new Error('请求已取消或超时；已完成场景仍保留。');
    throw new Error('OpenRouter 连接失败。请检查网络，以及浏览器是否允许访问 OpenRouter。');
  }
  cancelled(signal);
  if(!response.ok) throw new Error(`OpenRouter 返回 HTTP ${response.status}。${response.status===401?'请检查 API Key。':response.status===429?'额度不足或请求过快。':'请检查模型 ID；若模型不支持 JSON 模式，可关闭后重试。'}`);
  const payload=await readPayload(response,signal);
  const text=chatCompletionText(payload);
  if(text===null) throw new Error('OpenRouter 响应未返回可用文本。');
  return parseJson(text);
}
