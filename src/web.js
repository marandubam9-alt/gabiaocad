/* ===== GabiãoCAD na internet: contas, Premium e IA pelo servidor ===== */
(function () {
  if (!window.GABIAO_WEB) return;
  const CFG = window.GABIAO_CONFIG || {};
  const ON = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  const sb = ON ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
  const PLAN = { logged: false, email: '', plano: 'gratis', premium: false, estado: 'expirado', dias: 0, teste_ate: null, premium_ate: null, mp_status: null, usados: 0, limite: 5 };
  const TUTORIAL = '../assets/tutorial.mp4', TUTORIAL_CAPA = '../assets/tutorial-capa.webp';
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
  saveFile = async function (filename, data) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Arquivo baixado: ' + filename);
  };

  /* ---------- diálogo genérico ---------- */
  function dialog(title, html, wide) {
    const d = document.createElement('dialog'); d.className = 'gx' + (wide ? ' gxwide' : '');
    d.innerHTML = `<div class="gx-h"><h3>${title}</h3><button class="gx-x" type="button" aria-label="Fechar">×</button></div><div class="gx-b">${html}</div>`;
    document.body.appendChild(d); d.querySelector('.gx-x').onclick = () => d.close();
    d.addEventListener('close', () => d.remove()); d.showModal(); return d;
  }

  /* ---------- conta ---------- */
  const acct = document.createElement('div'); acct.className = 'acct';
  document.querySelector('.bar .actions').prepend(acct);
  const diasTxt = n => n <= 1 ? 'último dia' : `${n} dias`;
  function renderAcct() {
    const tut = '<button class="btn" type="button" id="tutBtn" title="Vídeo de 2 minutos ensinando a usar">▶ Como usar</button>';
    if (!ON) { acct.innerHTML = tut; document.getElementById('tutBtn').onclick = tutorialDialog; return; }
    const badge = PLAN.premium ? `<span class="planbadge pro">${PLAN.plano === 'estudante' ? 'Estudante' : 'Premium'}</span>`
      : `<span class="planbadge teste ${PLAN.dias <= 2 ? 'fim' : ''}" id="testeBadge" title="Ver planos">${PLAN.estado === 'teste' ? 'Teste · ' + diasTxt(PLAN.dias) : 'Teste encerrado'}</span>`;
    acct.innerHTML = tut + (PLAN.logged ? `${badge}<button class="btn" type="button" id="acctBtn">Minha conta</button>` : '');
    document.getElementById('tutBtn').onclick = tutorialDialog;
    const tb = document.getElementById('testeBadge'); if (tb) tb.onclick = () => plansDialog(`Seu teste grátis termina em ${new Date(PLAN.teste_ate).toLocaleDateString('pt-BR')}.`);
    const ab = document.getElementById('acctBtn'); if (ab) ab.onclick = accountDialog;
  }
  // formulário de entrada (usado na tela inicial e no diálogo)
  function loginForm(el, aoEnviar) {
    el.innerHTML = `<button class="btn primary" type="button" data-g="google">Entrar com Google</button>
      <div class="help" style="text-align:center">ou receba um link de acesso no e-mail</div>
      <div class="aikeyrow"><div class="inp"><input data-g="email" type="email" placeholder="seu@email.com" autocomplete="email"></div><button class="btn" type="button" data-g="send">Enviar link</button></div>
      <p class="help" data-g="msg">Estudante: entre com o e-mail da faculdade (.edu.br) para poder assinar o plano Estudante.</p>`;
    const volta = location.origin + location.pathname + location.search;
    el.querySelector('[data-g=google]').onclick = async () => { await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volta } }); };
    el.querySelector('[data-g=send]').onclick = async () => {
      const email = el.querySelector('[data-g=email]').value.trim(); if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Digite um e-mail válido.'); return; }
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: volta } });
      if (error) toast('Não foi possível enviar: ' + error.message);
      else { el.querySelector('[data-g=msg]').innerHTML = `<b>Link enviado para ${esc(email)}.</b> Abra seu e-mail e clique no link para entrar (veja também a caixa de spam).`; aoEnviar && aoEnviar(); }
    };
  }
  function loginDialog(motivo) {
    const d = dialog('Entrar', `${typeof motivo === 'string' ? `<p class="help">${esc(motivo)}</p>` : ''}<div class="login" style="display:grid;gap:10px"></div>`);
    loginForm(d.querySelector('.login'), () => setTimeout(() => d.close(), 2500));
  }

  /* ---------- tela de entrada e bloqueio ao fim do teste ---------- */
  const gate = document.createElement('div'); gate.id = 'gate'; gate.hidden = !ON;
  gate.innerHTML = '<div class="card"><p class="help">Carregando…</p></div>';
  document.body.appendChild(gate);
  const videoTag = (auto) => `<video class="tutv" controls preload="metadata" playsinline poster="${TUTORIAL_CAPA}" ${auto ? 'autoplay' : ''}><source src="${TUTORIAL}" type="video/mp4">Seu navegador não toca vídeo.</video>`;
  const topo = (titulo) => `<div class="top"><img src="../assets/icon.png" alt=""><div><h2>${titulo}</h2></div></div>`;
  const rodape = `<div class="foot"><a href="../">← Voltar para a página inicial</a><span><a href="../termos.html" target="_blank">Termos de uso</a> · <a href="../privacidade.html" target="_blank">Privacidade</a></span></div>`;
  let avisouFim = false;
  function renderGate() {
    if (!ON) { gate.hidden = true; return; }
    document.body.style.overflow = '';
    if (!PLAN.logged) {
      gate.innerHTML = `<div class="card">${topo('Teste o GabiãoCAD grátis por 7 dias')}
        <div class="cols"><div style="display:grid;gap:12px">
          <ul class="ok"><li>Muro de gabião completo: cálculo, corte, vista e 3D</li><li>Estabilidade, chuva, leito de rio e estabilidade global</li><li>Memorial em PDF e quantitativos</li><li>5 análises de foto do local com sugestão de projeto</li></ul>
          <p class="help">Sem cartão de crédito. Crie sua conta para começar; o teste conta a partir do primeiro acesso.</p>
          <div class="login"></div></div>
          <div style="display:grid;gap:8px">${videoTag(false)}<span class="help">Veja em 2 minutos como montar um muro no programa.</span></div></div>
        ${rodape}</div>`;
      loginForm(gate.querySelector('.login'));
    } else if (PLAN.estado === 'expirado') {
      gate.innerHTML = `<div class="card">${topo('Seu teste grátis terminou')}
        <p>Obrigado por testar o GabiãoCAD. Para continuar projetando, escolha um plano. Seus projetos salvos na nuvem continuam guardados e voltam assim que você assinar.</p>
        <div data-plans></div>
        <div class="foot"><span>Entrou como <b>${esc(PLAN.email)}</b> · <a href="#" data-sair>Sair</a> · <a href="#" data-tut>Ver o tutorial</a></span><span><a href="../termos.html" target="_blank">Termos</a> · <a href="../privacidade.html" target="_blank">Privacidade</a></span></div></div>`;
      fillPlans(gate.querySelector('[data-plans]'));
      gate.querySelector('[data-sair]').onclick = async e => { e.preventDefault(); await sb.auth.signOut(); cloudId = null; loadPlan(); };
      gate.querySelector('[data-tut]').onclick = e => { e.preventDefault(); tutorialDialog(); };
    } else {
      gate.hidden = true; gate.innerHTML = '';
      if (PLAN.estado === 'teste' && PLAN.dias <= 2 && !avisouFim) {
        avisouFim = true;
        let ja = false; try { ja = sessionStorage.getItem('gabiao-aviso-fim') === PLAN.teste_ate; sessionStorage.setItem('gabiao-aviso-fim', PLAN.teste_ate); } catch (e) {}
        if (!ja) setTimeout(() => plansDialog(PLAN.dias <= 1 ? 'Hoje é o último dia do seu teste grátis.' : `Faltam ${PLAN.dias} dias para o fim do seu teste grátis.`), 800);
      }
      return;
    }
    gate.hidden = false; document.body.style.overflow = 'hidden';
  }
  function tutorialDialog() {
    const d = dialog('Como usar o GabiãoCAD', `${videoTag(true)}
      <ol class="feat"><li><b>Projeto</b>: dê um nome e escolha as camadas de gabião (largura e altura de cada caixa).</li><li><b>Solos</b>: informe o aterro atrás do muro e a fundação.</li><li>Veja o <b>corte</b>, a <b>vista</b> e o <b>3D</b>; os resultados ficam verdes quando passam.</li><li>Use <b>Otimizar</b> para o programa achar a seção mais econômica que passa em tudo.</li><li><b>Exportar</b> gera o memorial em PDF e os quantitativos.</li></ol>`, true);
    const v = d.querySelector('video'); d.addEventListener('close', () => v.pause());
  }
  async function loadPlan() {
    if (!ON) return;
    const { data: { session } } = await sb.auth.getSession();
    PLAN.logged = !!session; PLAN.email = session?.user?.email || '';
    if (session) {
      const { data: p } = await sb.from('profiles').select('plano, premium_ate, mp_status, teste_ate').eq('id', session.user.id).single();
      const mes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
      const { data: u } = await sb.from('uso_ia').select('n').eq('mes', mes).maybeSingle();
      PLAN.plano = p?.plano || 'gratis'; PLAN.premium_ate = p?.premium_ate || null; PLAN.mp_status = p?.mp_status || null;
      PLAN.premium = PLAN.plano !== 'gratis' && (!PLAN.premium_ate || new Date(PLAN.premium_ate) > new Date());
      PLAN.teste_ate = p?.teste_ate || null;
      const resta = PLAN.teste_ate ? new Date(PLAN.teste_ate) - new Date() : 0;
      PLAN.estado = PLAN.premium ? 'premium' : resta > 0 ? 'teste' : 'expirado';
      PLAN.dias = resta > 0 ? Math.ceil(resta / 864e5) : 0;
      PLAN.limite = PLAN.premium ? 150 : 5; PLAN.usados = u?.n || 0;
    } else Object.assign(PLAN, { plano: 'gratis', premium: false, estado: 'expirado', dias: 0, teste_ate: null, usados: 0, limite: 5 });
    window.PDF_MARCA_DAGUA = PLAN.premium ? null : 'VERSÃO DE TESTE · GabiãoCAD';
    renderAcct(); renderGate(); aiInit(serverAI); applyGates();
  }
  function accountDialog() {
    const ate = PLAN.premium_ate ? new Date(PLAN.premium_ate).toLocaleDateString('pt-BR') : null;
    const d = dialog('Minha conta', `
      <div><b>${esc(PLAN.email)}</b><br><span class="help">Plano: ${PLAN.premium ? (PLAN.plano === 'estudante' ? 'Estudante' : 'Premium') : `Teste grátis · termina em ${new Date(PLAN.teste_ate).toLocaleDateString('pt-BR')}`}${PLAN.premium && ate ? (PLAN.mp_status === 'cancelled' ? ` · cancelado, acesso até ${ate}` : ` · renova até ${ate}`) : ''}</span></div>
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
    const d = dialog('GabiãoCAD Premium', `${motivo ? `<p><b>${esc(motivo)}</b></p>` : ''}<div data-plans></div>`);
    fillPlans(d.querySelector('[data-plans]'), () => d.close());
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
      if (!PLAN.logged) { fechar && fechar(); loginDialog('Entre na sua conta para assinar o Premium.'); return; }
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
  if (ON) sb.auth.onAuthStateChange(() => loadPlan());
  renderAcct(); loadPlan();
  if (!ON) aiInit(serverAI);
})();
