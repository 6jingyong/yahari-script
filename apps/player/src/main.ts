import { mountPlayer } from './runtime.js';
import { readProjectInput } from '../../../packages/project-io/src/index.js';
import { openProjectLibrary } from '../../editor/src/project-library.js';

const root = document.getElementById('player-root')!, status = document.getElementById('player-status')!;
document.getElementById('player-file')!.addEventListener('change', async event => {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = ''; if (!file) return;
  try { mountPlayer(root, await readProjectInput(file)); status.textContent = ''; }
  catch (error) { status.textContent = error instanceof Error ? error.message : '作品无法打开。'; }
});
const id = new URLSearchParams(location.hash.slice(1)).get('work');
if (id) {
  try { const library = await openProjectLibrary(), loaded = await library.load(id); if (!loaded) throw new Error('未找到本机作品，请选择作品文件。'); mountPlayer(root, loaded.project); }
  catch (error) { status.textContent = error instanceof Error ? error.message : '本机作品无法读取，请选择作品文件。'; }
}
