export type ModelPurpose = 'text' | 'image';

export interface OpenRouterModel {
  id: string;
  name: string;
  outputModalities: string[];
  pricing: { prompt?: string; completion?: string; image?: string; request?: string };
  supportedParameters: string[];
  capabilities?: Record<string,{type?:string;values?:string[]}>;
}

export async function listOpenRouterModels(
  apiKey: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  purpose: ModelPurpose = 'text',
): Promise<OpenRouterModel[]> {
  if (!apiKey.trim()) throw new Error('请先在 AI 连接设置中填写 OpenRouter API Key。');
  let response: Response;
  try {
    const endpoint = purpose === 'image' ? 'https://openrouter.ai/api/v1/images/models'
      : 'https://openrouter.ai/api/v1/models?output_modalities=text';
    response = await fetcher(endpoint, {
      method: 'GET', redirect: 'error', credentials: 'omit', signal,
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
    });
  } catch {
    if (signal.aborted) throw new Error('获取模型列表已取消或超时。');
    throw new Error('无法连接 OpenRouter 获取模型列表；仍可手动填写模型 ID。');
  }
  if (!response.ok) throw new Error(`获取模型列表失败：HTTP ${response.status}。请检查连接设置。`);
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new Error('OpenRouter 模型列表格式不正确。'); }
  if (signal.aborted) throw new Error('获取模型列表已取消或超时。');
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) {
    throw new Error('OpenRouter 模型列表格式不正确。');
  }
  return payload.data.flatMap((value: unknown) => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id) return [];
    const architecture = item.architecture && typeof item.architecture === 'object'
      ? item.architecture as Record<string, unknown> : {};
    const pricing = item.pricing && typeof item.pricing === 'object'
      ? item.pricing as Record<string, unknown> : {};
    return [{
      id: item.id,
      name: typeof item.name === 'string' ? item.name : item.id,
      outputModalities: Array.isArray(architecture.output_modalities)
        ? architecture.output_modalities.filter((part): part is string => typeof part === 'string') : [],
      pricing: Object.fromEntries(['prompt', 'completion', 'image', 'request']
        .filter(key => typeof pricing[key] === 'string').map(key => [key, pricing[key]])) as OpenRouterModel['pricing'],
      supportedParameters: Array.isArray(item.supported_parameters)
        ? item.supported_parameters.filter((part): part is string => typeof part === 'string')
        : item.supported_parameters && typeof item.supported_parameters === 'object'
          ? Object.keys(item.supported_parameters) : [],
      ...(item.supported_parameters && typeof item.supported_parameters==='object' && !Array.isArray(item.supported_parameters)
        ? {capabilities:item.supported_parameters as Record<string,{type?:string;values?:string[]}>} : {}),
    }];
  });
}

export function modelsForPurpose(models: readonly OpenRouterModel[], purpose: ModelPurpose): OpenRouterModel[] {
  const matching = models.filter(model => model.outputModalities.includes(purpose));
  if (purpose === 'image') return matching.sort((a, b) => a.name.localeCompare(b.name));
  if (!matching.some(model => model.id === 'openrouter/free')) {
    matching.unshift({ id: 'openrouter/free', name: 'Free Models Router', outputModalities: ['text'],
      pricing: { prompt: '0', completion: '0', request: '0' }, supportedParameters: [] });
  }
  return matching.sort((a, b) => Number(isFreeModel(b)) - Number(isFreeModel(a)) || a.name.localeCompare(b.name));
}

export function isFreeModel(model: OpenRouterModel): boolean {
  if (model.id === 'openrouter/free') return true;
  const values = Object.values(model.pricing);
  return values.length > 0 && values.every(value => typeof value === 'string' && value.trim() !== '' && Number(value) === 0);
}
