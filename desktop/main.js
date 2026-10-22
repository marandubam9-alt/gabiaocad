const { app, BrowserWindow, Menu, dialog, ipcMain, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let pendingOpen = null;

function fileFromArgs(argv) {
  return argv.slice(1).find(a => /\.(gabiao|json)$/i.test(a) && fs.existsSync(a)) || null;
}

function send(channel, payload) { if (win) win.webContents.send(channel, payload); }

function openProjectFile(p) {
  try {
    const text = fs.readFileSync(p, 'utf8');
    send('project-opened', { path: p, name: path.basename(p), text });
    app.addRecentDocument(p);
  } catch (e) { dialog.showErrorBox('Não foi possível abrir', String(e.message || e)); }
}

function buildMenu() {
  const m = (label, accelerator, action) => ({ label, accelerator, click: () => send('menu', action) });
  const tpl = [
    { label: 'Arquivo', submenu: [
      m('Novo projeto', 'CmdOrCtrl+N', 'new'),
      m('Abrir projeto…', 'CmdOrCtrl+O', 'open'),
      { type: 'separator' },
      m('Salvar', 'CmdOrCtrl+S', 'save'),
      m('Salvar como…', 'CmdOrCtrl+Shift+S', 'saveAs'),
      { type: 'separator' },
      { label: 'Exportar', submenu: [
        m('Memorial de cálculo (PDF)…', 'CmdOrCtrl+P', 'pdf'),
        m('Quantitativos e orçamento (Excel)…', 'CmdOrCtrl+E', 'xlsx'),
        { type: 'separator' },
        m('Corte transversal (PNG)…', null, 'cortePng'),
        m('Vista frontal (PNG)…', null, 'vistaPng'),
        m('Corte transversal (SVG)…', null, 'corteSvg'),
      ] },
      { type: 'separator' },
      { label: 'Sair', role: 'quit' },
    ] },
    { label: 'Exibir', submenu: [
      { label: 'Aumentar zoom', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
      { label: 'Diminuir zoom', role: 'zoomOut' },
      { label: 'Zoom normal', role: 'resetZoom' },
      { type: 'separator' },
      { label: 'Tela cheia', role: 'togglefullscreen' },
      { type: 'separator' },
      { label: 'Ferramentas do desenvolvedor', role: 'toggleDevTools', accelerator: 'F12' },
    ] },
    { label: 'Ajuda', submenu: [
      m('Chave da API (análise de fotos)…', null, 'aiKey'),
      { type: 'separator' },
      { label: 'Sobre o GabiãoCAD', click: () => dialog.showMessageBox(win, {
        type: 'info', title: 'GabiãoCAD', message: `GabiãoCAD ${app.getVersion()}`,
        detail: 'Pré-dimensionamento e verificação de muros de gabião.\nFerramenta de apoio: o projeto executivo exige engenheiro responsável e ART.',
      }) },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 600,
    title: 'GabiãoCAD', backgroundColor: '#E6EBEE', show: false,
    icon: path.join(__dirname, 'app', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.on('did-finish-load', () => { if (pendingOpen) { openProjectFile(pendingOpen); pendingOpen = null; } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  // pergunta antes de fechar com alterações não salvas
  win.on('close', e => {
    if (win.__forceClose) return;
    e.preventDefault();
    send('query-close');
  });
}

ipcMain.handle('save-file', async (_e, { filename, data, filePath, ask }) => {
  let target = filePath;
  if (!target || ask) {
    const ext = path.extname(filename).slice(1).toLowerCase();
    const names = { pdf: 'Documento PDF', xlsx: 'Planilha do Excel', png: 'Imagem PNG', svg: 'Imagem SVG', gabiao: 'Projeto GabiãoCAD', json: 'JSON' };
    const r = await dialog.showSaveDialog(win, {
      title: 'Salvar arquivo',
      defaultPath: filePath || path.join(app.getPath('documents'), filename),
      filters: [{ name: names[ext] || ext.toUpperCase(), extensions: [ext] }],
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    target = r.filePath;
  }
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  fs.writeFileSync(target, buf);
  if (/\.gabiao$/i.test(target)) app.addRecentDocument(target);
  return { path: target, name: path.basename(target) };
});

ipcMain.handle('open-file', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Abrir projeto', defaultPath: app.getPath('documents'), properties: ['openFile'],
    filters: [{ name: 'Projeto GabiãoCAD', extensions: ['gabiao', 'json'] }],
  });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  const p = r.filePaths[0];
  app.addRecentDocument(p);
  return { path: p, name: path.basename(p), text: fs.readFileSync(p, 'utf8') };
});

/* ---------- análise de fotos: API da Anthropic ---------- */
const AI_MODEL = 'claude-sonnet-5-5';
const cfgPath = () => path.join(app.getPath('userData'), 'config.json');
function readCfg() { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch (e) { return {}; } }
function writeCfg(c) { fs.mkdirSync(path.dirname(cfgPath()), { recursive: true }); fs.writeFileSync(cfgPath(), JSON.stringify(c, null, 2)); }
function getKey() {
  const c = readCfg();
  if (!c.apiKey) return null;
  try { return c.enc && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(c.apiKey, 'base64')) : Buffer.from(c.apiKey, 'base64').toString('utf8'); }
  catch (e) { return null; }
}
let aiAbort = null;
ipcMain.handle('ai-has-key', () => !!getKey());
ipcMain.handle('ai-set-key', (_e, key) => {
  key = String(key || '').trim();
  const c = readCfg();
  if (!key) { delete c.apiKey; delete c.enc; writeCfg(c); return { ok: true, cleared: true }; }
  if (!/^sk-ant-[\w-]{20,}$/.test(key)) return { ok: false, error: 'A chave deve começar com sk-ant- e ser copiada inteira do console da Anthropic.' };
  const enc = safeStorage.isEncryptionAvailable();
  c.apiKey = (enc ? safeStorage.encryptString(key) : Buffer.from(key, 'utf8')).toString('base64'); c.enc = enc;
  writeCfg(c); return { ok: true };
});
ipcMain.handle('ai-cancel', () => { if (aiAbort) aiAbort.abort(); });
ipcMain.handle('ai-analyze', async (_e, { prompt, images }) => {
  const key = getKey();
  if (!key) return { error: 'no_key' };
  aiAbort = new AbortController();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: aiAbort.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: AI_MODEL, max_tokens: 4096,
        messages: [{ role: 'user', content: [
          ...images.map(im => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } })),
          { type: 'text', text: prompt + '\n\nResponda apenas com o JSON, sem texto antes ou depois.' },
        ] }],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: 'http', status: res.status, message: body?.error?.message || res.statusText };
    const text = (body.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return { text, stop: body.stop_reason };
  } catch (e) {
    if (e.name === 'AbortError') return { error: 'cancelled' };
    return { error: 'network', message: String(e.message || e) };
  } finally { aiAbort = null; }
});

ipcMain.handle('show-in-folder', (_e, p) => { if (p) shell.showItemInFolder(p); });
ipcMain.handle('set-title', (_e, t) => { if (win) win.setTitle(t); });
ipcMain.handle('confirm-close', async (_e, { dirty }) => {
  if (dirty) {
    const r = await dialog.showMessageBox(win, {
      type: 'question', buttons: ['Salvar', 'Não salvar', 'Cancelar'], defaultId: 0, cancelId: 2,
      title: 'GabiãoCAD', message: 'Salvar as alterações do projeto antes de sair?',
    });
    if (r.response === 2) return 'cancel';
    if (r.response === 0) return 'save';
  }
  win.__forceClose = true; win.close();
  return 'closed';
});
ipcMain.handle('force-close', () => { win.__forceClose = true; win.close(); });

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', (_e, argv) => {
    const f = fileFromArgs(argv);
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); if (f) openProjectFile(f); }
  });
  app.whenReady().then(() => {
    pendingOpen = fileFromArgs(process.argv);
    buildMenu();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
