export interface ModelConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  jsonMode: boolean;
}

export function parseJson(text: string): unknown {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('模型没有返回完整 JSON；可能输出被截断。请重试或缩短故事。');
  }
}

export async function requestJson(
  config: ModelConfig,
  system: string,
  user: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  let url: URL;
  try {
    url=new URL(config.baseUrl.replace(/\/+$/,'')+'/chat/completions');
  } catch {
    throw new Error('API 地址不正确。');
  }
  if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash) throw new Error('API 地址必须是无凭据、无查询参数的 HTTPS 基础地址。');
  if(!config.apiKey.trim() || !config.model.trim()) throw new Error('请填写 API Key 和模型 ID。');
  let response: Response;
  try {
    response=await fetcher(url,{
      method:'POST',
      redirect:'error',
      signal,
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.apiKey.trim()}`},
      body:JSON.stringify({
        model:config.model.trim(),
        messages:[{role:'system',content:system},{role:'user',content:user}],
        ...(config.jsonMode?{response_format:{type:'json_object'}}:{}),
        stream:false,
      }),
    });
  } catch {
    if(signal.aborted) throw new Error('请求已取消或超时；已完成场景仍保留。');
    throw new Error('连接失败。请检查网络、API 地址，以及平台是否允许浏览器跨域请求。');
  }
  if(!response.ok) throw new Error(`平台返回 HTTP ${response.status}。${response.status===401?'请检查密钥。':response.status===429?'额度不足或请求过快。':'请检查模型 ID、平台设置；若模型不支持 JSON 模式，可关闭后重试。'}`);
  const data=await response.json() as {error?:unknown;choices?:Array<{finish_reason?:string;message?:{content?:string;refusal?:string}}>};
  const choice=data.choices?.[0];
  if(data.error || choice?.message?.refusal || choice?.finish_reason==='content_filter') throw new Error('平台拒绝生成或返回错误，当前剧本未更改。');
  if(choice?.finish_reason==='length') throw new Error('模型输出被截断，请缩短故事或改用输出额度更高的模型。');
  if(typeof choice?.message?.content!=='string') throw new Error('平台未返回可用文本。');
  return parseJson(choice.message.content);
}
