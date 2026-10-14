interface AccountProfile { id: string; label: string; email: string; name: string; connected: boolean; planEnabled: boolean; model: string }
interface AccountStatus { available: boolean; profiles: AccountProfile[]; activeId: string | null; pending: boolean; lastLogin: { ok: boolean; message: string } | null }
interface AccountModel { id: string; name: string }

export interface ChatGptConnection {
  model(): string;
  refresh(): Promise<void>;
  refreshOptions(list: HTMLDataListElement, status: HTMLElement): Promise<void>;
}

export function installChatGptConnection(dialog: HTMLDialogElement): ChatGptConnection {
  const get = <T extends HTMLElement>(id: string) => dialog.querySelector<T>('#' + id)!;
  const status = get('chatgpt-status'), accounts = get<HTMLSelectElement>('chatgpt-accounts');
  const model = get<HTMLSelectElement>('chatgpt-model');
  let active: AccountProfile | undefined, models: AccountModel[] = [], poll: number | undefined, epoch = 0;
  let available = false, busy = false, pending = false, lastResult = '__initial__', lastNotice = '';

  async function request<T>(route: string, body?: unknown): Promise<T> {
    const response = await fetch('/api/chatgpt/' + route, { redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(route === 'test' ? 190_000 : 35_000),
      ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Yahari-Account': '1' }, body: JSON.stringify(body) } : {}) });
    if (response.status === 404) throw new Error('账号登录仅在本地版提供，请使用“双击启动本地版”。');
    let data: T & { error?: string };
    try { data = await response.json(); } catch { throw new Error('本地账号服务未返回有效响应，请重新启动本地版。'); }
    if (!response.ok) throw new Error(data.error || `账户服务返回 HTTP ${response.status}。`);
    return data;
  }
  function controls(): void {
    for (const id of ['chatgpt-login', 'chatgpt-add']) get<HTMLButtonElement>(id).disabled = busy || !available;
    get<HTMLButtonElement>('chatgpt-login').textContent = active ? '重新登录 / 授权' : 'Continue with ChatGPT';
    accounts.disabled = busy || !available;
    model.disabled = busy || !active?.planEnabled || !models.length;
    for (const id of ['chatgpt-refresh', 'chatgpt-test']) get<HTMLButtonElement>(id).disabled = busy || !active?.planEnabled;
    get<HTMLButtonElement>('chatgpt-logout').disabled = busy || !active?.connected;
    get<HTMLButtonElement>('chatgpt-cancel').hidden = !pending;
  }
  function notify(): void {
    const notice = JSON.stringify([active?.id, active?.planEnabled, model.value, models.map(m => m.id)]);
    if (notice !== lastNotice) { lastNotice = notice; window.dispatchEvent(new Event('yahari:chatgpt-connection-updated')); }
  }
  async function loadModels(): Promise<void> {
    const data = await request<{ models: AccountModel[] }>('models');
    models = data.models;
    model.replaceChildren(...models.map(m => new Option(m.name, m.id)));
    if (models.some(m => m.id === active?.model)) model.value = active!.model;
    controls(); notify();
  }
  async function refresh(): Promise<void> {
    const current = ++epoch;
    try {
      const data = await request<AccountStatus>('status');
      if (current !== epoch) return;
      available = data.available; pending = data.pending;
      const previousId = active?.id, previousConnected = active?.connected;
      active = data.profiles.find(p => p.id === data.activeId);
      accounts.replaceChildren(...data.profiles.map(p => new Option(`${p.label} · ${p.email || p.name || 'ChatGPT 账号'}${p.connected ? '' : '（已退出）'}`, p.id)));
      if (data.activeId) accounts.value = data.activeId;
      if (!active?.planEnabled) { models = []; model.replaceChildren(); }
      const result = data.lastLogin ? JSON.stringify(data.lastLogin) : '';
      if (!busy && (result !== lastResult || !status.textContent)) status.textContent = data.lastLogin?.message
        || (active?.connected ? active.planEnabled ? '已登录并授权订阅额度；可以选择模型并测试。' : '已登录，但尚未授权订阅额度。'
          : '尚未登录。符合条件的 ChatGPT Plus / Pro 账号可授权使用订阅额度。');
      lastResult = result;
      if (pending && !busy) status.textContent = '等待 OpenAI 页面完成登录与授权…';
      controls();
      if (active?.planEnabled && (previousId !== active.id || previousConnected !== active.connected || !models.length)) {
        try { await loadModels(); } catch (error) { status.textContent = `已连接；${(error as Error).message}`; }
      }
      notify();
    } catch (error) {
      if (current !== epoch) return;
      available = false; active = undefined; models = []; accounts.replaceChildren(); model.replaceChildren();
      status.textContent = (error as Error).message; controls();
    }
  }
  async function operation(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true; controls();
    try { await work(); } catch (error) { status.textContent = (error as Error).message; }
    finally { busy = false; controls(); }
  }
  function login(add: boolean): void {
    // Open on the user gesture to keep the browser's popup permission.
    const popup = window.open('about:blank', '_blank');
    if (!popup) { status.textContent = '浏览器阻止了登录窗口，请允许此页面打开弹窗后重试。'; return; }
    popup.opener = null;
    void operation(async () => {
      try {
        const data = await request<{ url: string }>('login', { profileId: add ? null : active?.id ?? null });
        const url = new URL(data.url);
        if (url.origin !== 'https://auth.openai.com' || url.pathname !== '/api/accounts/authorize') throw new Error('登录服务返回了非官方授权地址。');
        popup.location.href = url.href;
        pending = true; status.textContent = '请在 OpenAI 页面选择账号、工作区，并允许订阅额度授权。';
      } catch (error) { popup.close(); throw error; }
    });
  }
  get('chatgpt-login').onclick = () => login(false);
  get('chatgpt-add').onclick = () => login(true);
  get('chatgpt-cancel').onclick = () => void operation(async () => { await request('cancel-login', {}); pending = false; status.textContent = '本次登录已取消。'; await refresh(); });
  accounts.onchange = () => void operation(async () => { await request('select', { profileId: accounts.value }); models = []; await refresh(); status.textContent = active?.connected ? '已切换连接。' : '此连接已退出，请重新登录。'; });
  model.onchange = () => void operation(async () => { await request('model', { model: model.value }); if (active) active.model = model.value; status.textContent = '默认模型已保存在本地连接中。'; notify(); });
  get('chatgpt-refresh').onclick = () => void operation(async () => { await loadModels(); status.textContent = `已获取当前账号的 ${models.length} 个模型。`; });
  get('chatgpt-test').onclick = () => void operation(async () => {
    status.textContent = '正在验证文本生成（一次简短请求，使用 ChatGPT 订阅额度）…';
    const data = await request<{ message: string; model: string }>('test', { model: model.value || null });
    status.textContent = `${data.message} 模型：${data.model}`;
  });
  get('chatgpt-logout').onclick = () => void operation(async () => { const data = await request<{ message: string }>('logout', {}); await refresh(); status.textContent = data.message; });
  dialog.addEventListener('close', () => { window.clearInterval(poll); poll = undefined; });
  new MutationObserver(() => {
    if (dialog.open && poll === undefined) { void refresh(); poll = window.setInterval(() => { if (!busy) void refresh(); }, 2500); }
    if (!dialog.open) { window.clearInterval(poll); poll = undefined; }
  }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  controls();
  return { model: () => model.value || active?.model || '', refresh,
    async refreshOptions(list, target) {
      try {
        await refresh();
        if (!active?.planEnabled) throw new Error(available ? '请先在 AI 连接设置中登录并授权 ChatGPT 订阅额度。' : status.textContent || '账户服务不可用。');
        await loadModels();
        list.replaceChildren(...models.map(m => { const option = document.createElement('option'); option.value = m.id; option.label = m.name; return option; }));
        target.textContent = `当前账号可选 ${models.length} 个模型；生成使用 ChatGPT 订阅额度。`;
      } catch (error) { list.replaceChildren(); target.textContent = (error as Error).message; }
    } };
}
