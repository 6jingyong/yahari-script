import { listOpenRouterModels, modelsForPurpose, isFreeModel, type ModelPurpose, type OpenRouterModel } from '../../../packages/ai-providers/src/openrouter-models.js';
import { installChatGptConnection, type ChatGptConnection } from './chatgpt-connection.js';

export const AI_CONNECTION_KEY = 'yahari:ai:openrouter-connection:v1';

export interface OpenRouterConnection {
  apiKey: string;
  textModel: string;
  imageModel: string;
  remember: boolean;
}

const DEFAULT_CONNECTION: OpenRouterConnection = {
  apiKey: '', textModel: 'openrouter/free', imageModel: '', remember: true,
};

export function readOpenRouterConnection(storage: Storage): OpenRouterConnection {
  try {
    const raw = JSON.parse(storage.getItem(AI_CONNECTION_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object' || typeof raw.apiKey !== 'string') return { ...DEFAULT_CONNECTION };
    return {
      apiKey: raw.apiKey,
      textModel: typeof raw.textModel === 'string' ? raw.textModel : DEFAULT_CONNECTION.textModel,
      imageModel: typeof raw.imageModel === 'string' ? raw.imageModel : '',
      remember: true,
    };
  } catch { return { ...DEFAULT_CONNECTION }; }
}

export function writeOpenRouterConnection(storage: Storage, connection: OpenRouterConnection): void {
  if (connection.remember && connection.apiKey) storage.setItem(AI_CONNECTION_KEY, JSON.stringify(connection));
  else storage.removeItem(AI_CONNECTION_KEY);
}

export interface AiConnectionSettings {
  account: ChatGptConnection;
  imageCapabilities(model: string): Promise<OpenRouterModel['capabilities']>;
  key(): string;
  model(purpose: ModelPurpose): string;
  setModel(purpose: ModelPurpose, value: string): void;
  open(): void;
  refreshOptions(purpose: ModelPurpose, list: HTMLDataListElement, status: HTMLElement, force?: boolean): Promise<void>;
}

export function installAiConnectionSettings(storage: Storage): AiConnectionSettings {
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const dialog = get<HTMLDialogElement>('ai-settings-dialog');
  const account = installChatGptConnection(dialog);
  const keyInput = get<HTMLInputElement>('ai-key');
  const textInput = get<HTMLInputElement>('ai-text-model');
  const imageInput = get<HTMLInputElement>('ai-image-model');
  const rememberInput = get<HTMLInputElement>('ai-remember');
  const status = get<HTMLElement>('ai-status');
  let connection = readOpenRouterConnection(storage);
  const catalogs: Record<ModelPurpose, { models: OpenRouterModel[]; at: number; pending: Promise<OpenRouterModel[]> | null }> = {
    text: { models: [], at: 0, pending: null }, image: { models: [], at: 0, pending: null },
  };
  let connectionEpoch = 0;
  const optionEpoch = new WeakMap<HTMLDataListElement, number>();

  function persist(): void {
    writeOpenRouterConnection(storage, connection);
  }
  function resetCatalogs(): void {
    connectionEpoch++;
    for (const catalog of Object.values(catalogs)) { catalog.models = []; catalog.at = 0; catalog.pending = null; }
  }
  function updateFields(): void {
    keyInput.value = connection.apiKey;
    textInput.value = connection.textModel;
    imageInput.value = connection.imageModel;
    rememberInput.checked = connection.remember;
  }
  async function loadModels(purpose: ModelPurpose, force = false): Promise<OpenRouterModel[]> {
    if (!connection.apiKey) throw new Error('请先保存 OpenRouter API Key。');
    const catalog = catalogs[purpose];
    if (!force && catalog.models.length && Date.now() - catalog.at < 10 * 60_000) return catalog.models;
    if (catalog.pending) return catalog.pending;
    const epoch = connectionEpoch;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    const pending = listOpenRouterModels(connection.apiKey, controller.signal, fetch, purpose)
      .then(models => {
        if (epoch !== connectionEpoch) return [];
        catalog.models = models; catalog.at = Date.now(); return models;
      }).finally(() => { window.clearTimeout(timeout); if (catalog.pending === pending) catalog.pending = null; });
    catalog.pending = pending;
    return pending;
  }
  async function refreshOptions(purpose: ModelPurpose, list: HTMLDataListElement, target: HTMLElement, force = false): Promise<void> {
    const requestId = (optionEpoch.get(list) ?? 0) + 1;
    optionEpoch.set(list, requestId);
    if (!connection.apiKey) { list.replaceChildren(); target.textContent = '请先在 AI 连接设置中保存 OpenRouter API Key。'; return; }
    target.textContent = '正在更新模型列表…';
    try {
      const models = modelsForPurpose(await loadModels(purpose, force), purpose);
      if (optionEpoch.get(list) !== requestId) return;
      const fragment = document.createDocumentFragment();
      for (const model of models) {
        const option = document.createElement('option');
        option.value = model.id;
        option.label = `${model.name} · ${isFreeModel(model) ? '免费' : Object.keys(model.pricing).length ? '收费' : '价格未提供'}`;
        fragment.append(option);
      }
      list.replaceChildren(fragment);
      target.textContent = `已更新 ${models.length} 个${purpose === 'text' ? '文本' : '图片'}模型；可搜索或手动填写 ID。${purpose === 'image' ? '图片费用以 OpenRouter 模型页面为准。' : ''}`;
    } catch (error) {
      if (optionEpoch.get(list) !== requestId) return;
      target.textContent = `${(error as Error).message} ${list.options.length ? '可继续使用已显示的列表。' : ''}`;
    }
  }
  function open(): void {
    updateFields();
    status.textContent = connection.apiKey ? `${connection.remember ? '连接已保存在此浏览器' : '正在使用当前页面的连接'}；生成时按所选模型的实际价格计费。` : '填写 Key 后保存，即可在故事与角色生成中复用。';
    dialog.showModal();
    if (connection.apiKey) {
      void refreshOptions('text', get<HTMLDataListElement>('ai-text-model-options'), get('ai-text-model-status'));
      void refreshOptions('image', get<HTMLDataListElement>('ai-image-model-options'), get('ai-image-model-status'));
    }
  }
  get('ai-settings-button').addEventListener('click', open);
  get('ai-close').addEventListener('click', () => dialog.close());
  get('ai-save').addEventListener('click', () => {
    const apiKey = keyInput.value.trim();
    if (!apiKey) { status.textContent = '请填写 OpenRouter API Key。'; return; }
    const next: OpenRouterConnection = { apiKey, textModel: textInput.value.trim() || 'openrouter/free',
      imageModel: imageInput.value.trim(), remember: rememberInput.checked };
    try {
      writeOpenRouterConnection(storage, next);
      connection = next;
      resetCatalogs();
      status.textContent = connection.remember ? '连接已保存在此浏览器。' : '连接仅在当前页面会话有效。';
      window.dispatchEvent(new Event('yahari:ai-connection-updated'));
      void refreshOptions('text', get<HTMLDataListElement>('ai-text-model-options'), get('ai-text-model-status'), true);
      void refreshOptions('image', get<HTMLDataListElement>('ai-image-model-options'), get('ai-image-model-status'));
    } catch { status.textContent = '浏览器无法保存连接；请检查网站存储设置。'; }
  });
  get('ai-forget').addEventListener('click', () => {
    try { storage.removeItem(AI_CONNECTION_KEY); }
    catch { status.textContent = '浏览器未能移除已保存的连接，请检查网站存储设置后重试。'; return; }
    connection = { ...DEFAULT_CONNECTION };
    resetCatalogs();
    for (const id of ['ai-text-model-options', 'ai-image-model-options', 'story-model-options', 'character-model-options']) {
      const list = get<HTMLDataListElement>(id);
      if (list) optionEpoch.set(list, (optionEpoch.get(list) ?? 0) + 1);
    }
    updateFields();
    get<HTMLDataListElement>('ai-text-model-options').replaceChildren();
    get<HTMLDataListElement>('ai-image-model-options').replaceChildren();
    status.textContent = '已从此浏览器移除连接。';
    window.dispatchEvent(new Event('yahari:ai-connection-updated'));
  });
  get('ai-refresh').addEventListener('click', () => {
    void refreshOptions('text', get<HTMLDataListElement>('ai-text-model-options'), get('ai-text-model-status'), true);
    void refreshOptions('image', get<HTMLDataListElement>('ai-image-model-options'), get('ai-image-model-status'));
  });
  textInput.addEventListener('change', () => settings.setModel('text', textInput.value));
  imageInput.addEventListener('change', () => settings.setModel('image', imageInput.value));

  const settings: AiConnectionSettings = {
    account,
    imageCapabilities: async model => (await loadModels('image')).find(item=>item.id===model)?.capabilities,
    key: () => connection.apiKey,
    model: purpose => purpose === 'text' ? connection.textModel : connection.imageModel,
    setModel: (purpose, value) => {
      if (purpose === 'text') connection.textModel = value.trim(); else connection.imageModel = value.trim();
      if (connection.remember) {
        try { persist(); } catch { /* Model selection still applies this session. */ }
      }
    },
    open, refreshOptions,
  };
  if (location.hash === '#chatgpt-connect') queueMicrotask(open);
  return settings;
}
