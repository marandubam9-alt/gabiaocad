/* ===== GabiãoCAD na internet: contas, Premium e IA pelo servidor ===== */
(function () {
  if (!window.GABIAO_WEB) return;
  const CFG = window.GABIAO_CONFIG || {};
  const ON = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  const sb = ON ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
  const PLAN = { logged: false, email: '', plano: 'gratis', premium: false, premium_ate: null, mp_status: null, usados: 0, limite: 3 };
  window.GABIAO_PLAN = PLAN;
  let cloudId = null;

  /* ---------- estilos dos painéis ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .acct{display:flex;align-items:center;gap:6px}
  .planbadge{font-size:11px;font-weight:700;letter-spacing:.05em;padding:3px 8px;border-radius:99px;background:var(--panel2);border:1px solid var(--line);color:var(--muted);text-transform:uppercase}
  .planbadge.pro{background:var(--accent);border-color:var(--accent);color:#fff}
  dialog.gx{border:1px solid var(--line);border-radius:12px;padding:0;background:var(--panel);color:var(--ink);width:min(560px,calc(100vw - 32px));box-shadow:0 20px 60px rgba(0,0,0,.3)}
  dialog.gx::backdrop{background:rgba(10,16,22,.55)}
  .gx-h{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--line)}
  .gx-h h3{margin:0;font-family:var(--f-display);font-size:20px;letter-spacing:.03em;text-transform:uppercase}
  .gx-b{padding:16px 18px;display:grid;gap:12px}
  .gx-x{border:0;background:transparent;font-size:22px;cursor:pointer;color:var(--muted)}
  .plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  @media (max-width:560px){.plans{grid-template-columns:1fr}}
  .plan{border:1px solid var(--line);border-radius:10px;padding:12px;display:grid;gap:6px;align-content:start}
  .plan.best{border:2px solid var(--accent)}
  .plan .pn{font-weight:700}.plan .pp{font-family:var(--f-display);font-size:26px;font-weight:700}.plan .pp small{font-size:13px;color:var(--muted)}
  .feat{margin:0;padding-left:18px;display:grid;gap:3px;font-size:13px}
  .cloudlist{display:grid;gap:6px;max-height:50vh;overflow:auto}
  .cloudrow{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:8px}
  .cloudrow .meta{font-size:12px;color:var(--muted)}
  .lock{font-size:10px;font-weight:700;background:var(--accent-soft);color:var(--accent);border-radius:99px;padding:1px 7px;margin-left:6px;vertical-align:middle}`;
  document.head.appendChild(css);

  /* ---------- download comum no navegador ---------- */
  saveFile = async function (filename, data) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Arquivo baixado: ' + filename);
  };

  /* ---------- diálogo genérico ---------- */
  function dialog(title, html) {
    const d = document.createElement('dialog'); d.className = 'gx';
    d.innerHTML = `<div class="gx-h"><h3>${title}</h3><button class="gx-x" type="button" aria-label="Fechar">×</button></div><div class="gx-b">${html}</div>`;
    document.body.appendChild(d); d.querySelector('.gx-x').onclick = () => d.close();
    d.addEventListener('close', () => d.remove()); d.showModal(); return d;
  }

  /* ---------- conta ---------- */
  const acct = document.createElement('div'); acct.className = 'acct';
  document.querySelector('.bar .actions').prepend(acct);
  function renderAcct() {
    if (!ON) { acct.innerHTML = ''; return; }
    acct.innerHTML = PLAN.logged
      ? `<span class="planbadge ${PLAN.premium ? 'pro' : ''}">${PLAN.premium ? (PLAN.plano === 'estudante' ? 'Estudante' : 'Premium') : 'Grátis'}</span><button class="btn" type="button" id="acctBtn">Minha conta</button>`
      : `<button class="btn" type="button" id="loginBtn">Entrar</button><button class="btn primary" type="button" id="proBtn">Premium</button>`;
    const lb = document.getElementById('loginBtn'); if (lb) lb.onclick = loginDialog;
    const pb = document.getElementById('proBtn'); if (pb) pb.onclick = () => plansDialog();
    const ab = document.getElementById('acctBtn'); if (ab) ab.onclick = accountDialog;
  }
  function loginDialog(motivo) {
    const d = dialog('Entrar', `${typeof motivo === 'string' ? `<p class="help">${esc(motivo)}</p>` : ''}
      <button class="btn primary" type="button" id="gGoogle">Entrar com Google</button>
      <div class="help" style="text-align:center">ou receba um link de acesso no e-mail</div>
      <div class="aikeyrow"><div class="inp"><input id="gEmail" type="email" placeholder="seu@email.com" autocomplete="email"></div><button class="btn" type="button" id="gSend">Enviar link</button></div>
      <p class="help">Estudante: entre com o e-mail da faculdade (.edu.br) para poder assinar o plano Estudante.</p>`);
    d.querySelector('#gGoogle').onclick = async () => { await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.split('#')[0] } }); };
    d.querySelector('#gSend').onclick = async () => {
      const email = d.querySelector('#gEmail').value.trim(); if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Digite um e-mail válido.'); return; }
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0] } });
      if (error) toast('Não foi possível enviar: ' + error.message); else { toast('Link enviado. Abra seu e-mail para entrar.'); d.close(); }
    };
  }
  async function loadPlan() {
    if (!ON) return;
    const { data: { session } } = await sb.auth.getSession();
    PLAN.logged = !!session; PLAN.email = session?.user?.email || '';
    if (session) {
      const { data: p } = await sb.from('profiles').select('plano, premium_ate, mp_status').eq('id', session.user.id).single();
      const mes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
      const { data: u } = await sb.from('uso_ia').select('n').eq('mes', mes).maybeSingle();
      PLAN.plano = p?.plano || 'gratis'; PLAN.premium_ate = p?.premium_ate || null; PLAN.mp_status = p?.mp_status || null;
      PLAN.premium = PLAN.plano !== 'gratis' && (!PLAN.premium_ate || new Date(PLAN.premium_ate) > new Date());
      PLAN.limite = PLAN.premium ? 150 : 3; PLAN.usados = u?.n || 0;
    } else Object.assign(PLAN, { plano: 'gratis', premium: false, usados: 0, limite: 3 });
    window.PDF_MARCA_DAGUA = PLAN.premium ? null : 'VERSÃO GRATUITA · GabiãoCAD';
    renderAcct(); aiInit(serverAI); applyGates();
  }
  function accountDialog() {
    const ate = PLAN.premium_ate ? new Date(PLAN.premium_ate).toLocaleDateString('pt-BR') : null;
    const d = dialog('Minha conta', `
      <div><b>${esc(PLAN.email)}</b><br><span class="help">Plano: ${PLAN.premium ? (PLAN.plano === 'estudante' ? 'Estudante' : 'Premium') : 'Grátis'}${PLAN.premium && ate ? (PLAN.mp_status === 'cancelled' ? ` · cancelado, acesso até ${ate}` : ` · renova até ${ate}`) : ''}</span></div>
      <div class="help">Análises de foto neste mês: <b>${PLAN.usados} de ${PLAN.premium ? 'uso livre' : PLAN.limite}</b></div>
      <div class="row-btns">
        <button class="btn" type="button" id="cSave">Salvar projeto na nuvem</button>
        <button class="btn" type="button" id="cList">Meus projetos</button>
        ${PLAN.premium ? (PLAN.mp_status === 'authorized' ? '<button class="btn" type="button" id="cCancel">Cancelar assinatura</button>' : '') : '<button class="btn primary" type="button" id="cPro">Assinar Premium</button>'}
        <button class="btn" type="button" id="cOut">Sair</button>
      </div>
      <div id="cConfirm" hidden class="derived">O Premium continua até o fim do período já pago. <button class="btn" type="button" id="cYes">Confirmar cancelamento</button></div>`);
    d.querySelector('#cSave').onclick = () => { d.close(); cloudSave(); };
    d.querySelector('#cList').onclick = () => { d.close(); cloudList(); };
    d.querySelector('#cOut').onclick = async () => { await sb.auth.signOut(); d.close(); cloudId = null; loadPlan(); toast('Você saiu da conta.'); };
    const cp = d.querySelector('#cPro'); if (cp) cp.onclick = () => { d.close(); plansDialog(); };
    const cc = d.querySelector('#cCancel'); if (cc) cc.onclick = () => { d.querySelector('#cConfirm').hidden = false; };
    const cy = d.querySelector('#cYes'); if (cy) cy.onclick = async () => {
      const r = await callFn('cancelar', {}); if (r.ok) { toast('Assinatura cancelada. O Premium continua até o fim do período pago.'); d.close(); loadPlan(); } else toast(r.mensagem || 'Não foi possível cancelar agora.');
    };
  }

  /* ---------- planos e pagamento ---------- */
  function plansDialog(motivo) {
    const d = dialog('GabiãoCAD Premium', `${motivo ? `<p><b>${esc(motivo)}</b></p>` : ''}
      <ul class="feat"><li>Muro em leito de rio: cheia, rebaixamento rápido e erosão</li><li>Memorial em PDF sem marca d'água</li><li>Planilha de quantitativos e orçamento (Excel)</li><li>Análise de foto sem limite (uso justo)</li><li>Projetos ilimitados na nuvem</li></ul>
      <div class="plans">
        <div class="plan"><span class="pn">Mensal</span><span class="pp">R$ 39,90<small>/mês</small></span><button class="btn" type="button" data-op="mensal">Assinar</button></div>
        <div class="plan best"><span class="pn">Anual</span><span class="pp">R$ 349<small>/ano</small></span><span class="help">2 meses e meio de desconto</span><button class="btn primary" type="button" data-op="anual">Assinar</button></div>
        <div class="plan"><span class="pn">Estudante</span><span class="pp">R$ 9,90<small>/mês</small></span><span class="help">com e-mail .edu.br</span><button class="btn" type="button" data-op="estudante">Assinar</button></div>
      </div>
      <p class="help">Pagamento pelo Mercado Pago. Cancele quando quiser; 7 dias de arrependimento na primeira assinatura.</p>`);
    d.querySelectorAll('[data-op]').forEach(b => b.onclick = async () => {
      if (!PLAN.logged) { d.close(); loginDialog('Entre na sua conta para assinar o Premium.'); return; }
      b.disabled = true; b.textContent = 'Abrindo…';
      const r = await callFn('assinar', { opcao: b.dataset.op });
      if (r.url) location.href = r.url; else { toast(r.mensagem || 'Não foi possível abrir o pagamento.'); b.disabled = false; b.textContent = 'Assinar'; }
    });
  }
  async function callFn(nome, body) {
    const { data: { session } } = await sb.auth.getSession();
    try {
      const r = await fetch(`${CFG.supabaseUrl}/functions/v1/${nome}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${session ? session.access_token : CFG.supabaseAnonKey}` }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({})); j.status = r.status; return j;
    } catch (e) { return { erro: 'rede', mensagem: 'Sem conexão com o servidor.' }; }
  }

  /* ---------- travas do plano grátis ---------- */
  let avisouRio = false;
  const baseUpdate = update;
  update = function () {
    if (ON && !PLAN.premium && st.river.on) { st.river.on = false; fillInputs(); if (!avisouRio) { avisouRio = true; setTimeout(() => plansDialog('Muro em leito de rio é um recurso Premium.'), 50); } }
    baseUpdate();
  };
  function applyGates() {
    const lbl = document.querySelector('label:has(#ron) b');
    if (lbl && !lbl.querySelector('.lock')) lbl.insertAdjacentHTML('beforeend', '<span class="lock">PREMIUM</span>');
    document.querySelectorAll('.lock').forEach(l => (l.hidden = !ON || PLAN.premium));
    const xi = document.querySelector('[data-exp="xlsx"]');
    if (xi) xi.innerHTML = 'Quantitativos e orçamento <span>' + (ON && !PLAN.premium ? 'Premium' : '.xlsx') + '</span>';
    avisouRio = true; update(); avisouRio = false;
  }
  document.getElementById('inputs').addEventListener('click', e => {
    if (e.target.id === 'ron' && ON && !PLAN.premium) { e.preventDefault(); plansDialog('Muro em leito de rio é um recurso Premium.'); }
  }, true);
  document.getElementById('exportMenu').addEventListener('click', e => {
    const b = e.target.closest('[data-exp="xlsx"]');
    if (b && ON && !PLAN.premium) { e.stopImmediatePropagation(); document.getElementById('exportMenu').hidden = true; plansDialog('A planilha de quantitativos e orçamento é um recurso Premium.'); }
  }, true);

  /* ---------- análise de foto pelo servidor ---------- */
  function toJpegB64(file) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, 1568 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.86).split(',')[1]); };
      img.onerror = () => { URL.revokeObjectURL(url); rej({ code: 'image_rejected' }); }; img.src = url;
    });
  }
  function parseJSON(t) { try { return JSON.parse(t); } catch (e) {} const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch (e) {} } const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} } throw { code: 'invalid_json' }; }
  const serverAI = {
    async ready() {
      if (!ON) return { ok: false, why: 'A análise de fotos estará disponível quando as contas forem ativadas.' };
      if (!PLAN.logged) return { ok: false, why: 'login' };
      return { ok: true };
    },
    async ask(prompt, files, signal) {
      const images = []; for (const f of files) images.push({ media_type: 'image/jpeg', data: await toJpegB64(f) });
      const { data: { session } } = await sb.auth.getSession();
      let r;
      try { r = await fetch(`${CFG.supabaseUrl}/functions/v1/analisar`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ prompt, images }) }); }
      catch (e) { throw { code: signal.aborted ? 'cancelled' : 'rede' }; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw { code: j.erro || 'http', status: r.status, message: j.mensagem };
      PLAN.usados = j.usados ?? PLAN.usados;
      setTimeout(() => aiStatus(PLAN.premium ? '' : `${PLAN.usados} de ${PLAN.limite} análises grátis usadas neste mês.`), 0);
      return parseJSON(j.text);
    },
    errText(e) {
      if (!e) return 'Não foi possível analisar agora.';
      if (e.code === 'cancelled') return 'Análise interrompida.';
      if (e.code === 'limite') { setTimeout(() => plansDialog(e.message), 0); return e.message || 'Limite do mês atingido.'; }
      if (e.code === 'login') { setTimeout(() => loginDialog('Entre para analisar fotos.'), 0); return 'Entre na sua conta para analisar fotos.'; }
      if (e.code === 'rede') return 'Sem conexão com a internet.';
      if (e.code === 'invalid_json') return 'A resposta veio incompleta. Clique em Analisar de novo.';
      return e.message || 'Não foi possível analisar agora. Tente de novo.';
    },
  };
  const baseAiInit = aiInit;
  aiInit = async function (backend) {
    await baseAiInit(backend);
    if (backend === serverAI && ON && !PLAN.logged) {
      const u = document.getElementById('aiUnavailable'); u.hidden = false; document.getElementById('aiBody').hidden = true;
      u.innerHTML = 'Entre na sua conta para analisar fotos. O plano grátis tem 3 análises por mês. <button class="btn primary" type="button" id="aiLogin">Entrar</button>';
      document.getElementById('aiLogin').onclick = () => loginDialog();
    } else if (backend === serverAI && PLAN.logged) {
      document.getElementById('aiBody').hidden = false; document.getElementById('aiUnavailable').hidden = true;
      aiStatus(PLAN.premium ? '' : `${PLAN.usados} de ${PLAN.limite} análises grátis usadas neste mês.`);
    }
  };

  /* ---------- projetos na nuvem ---------- */
  async function cloudSave() {
    if (!PLAN.logged) { loginDialog('Entre para salvar projetos na nuvem.'); return; }
    const row = { nome: st.nome || 'Projeto sem nome', dados: { app: 'GabiaoCAD', versao: 1, projeto: st } };
    const q = cloudId ? sb.from('projetos').update(row).eq('id', cloudId).select('id').single() : sb.from('projetos').insert(row).select('id').single();
    const { data, error } = await q;
    if (error) { if (/LIMITE_PROJETOS/.test(error.message)) plansDialog('O plano grátis guarda até 3 projetos na nuvem.'); else toast('Não foi possível salvar: ' + error.message); return; }
    cloudId = data.id; toast('Projeto salvo na nuvem.');
  }
  async function cloudList() {
    if (!PLAN.logged) { loginDialog('Entre para ver seus projetos.'); return; }
    const { data, error } = await sb.from('projetos').select('id, nome, atualizado_em').order('atualizado_em', { ascending: false });
    if (error) { toast('Não foi possível carregar: ' + error.message); return; }
    const d = dialog('Meus projetos', data.length ? `<div class="cloudlist">${data.map(p => `<div class="cloudrow"><div><b>${esc(p.nome)}</b><div class="meta">${new Date(p.atualizado_em).toLocaleString('pt-BR')}</div></div><div class="row-btns"><button class="btn" type="button" data-open="${p.id}">Abrir</button><button class="btn" type="button" data-del="${p.id}">Apagar</button></div></div>`).join('')}</div>${PLAN.premium ? '' : `<p class="help">Plano grátis: ${data.length} de 3 projetos.</p>`}` : '<p class="help">Nenhum projeto salvo ainda. Use "Salvar projeto na nuvem" em Minha conta.</p>');
    d.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => {
      const { data: p } = await sb.from('projetos').select('id, dados').eq('id', b.dataset.open).single();
      if (p) { st = sanitize(merge(DEFAULTS, p.dados.projeto || p.dados)); cloudId = p.id; renderLayers(); fillInputs(); update(); toast('Projeto aberto: ' + st.nome); d.close(); }
    });
    d.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Confirmar'; return; }
      await sb.from('projetos').delete().eq('id', b.dataset.del); if (cloudId === b.dataset.del) cloudId = null; d.close(); cloudList();
    });
  }

  /* ---------- volta do pagamento ---------- */
  if (/assinatura=retorno/.test(location.search)) {
    history.replaceState(null, '', location.pathname);
    toast('Pagamento em processamento. O Premium é liberado assim que o Mercado Pago confirmar.');
    let n = 0; const t = setInterval(async () => { await loadPlan(); if (PLAN.premium || ++n > 24) { clearInterval(t); if (PLAN.premium) toast('Premium liberado. Obrigado!'); } }, 5000);
  }

  if (/[?&]planos/.test(location.search)) setTimeout(() => plansDialog(), 600);
  if (ON) sb.auth.onAuthStateChange(() => loadPlan());
  renderAcct(); loadPlan();
  if (!ON) aiInit(serverAI);
})();
