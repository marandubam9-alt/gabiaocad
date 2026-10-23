/* ===== GabiãoCAD: contas, teste grátis de 3 horas, Premium e IA pelo servidor (site e programa instalado) ===== */
(function () {
  if (!window.GABIAO_WEB) return;
  const CFG = window.GABIAO_CONFIG || {};
  const DESK = !!window.desktop, D = window.desktop;          // programa instalado (Windows)
  const SITE = (CFG.siteUrl || '').replace(/\/$/, '');
  const ON = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  const sb = ON ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey,
    DESK ? { auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } } : undefined) : null;
  const ASSET = DESK ? './' : '../assets/', PAGE = DESK ? (SITE ? SITE + '/' : '') : '../';
  const VOLTA_APP = 'gabiaocad://auth';                      // retorno do login no programa instalado
  // estado: 'teste' | 'expirado' | 'premium' | 'offline'
  const PLAN = { logged: false, email: '', plano: 'gratis', premium: false, estado: 'expirado', usoSeg: 0, limiteSeg: 3 * 3600, premium_ate: null, mp_status: null, usados: 0, limite: 5 };
  const TUTORIAL = ASSET + 'tutorial.mp4', TUTORIAL_CAPA = ASSET + 'tutorial-capa.webp', ICON = DESK ? './icon.png' : '../assets/icon.png';
  const restante = () => Math.max(0, PLAN.limiteSeg - PLAN.usoSeg);
  function fmtTempo(seg) {
    const m = Math.floor(seg / 60), h = Math.floor(m / 60), mm = m % 60;
    if (m < 1) return 'menos de 1 min';
    return h ? `${h}h${mm ? ' ' + String(mm).padStart(2, '0') + 'min' : ''}` : `${m} min`;
  }
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
  .planbadge.teste{background:#fff4d6;border-color:#e8b931;color:#7a5600;cursor:pointer}
  .planbadge.teste.fim{background:#fde2dd;border-color:#d9534f;color:#8a1f1a}
  #gate{position:fixed;inset:0;z-index:50;background:var(--bg,#eef1f4);overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:32px 16px}
  #gate .card{width:min(760px,100%);background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.12);display:grid;gap:16px;padding:24px}
  #gate .top{display:flex;align-items:center;gap:12px}
  #gate .top img{width:48px;height:48px;border-radius:10px}
  #gate h2{margin:0;font-family:var(--f-display);font-size:28px;letter-spacing:.03em;text-transform:uppercase;line-height:1.1}
  #gate .cols{display:grid;grid-template-columns:1.1fr 1fr;gap:20px;align-items:start}
  @media (max-width:680px){#gate .cols{grid-template-columns:1fr}#gate{padding:16px}}
  #gate .login{display:grid;gap:10px}
  #gate video,.tutv{width:100%;border-radius:10px;border:1px solid var(--line);background:#0e1620;display:block}
  #gate .ok{margin:0;padding-left:18px;display:grid;gap:4px;font-size:14px}
  #gate .foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted)}
  #gate .foot a{color:var(--muted)}
  .gxwide{width:min(900px,calc(100vw - 32px))!important}
  .lock{font-size:10px;font-weight:700;background:var(--accent-soft);color:var(--accent);border-radius:99px;padding:1px 7px;margin-left:6px;vertical-align:middle}`;
  document.head.appendChild(css);

  /* ---------- download comum no navegador ---------- */
  if (!DESK) saveFile = async function (filename, data) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Arquivo baixado: ' + filename);
  };

  /* ---------- diálogo genérico ---------- */
  const TRAVADOS = new Set();   // diálogos que só fecham depois do login
  function dialog(title, html, wide, travado) {
    const d = document.createElement('dialog'); d.className = 'gx' + (wide ? ' gxwide' : '');
    d.innerHTML = `<div class="gx-h"><h3>${title}</h3>${travado ? '' : '<button class="gx-x" type="button" aria-label="Fechar">×</button>'}</div><div class="gx-b">${html}</div>`;
    document.body.appendChild(d);
    if (travado) { TRAVADOS.add(d); d.addEventListener('cancel', e => e.preventDefault()); d.liberar = () => { TRAVADOS.delete(d); d.close(); }; }
    else d.querySelector('.gx-x').onclick = () => d.close();
    d.addEventListener('close', () => { if (TRAVADOS.has(d)) { d.showModal(); return; } d.remove(); });
    d.showModal(); return d;
  }

  /* ---------- conta ---------- */
  const acct = document.createElement('div'); acct.className = 'acct';
  document.querySelector('.bar .actions').prepend(acct);
  function renderAcct() {
    const tut = '<button class="btn" type="button" id="tutBtn" title="Vídeo ensinando a usar o programa, com capítulos">▶ Como usar</button>';
    if (!ON) { acct.innerHTML = tut; document.getElementById('tutBtn').onclick = tutorialDialog; return; }
    const badge = PLAN.premium ? `<span class="planbadge pro">${PLAN.plano === 'estudante' ? 'Estudante' : 'Premium'}</span>`
      : `<span class="planbadge teste ${restante() <= 20 * 60 ? 'fim' : ''}" id="testeBadge" title="Tempo de teste que ainda resta. Clique para ver os planos.">${PLAN.estado === 'teste' ? 'Teste · ' + fmtTempo(restante()) : 'Teste encerrado'}</span>`;
    acct.innerHTML = tut + (PLAN.logged ? `${PLAN.estado === 'offline' ? '<span class="planbadge">Sem conexão</span>' : badge}<button class="btn" type="button" id="acctBtn">Minha conta</button>` : '');
    document.getElementById('tutBtn').onclick = tutorialDialog;
    const tb = document.getElementById('testeBadge'); if (tb) tb.onclick = () => plansDialog(`Restam ${fmtTempo(restante())} do seu teste grátis. O tempo só conta enquanto você usa o programa.`);
    const ab = document.getElementById('acctBtn'); if (ab) ab.onclick = accountDialog;
  }
  // formulário de entrada (usado na tela inicial e no diálogo)
  function loginForm(el, aoEnviar) {
    el.innerHTML = `<button class="btn primary" type="button" data-g="google">Entrar com Google</button>
      <div class="help" style="text-align:center">ou receba um link de acesso no e-mail</div>
      <div class="aikeyrow"><div class="inp"><input data-g="email" type="email" placeholder="seu@email.com" autocomplete="email"></div><button class="btn" type="button" data-g="send">Enviar link</button></div>
      <p class="help" data-g="msg">Estudante: entre com o e-mail da faculdade (.edu.br) para poder assinar o plano Estudante.</p>`;
    const volta = DESK ? VOLTA_APP : location.origin + location.pathname + location.search;
    const msg = el.querySelector('[data-g=msg]');
    el.querySelector('[data-g=google]').onclick = async () => {
      if (!DESK) { await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volta } }); return; }
      const { data, error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volta, skipBrowserRedirect: true } });
      if (error || !data?.url) { toast('Não foi possível abrir o login: ' + (error?.message || 'sem conexão')); return; }
      D.openExternal(data.url);
      msg.innerHTML = '<b>Continue no navegador.</b> Depois de entrar, o navegador pergunta se pode abrir o GabiãoCAD: clique em <b>Abrir</b>.';
    };
    el.querySelector('[data-g=send]').onclick = async () => {
      const email = el.querySelector('[data-g=email]').value.trim(); if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Digite um e-mail válido.'); return; }
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: volta } });
      if (error) toast('Não foi possível enviar: ' + error.message);
      else { msg.innerHTML = `<b>Link enviado para ${esc(email)}.</b> Abra seu e-mail ${DESK ? 'neste computador ' : ''}e clique no link para entrar (veja também a caixa de spam).${DESK ? ' O navegador vai perguntar se pode abrir o GabiãoCAD: clique em <b>Abrir</b>.' : ''}`; aoEnviar && aoEnviar(); }
    };
  }
  function loginDialog(motivo) {
    const d = dialog('Entrar', `${typeof motivo === 'string' ? `<p class="help">${esc(motivo)}</p>` : ''}<div class="login" style="display:grid;gap:10px"></div>`);
    loginForm(d.querySelector('.login'), () => setTimeout(() => d.close(), 2500));
  }
  // programa instalado: o navegador devolve gabiaocad://auth?code=... depois do login
  async function retornoLogin(url) {
    try {
      const u = new URL(url), code = u.searchParams.get('code'), erro = u.searchParams.get('error_description') || new URLSearchParams(u.hash.slice(1)).get('error_description');
      if (erro) { toast('Não foi possível entrar: ' + erro); return; }
      if (!code) return;
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) toast('Não foi possível entrar: ' + error.message + '. Peça um link novo.'); else { toast('Você entrou na sua conta.'); loadPlan(); }
    } catch (e) { toast('Link de acesso inválido.'); }
  }
  if (DESK && ON && D.onAuthUrl) { D.onAuthUrl(retornoLogin); D.takePendingAuth().then(u => u && retornoLogin(u)); }

  /* ---------- tela de entrada e bloqueio ao fim do teste ---------- */
  const gate = document.createElement('div'); gate.id = 'gate'; gate.hidden = !ON;
  gate.innerHTML = '<div class="card"><p class="help">Carregando…</p></div>';
  document.body.appendChild(gate);
  const videoTag = (auto) => `<video class="tutv" controls preload="metadata" playsinline poster="${TUTORIAL_CAPA}" ${auto ? 'autoplay' : ''}><source src="${TUTORIAL}" type="video/mp4">Seu navegador não toca vídeo.</video>`;
  const topo = (titulo) => `<div class="top"><img src="${ICON}" alt=""><div><h2>${titulo}</h2></div></div>`;
  const legais = PAGE ? `<span><a href="${PAGE}termos.html" target="_blank">Termos de uso</a> · <a href="${PAGE}privacidade.html" target="_blank">Privacidade</a></span>` : '';
  const rodape = `<div class="foot">${DESK ? '<span></span>' : '<a href="../">← Voltar para a página inicial</a>'}${legais}</div>`;
  let avisouFim = false;
  function renderGate() {
    aplicarBloqueio();
    if (!ON) { gate.hidden = true; return; }
    document.body.style.overflow = '';
    if (!PLAN.logged) {
      gate.innerHTML = `<div class="card">${topo('Teste o GabiãoCAD grátis por 3 horas')}
        <div class="cols"><div style="display:grid;gap:12px">
          <ul class="ok"><li>Muro de gabião completo: cálculo, corte, vista e 3D</li><li>Estabilidade, chuva, leito de rio e estabilidade global</li><li>Memorial em PDF e quantitativos</li><li>5 análises de foto do local com sugestão de projeto</li></ul>
          <p class="help">Sem cartão de crédito. São 3 horas de uso: o tempo só conta enquanto o programa está aberto e você está usando.${DESK ? ' O programa precisa de internet para entrar na conta.' : ''}</p>
          <div class="login"></div></div>
          <div style="display:grid;gap:8px">${videoTag(false)}<span class="help">Veja como montar um muro no programa. A segunda parte explica cada campo e cada tabela.</span></div></div>
        ${rodape}</div>`;
      loginForm(gate.querySelector('.login'));
    } else if (PLAN.estado === 'expirado') {
      gate.innerHTML = `<div class="card">${topo('Seu teste grátis terminou')}
        <p>Obrigado por testar o GabiãoCAD. Para continuar projetando, escolha um plano. Seus projetos salvos na nuvem continuam guardados e voltam assim que você assinar.</p>
        <div data-plans></div>
        <div class="foot"><span>Entrou como <b>${esc(PLAN.email)}</b> · <a href="#" data-sair>Sair</a> · <a href="#" data-tut>Ver o tutorial</a></span>${legais}</div></div>`;
      fillPlans(gate.querySelector('[data-plans]'));
      gate.querySelector('[data-sair]').onclick = async e => { e.preventDefault(); await sb.auth.signOut(); cloudId = null; loadPlan(); };
      gate.querySelector('[data-tut]').onclick = e => { e.preventDefault(); tutorialDialog(); };
    } else if (PLAN.estado === 'offline') {
      gate.innerHTML = `<div class="card">${topo('Sem conexão com a internet')}
        <p>O GabiãoCAD precisa de internet para conferir sua conta e contar o tempo do teste grátis. Assinantes podem usar o programa instalado sem internet por até 7 dias depois da última conexão.</p>
        <div class="row-btns"><button class="btn primary" type="button" data-retry>Tentar de novo</button></div>${rodape}</div>`;
      gate.querySelector('[data-retry]').onclick = () => { gate.querySelector('[data-retry]').textContent = 'Conectando…'; loadPlan(); };
    } else {
      gate.hidden = true; gate.innerHTML = '';
      avisoFim();
      return;
    }
    gate.hidden = false; document.body.style.overflow = 'hidden';
  }
  /* sem conta, teste encerrado ou sem conexão: além da tela, desliga todos os comandos do programa */
  const bloqueado = () => ON && (!PLAN.logged || PLAN.estado === 'expirado' || PLAN.estado === 'offline');
  function aplicarBloqueio() {
    const b = bloqueado(); window.GABIAO_BLOQUEADO = b;
    ['main.app', '#projName', '#btnOpen', '#btnExport', '#exportMenu', '#fileOpen'].forEach(q => { const e = document.querySelector(q); if (e && e.inert !== b) e.inert = b; });
    if (b) { const m = document.getElementById('exportMenu'); if (m && !m.hidden) m.hidden = true; }
  }
  // comandos que não rodam com o acesso bloqueado
  const avisoBloqueio = () => { if (!PLAN.logged) loginDialog('Entre na sua conta para usar o GabiãoCAD.'); else if (PLAN.estado === 'offline') toast('Sem conexão com a internet.'); else plansDialog('Seu teste grátis terminou. Assine para continuar usando o programa.'); };
  ['saveFile', 'exportPdf', 'exportXlsx', 'runOptimize', 'aiGo', 'update'].forEach(n => {
    const orig = window[n]; if (typeof orig !== 'function') return;
    window[n] = function (...a) { if (bloqueado()) { if (n !== 'update') avisoBloqueio(); return; } return orig.apply(this, a); };
  });
  // se a tela de bloqueio for removida ou escondida à força, ela volta
  function vigiarGate() {
    if (!bloqueado()) return;
    if (!gate.isConnected) document.body.appendChild(gate);
    if (gate.hidden || getComputedStyle(gate).display === 'none' || getComputedStyle(gate).visibility === 'hidden') { gate.hidden = false; gate.style.cssText = ''; renderGate(); }
    aplicarBloqueio();
  }
  new MutationObserver(vigiarGate).observe(document.body, { childList: true, attributes: true, subtree: true, attributeFilter: ['hidden', 'style', 'inert', 'class'] });
  setInterval(vigiarGate, 2000);
  function avisoFim() {
    if (PLAN.estado !== 'teste' || restante() > 15 * 60 || avisouFim) return;
    avisouFim = true;
    setTimeout(() => plansDialog(`Faltam ${fmtTempo(restante())} para acabar o seu teste grátis. Assine para continuar sem interrupção.`), 800);
  }
  // capítulos do vídeo (segundos)
  const CAPITULOS = [[0, 'Início rápido'], [143, 'Cada campo dos dados'], [454, 'Resultados e tabelas']];
  const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  function tutorialDialog() {
    const d = dialog('Como usar o GabiãoCAD', `${videoTag(true)}
      <div class="row-btns" style="align-items:center"><span class="help">Ir para:</span>${CAPITULOS.map(([t, n]) => `<button class="btn" type="button" data-t="${t}">${mmss(t)} · ${n}</button>`).join('')}</div>`, true);
    const v = d.querySelector('video'); d.addEventListener('close', () => v.pause());
    d.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { v.currentTime = +b.dataset.t; v.play().catch(() => {}); });
  }
  // último plano confirmado (para o programa instalado funcionar sem internet, só para assinantes)
  const CACHE = 'gabiao-plano';
  function lerCache() { try { return JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { return null; } }
  function gravarCache(v) { try { v ? localStorage.setItem(CACHE, JSON.stringify(v)) : localStorage.removeItem(CACHE); } catch (e) {} }
  async function loadPlan() {
    if (!ON) return;
    const { data: { session } } = await sb.auth.getSession();
    PLAN.logged = !!session; PLAN.email = session?.user?.email || '';
    if (session) {
      const { data: p, error } = await sb.from('profiles').select('plano, premium_ate, mp_status, uso_seg').eq('id', session.user.id).single();
      if (error || !p) {
        const c = lerCache(), agora = Date.now();
        const vale = DESK && c && c.premium && c.id === session.user.id && agora - c.verificado < 7 * 864e5 && (!c.premium_ate || new Date(c.premium_ate) > agora);
        if (vale) Object.assign(PLAN, { plano: c.plano, premium: true, premium_ate: c.premium_ate, estado: 'premium' });
        else PLAN.estado = 'offline';
      } else {
        const mes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
        const { data: u } = await sb.from('uso_ia').select('n').eq('mes', mes).maybeSingle();
        PLAN.plano = p.plano || 'gratis'; PLAN.premium_ate = p.premium_ate || null; PLAN.mp_status = p.mp_status || null;
        PLAN.premium = PLAN.plano !== 'gratis' && (!PLAN.premium_ate || new Date(PLAN.premium_ate) > new Date());
        PLAN.usoSeg = p.uso_seg || 0;
        PLAN.estado = PLAN.premium ? 'premium' : restante() > 0 ? 'teste' : 'expirado';
        PLAN.limite = PLAN.premium ? 150 : 5; PLAN.usados = u?.n || 0;
        gravarCache({ id: session.user.id, plano: PLAN.plano, premium: PLAN.premium, premium_ate: PLAN.premium_ate, verificado: Date.now() });
      }
    } else { Object.assign(PLAN, { plano: 'gratis', premium: false, estado: 'expirado', usoSeg: 0, usados: 0, limite: 5 }); gravarCache(null); }
    window.PDF_MARCA_DAGUA = PLAN.premium ? null : 'VERSÃO DE TESTE · GabiãoCAD';
    if (PLAN.logged) [...TRAVADOS].forEach(d => d.liberar());
    renderAcct(); renderGate(); aiInit(serverAI); applyGates();
    if (PLAN.estado === 'teste') ping(true);
  }

  /* ---------- contagem do tempo de teste: um sinal por minuto de uso ativo ---------- */
  let ultimaAcao = Date.now(), falhas = 0;
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { ultimaAcao = Date.now(); }, { passive: true, capture: true }));
  async function ping(forcar) {
    if (!ON || !PLAN.logged || PLAN.estado !== 'teste') return;
    if (!forcar && (document.hidden || Date.now() - ultimaAcao > 2 * 60000)) return;   // parado ou em outra janela: não conta
    const { data, error } = await sb.rpc('registrar_uso');
    if (error || !data) { if (++falhas >= 3) { falhas = 0; PLAN.estado = 'offline'; renderGate(); } return; }
    falhas = 0; PLAN.usoSeg = data.uso_seg; PLAN.limiteSeg = data.limite_seg || PLAN.limiteSeg;
    if (data.premium || !data.liberado) { loadPlan(); return; }
    renderAcct(); avisoFim();
  }
  setInterval(() => ping(false), 60000);
  function accountDialog() {
    const ate = PLAN.premium_ate ? new Date(PLAN.premium_ate).toLocaleDateString('pt-BR') : null;
    const d = dialog('Minha conta', `
      <div><b>${esc(PLAN.email)}</b><br><span class="help">Plano: ${PLAN.premium ? (PLAN.plano === 'estudante' ? 'Estudante' : 'Premium') : `Teste grátis · restam ${fmtTempo(restante())} de uso`}${PLAN.premium && ate ? (PLAN.mp_status === 'cancelled' ? ` · cancelado, acesso até ${ate}` : ` · renova até ${ate}`) : ''}</span></div>
      <div class="help">Análises de foto ${PLAN.premium ? 'neste mês' : 'do teste'}: <b>${PLAN.usados} de ${PLAN.premium ? 'uso livre' : PLAN.limite}</b></div>
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
    if (ON && !PLAN.logged) {
      // sem conta: a janela de planos só fecha depois de entrar
      const d = dialog('GabiãoCAD Premium', `${motivo ? `<p><b>${esc(motivo)}</b></p>` : ''}
        <p><b>Entre na sua conta para continuar.</b> Depois de entrar você escolhe o plano ou começa o teste grátis de 3 horas.</p>
        <div class="login" style="display:grid;gap:10px"></div><div data-plans></div>`, false, true);
      loginForm(d.querySelector('.login'));
      fillPlans(d.querySelector('[data-plans]'));
      return d;
    }
    const d = dialog('GabiãoCAD Premium', `${motivo ? `<p><b>${esc(motivo)}</b></p>` : ''}<div data-plans></div>`);
    fillPlans(d.querySelector('[data-plans]'), () => d.close());
    return d;
  }
  function fillPlans(el, fechar) {
    el.style.display = 'grid'; el.style.gap = '12px';
    el.innerHTML = `<ul class="feat"><li>Programa completo, sem prazo: cálculo, chuva, leito de rio e estabilidade global</li><li>Memorial em PDF sem marca d'água</li><li>Planilha de quantitativos e orçamento (Excel)</li><li>Análise de foto sem limite (uso justo)</li><li>Projetos ilimitados na nuvem</li></ul>
      <div class="plans">
        <div class="plan"><span class="pn">Mensal</span><span class="pp">R$ 39,90<small>/mês</small></span><button class="btn" type="button" data-op="mensal">Assinar</button></div>
        <div class="plan best"><span class="pn">Anual</span><span class="pp">R$ 349<small>/ano</small></span><span class="help">2 meses e meio de desconto</span><button class="btn primary" type="button" data-op="anual">Assinar</button></div>
        <div class="plan"><span class="pn">Estudante</span><span class="pp">R$ 9,90<small>/mês</small></span><span class="help">com e-mail .edu.br</span><button class="btn" type="button" data-op="estudante">Assinar</button></div>
      </div>
      <p class="help">Pagamento pelo Mercado Pago (cartão ou saldo). Cancele quando quiser; 7 dias de arrependimento na primeira assinatura.</p>`;
    el.querySelectorAll('[data-op]').forEach(b => b.onclick = async () => {
      if (!PLAN.logged) { const f = el.closest('dialog')?.querySelector('[data-g=email]'); if (f) { f.focus(); toast('Entre na sua conta primeiro.'); return; } fechar && fechar(); loginDialog('Entre na sua conta para assinar o Premium.'); return; }
      b.disabled = true; b.textContent = 'Abrindo…';
      const r = await callFn('assinar', { opcao: b.dataset.op });
      if (r.url && DESK) {
        D.openExternal(r.url); fechar && fechar(); b.disabled = false; b.textContent = 'Assinar';
        toast('Conclua o pagamento no navegador. O Premium é liberado aqui assim que o Mercado Pago confirmar.');
        let n = 0; const t = setInterval(async () => { await loadPlan(); if (PLAN.premium || ++n > 180) { clearInterval(t); if (PLAN.premium) toast('Premium liberado. Obrigado!'); } }, 5000);
      } else if (r.url) location.href = r.url; else { toast(r.mensagem || 'Não foi possível abrir o pagamento.'); b.disabled = false; b.textContent = 'Assinar'; }
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
  function applyGates() {
    const xi = document.querySelector('[data-exp="xlsx"]');
    if (xi) xi.innerHTML = 'Quantitativos e orçamento <span>' + (ON && !PLAN.premium ? 'Premium' : '.xlsx') + '</span>';
  }
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
      setTimeout(() => aiStatus(PLAN.premium ? '' : `${PLAN.usados} de ${PLAN.limite} análises do teste grátis usadas.`), 0);
      return parseJSON(j.text);
    },
    errText(e) {
      if (!e) return 'Não foi possível analisar agora.';
      if (e.code === 'cancelled') return 'Análise interrompida.';
      if (e.code === 'limite') { setTimeout(() => plansDialog(e.message), 0); return e.message || 'Limite do mês atingido.'; }
      if (e.code === 'teste_fim') { setTimeout(loadPlan, 0); return e.message || 'Seu teste grátis terminou.'; }
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
      u.innerHTML = 'Entre na sua conta para analisar fotos. O teste grátis tem 5 análises. <button class="btn primary" type="button" id="aiLogin">Entrar</button>';
      document.getElementById('aiLogin').onclick = () => loginDialog();
    } else if (backend === serverAI && PLAN.logged) {
      document.getElementById('aiBody').hidden = false; document.getElementById('aiUnavailable').hidden = true;
      aiStatus(PLAN.premium ? '' : `${PLAN.usados} de ${PLAN.limite} análises do teste grátis usadas.`);
    }
  };

  /* ---------- projetos na nuvem ---------- */
  async function cloudSave() {
    if (!PLAN.logged) { loginDialog('Entre para salvar projetos na nuvem.'); return; }
    const row = { nome: st.nome || 'Projeto sem nome', dados: { app: 'GabiaoCAD', versao: 1, projeto: st } };
    const q = cloudId ? sb.from('projetos').update(row).eq('id', cloudId).select('id').single() : sb.from('projetos').insert(row).select('id').single();
    const { data, error } = await q;
    if (error) { if (/LIMITE_PROJETOS/.test(error.message)) plansDialog('O teste grátis guarda até 3 projetos na nuvem.'); else if (/TESTE_ENCERRADO/.test(error.message)) loadPlan(); else toast('Não foi possível salvar: ' + error.message); return; }
    cloudId = data.id; toast('Projeto salvo na nuvem.');
  }
  async function cloudList() {
    if (!PLAN.logged) { loginDialog('Entre para ver seus projetos.'); return; }
    const { data, error } = await sb.from('projetos').select('id, nome, atualizado_em').order('atualizado_em', { ascending: false });
    if (error) { toast('Não foi possível carregar: ' + error.message); return; }
    const d = dialog('Meus projetos', data.length ? `<div class="cloudlist">${data.map(p => `<div class="cloudrow"><div><b>${esc(p.nome)}</b><div class="meta">${new Date(p.atualizado_em).toLocaleString('pt-BR')}</div></div><div class="row-btns"><button class="btn" type="button" data-open="${p.id}">Abrir</button><button class="btn" type="button" data-del="${p.id}">Apagar</button></div></div>`).join('')}</div>${PLAN.premium ? '' : `<p class="help">Teste grátis: ${data.length} de 3 projetos.</p>`}` : '<p class="help">Nenhum projeto salvo ainda. Use "Salvar projeto na nuvem" em Minha conta.</p>');
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
  if (DESK && D.onMenu) D.onMenu(a => {
    if (a === 'tutorial') tutorialDialog();
    else if (a === 'account' && ON) PLAN.logged ? accountDialog() : loginDialog();
  });
  if (ON) sb.auth.onAuthStateChange(() => loadPlan());
  renderAcct(); loadPlan();
  if (!ON && !DESK) aiInit(serverAI);
})();
