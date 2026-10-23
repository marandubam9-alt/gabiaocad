/* ===== GabiãoCAD — integração com o Windows (só no programa instalado) ===== */
(function () {
  if (!window.desktop) return;
  const D = window.desktop;
  let currentPath = null, currentName = null, dirty = false;

  function title() {
    const nome = currentName || 'Projeto sem nome';
    D.setTitle(`${dirty ? '• ' : ''}${nome} — GabiãoCAD`);
  }
  function markDirty() { if (!dirty) { dirty = true; title(); } }

  // toda alteração passa por update(): marca o projeto como alterado
  const baseUpdate = update;
  update = function () { baseUpdate(); markDirty(); };
  $('#projName').addEventListener('input', markDirty);

  // salvar arquivos com a janela do Windows
  saveFile = async function (filename, data) {
    try {
      let payload = data;
      if (data instanceof Blob) payload = await data.arrayBuffer();
      const r = await D.saveFile({ filename, data: payload, ask: true });
      if (r && !r.canceled) toastAction('Salvo: ' + r.name, 'Mostrar na pasta', () => D.showInFolder(r.path));
    } catch (e) { toast('Não foi possível salvar: ' + (e.message || e)); }
  };

  function toastAction(msg, label, fn) {
    const t = $('#toast');
    t.innerHTML = '';
    t.append(document.createTextNode(msg + ' '));
    const b = document.createElement('button');
    b.className = 'btn'; b.type = 'button'; b.textContent = label; b.style.marginLeft = '10px';
    b.onclick = () => { fn(); t.hidden = true; };
    t.append(b); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 6000);
  }

  function projectJSON() { return JSON.stringify({ app: 'GabiaoCAD', versao: 1, projeto: st }, null, 2); }

  async function doSave(as) {
    const r = await D.saveFile({ filename: slug() + '.gabiao', data: projectJSON(), filePath: as ? null : currentPath, ask: as || !currentPath });
    if (!r || r.canceled) return false;
    currentPath = r.path; currentName = r.name; dirty = false; title();
    toast('Projeto salvo: ' + r.name);
    return true;
  }
  function loadProject(p) {
    try {
      const j = JSON.parse(p.text);
      st = sanitize(merge(DEFAULTS, j.projeto || j));
      fillInputs(); baseUpdate();
      currentPath = p.path; currentName = p.name; dirty = false; title();
      toast('Projeto aberto: ' + p.name);
    } catch (e) { toast('Arquivo inválido. Escolha um projeto salvo pelo GabiãoCAD.'); }
  }
  async function askDiscard() {
    if (!dirty) return true;
    return window.confirm('O projeto atual tem alterações não salvas. Continuar mesmo assim?');
  }
  async function doOpen() {
    if (!(await askDiscard())) return;
    const r = await D.openFile();
    if (r && !r.canceled) loadProject(r);
  }
  async function doNew() {
    if (!(await askDiscard())) return;
    st = clone(DEFAULTS); fillInputs(); baseUpdate();
    currentPath = null; currentName = null; dirty = false; title();
    toast('Novo projeto a partir do exemplo.');
  }

  $('#btnOpen').onclick = () => { if (!window.GABIAO_BLOQUEADO) doOpen(); };
  // "Salvar projeto" do menu Exportar vira salvar .gabiao
  const jsonItem = document.querySelector('[data-exp="json"]');
  if (jsonItem) jsonItem.innerHTML = 'Salvar projeto <span>.gabiao</span>';
  $('#exportMenu').addEventListener('click', e => {
    const b = e.target.closest('[data-exp="json"]');
    if (!b) return;
    e.stopImmediatePropagation(); $('#exportMenu').hidden = true; doSave(false);
  }, true);

  const run = k => {
    if (!RES) { toast('Corrija os dados antes de exportar.'); return; }
    const exp = document.querySelector(`[data-exp="${k}"]`); if (exp) exp.click();
  };
  D.onMenu(a => {
    if (window.GABIAO_BLOQUEADO && a !== 'tutorial' && a !== 'account') return;   // sem conta ou teste encerrado
    if (a === 'new') doNew();
    else if (a === 'open') doOpen();
    else if (a === 'save') doSave(false);
    else if (a === 'saveAs') doSave(true);
    else if (a === 'tutorial' || a === 'account') { /* tratado pelas contas (web.js) */ }
    else if (a === 'aiKey') { $('#aiKeyBox').hidden = false; $('#aiCard').scrollIntoView({ behavior: 'smooth' }); $('#aiKey').focus(); }
    else run(a);
  });
  D.onProjectOpened(p => { askDiscard().then(ok => ok && loadProject(p)); });
  D.onQueryClose(async () => {
    const r = await D.confirmClose(dirty);
    if (r === 'save') { if (await doSave(false)) D.forceClose(); }
  });

  // o programa não depende da conta do Claude: some o aviso de visualização

  /* ---------- análise de fotos pela API da Anthropic ---------- */
  function toJpegB64(file) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1568 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.88).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej({ code: 'image_rejected' }); };
      img.src = url;
    });
  }
  function parseJSON(text) {
    try { return JSON.parse(text); } catch (e) {}
    const f = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch (e) {} }
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch (e) {} }
    throw { code: 'invalid_json' };
  }
  const desktopAI = {
    async ready() { return (await D.aiHasKey()) ? { ok: true } : { ok: false, needKey: true }; },
    async ask(prompt, files, signal) {
      const images = [];
      for (const f of files) images.push({ media_type: 'image/jpeg', data: await toJpegB64(f) });
      const onAbort = () => D.aiCancel(); signal.addEventListener('abort', onAbort);
      try {
        const r = await D.aiAnalyze({ prompt, images });
        if (r.error) throw { code: r.error, status: r.status, message: r.message };
        return parseJSON(r.text);
      } finally { signal.removeEventListener('abort', onAbort); }
    },
    errText(e) {
      if (!e) return 'Não foi possível analisar agora.';
      if (e.code === 'cancelled') return 'Análise interrompida.';
      if (e.code === 'no_key') return 'Configure a chave da API primeiro.';
      if (e.code === 'network') return 'Sem conexão com a internet. A análise de fotos precisa de internet (o resto do programa funciona sem).';
      if (e.code === 'invalid_json') return 'A resposta veio incompleta. Clique em Analisar de novo.';
      if (e.code === 'image_rejected') return 'Uma das fotos não pôde ser lida.';
      if (e.code === 'http') {
        if (e.status === 401) return 'Chave da API inválida. Confira em Ajuda → Chave da API.';
        if (e.status === 402 || /credit|billing/i.test(e.message || '')) return 'Sem créditos na conta da API. Adicione créditos em console.anthropic.com → Billing.';
        if (e.status === 429) return 'Limite de uso da API atingido. Tente de novo em instantes.';
        if (e.status === 529 || e.status >= 500) return 'O serviço está sobrecarregado. Tente de novo em alguns minutos.';
        return 'Erro da API (' + e.status + '): ' + (e.message || '');
      }
      return 'Não foi possível analisar agora.';
    },
  };
  $('#aiKeySave').onclick = async () => {
    const r = await D.aiSetKey($('#aiKey').value);
    if (!r.ok) { toast(r.error); return; }
    $('#aiKey').value = '';
    if (r.cleared) { toast('Chave removida.'); aiInit(desktopAI); return; }
    $('#aiKeyBox').hidden = true; toast('Chave salva. Já pode analisar fotos.'); aiInit(desktopAI);
  };
  aiInit(desktopAI);

  document.documentElement.classList.add('is-desktop');
  title();
})();
