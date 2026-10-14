import { IMAGE_DATA_URL } from './project-assets.js';
import { IMAGE_POLICY, fittedImageSize } from './asset-image-policy.js';
export { addOriginalCharacter, embeddedCourtroomPack, embeddedResources } from './project-assets.js';

export interface CharacterImageRequest {
  provider: 'openrouter' | 'chatgpt-account';
  model: string;
  prompt: string;
  apiKey?: string;
  baseUrl?: string;
  accountEndpoint?: string;
  referenceImage?: string;
  transparent?: boolean;
  capabilities?: Record<string,{type?:string;values?:string[]}>;
}

export async function requestCharacterImage(
  input: CharacterImageRequest, signal: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<string> {
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > 4000) throw new Error('请用 4000 字以内描述角色。');
  let endpoint: string;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const model = input.model.trim();
  if (input.referenceImage && (!IMAGE_DATA_URL.test(input.referenceImage) || input.referenceImage.length>1_000_000)) throw new Error('参考图片格式不正确或文件过大。');
  const options:Record<string,unknown>={};
  if (input.capabilities?.output_format) {
    const values=input.capabilities.output_format.values;
    const format=['png','webp','jpeg'].find(value=>!values || values.includes(value));
    if (format) options.output_format=format;
  }
  if (input.transparent && options.output_format!=='jpeg' && input.capabilities?.background && (!input.capabilities.background.values || input.capabilities.background.values.includes('transparent')))
    options.background='transparent';
  if (input.referenceImage) options.input_references=[{type:'image_url',image_url:{url:input.referenceImage}}];
  if (input.provider === 'openrouter') {
    if (!model || !input.apiKey?.trim()) throw new Error('请填写图片模型 ID 和 OpenRouter API Key。');
    const base = new URL((input.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '') + '/images');
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('OpenRouter 地址必须使用 HTTPS。');
    endpoint = base.href;
    headers.Authorization = `Bearer ${input.apiKey.trim()}`;
  } else {
    endpoint = input.accountEndpoint || '/api/chatgpt/images';
    if (!endpoint.startsWith('/') || endpoint.startsWith('//')) throw new Error('账户通道必须使用同源接口。');
  }
  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: 'POST', redirect: 'error', signal, headers,
      body: JSON.stringify({ model: model || null, prompt, n: 1, ...options }),
    });
  } catch {
    if (signal.aborted) throw new Error('图片生成已取消。');
    throw new Error('图片生成连接失败，请检查网络和模型设置。');
  }
  if (signal.aborted) throw new Error('图片生成已取消。');
  if (input.provider === 'chatgpt-account' && (response.status === 404 || response.status === 501)) {
    throw new Error('当前站点未提供 ChatGPT 账户图片生成桥。请使用 OpenRouter，或手动上传角色图片。');
  }
  if (!response.ok) throw new Error(`图片生成失败：HTTP ${response.status}。${response.status===402?'OpenRouter 绘图需要可用余额，请先充值或使用手动上传。':'请检查模型、额度和参数支持。'}`);
  const payload = await response.json() as { data?: Array<{ b64_json?: string; media_type?: string }> };
  if (signal.aborted) throw new Error('图片生成已取消。');
  const first = payload.data?.[0];
  const encoded=first?.b64_json??'';
  const mime = first?.media_type || (encoded.startsWith('iVBORw0KGgo')?'image/png':encoded.startsWith('/9j/')?'image/jpeg':encoded.startsWith('UklGR')?'image/webp':'');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime) || !first?.b64_json) {
    throw new Error('模型没有返回可用的 PNG、JPEG 或 WebP 图片。');
  }
  const url = `data:${mime};base64,${first.b64_json}`;
  if (!IMAGE_DATA_URL.test(url) || url.length > 12_000_000) throw new Error('生成图片格式不正确或文件过大。');
  return url;
}

export async function normalizeCharacterImage(source: string): Promise<string> {
  if (!IMAGE_DATA_URL.test(source)) throw new Error('只支持 PNG、JPEG、WebP 图片。');
  const image = new Image();
  image.src = source;
  await image.decode();
  const size=fittedImageSize(image.naturalWidth,image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  let result = canvas.toDataURL('image/webp', IMAGE_POLICY.quality);
  if (result.length > IMAGE_POLICY.maxDataUrlChars) {
    const smaller = document.createElement('canvas');
    smaller.width = Math.max(1, Math.round(canvas.width * IMAGE_POLICY.fallbackScale));
    smaller.height = Math.max(1, Math.round(canvas.height * IMAGE_POLICY.fallbackScale));
    smaller.getContext('2d')!.drawImage(canvas, 0, 0, smaller.width, smaller.height);
    result = smaller.toDataURL('image/webp', IMAGE_POLICY.fallbackQuality);
  }
  if (!IMAGE_DATA_URL.test(result) || result.length > IMAGE_POLICY.maxDataUrlChars) throw new Error('图片压缩后仍然过大，请换一张图片。');
  return result;
}
