# GabiãoCAD

Projeto e verificação de muros de gabião: estabilidade (inclusive chuva, leito de rio e global), quantitativos, memorial em PDF e sugestão a partir de foto do local.

| Pasta | O que tem |
|---|---|
| `src/` | O programa: tela (`template.html`), cálculos (`calc.js`), interface (`app.js`), versão internet (`web.js`), versão Windows (`desktop.js`) |
| `site/` | Página de apresentação, termos de uso e privacidade |
| `supabase/` | Banco de dados e funções do servidor (contas, limite de fotos, Mercado Pago) |
| `desktop/` | Programa para Windows (Electron) |
| `scripts/build.py` | Monta o site (`dist/site`) e a pasta do programa Windows |
| `.github/workflows/` | Publicação automática do site, do servidor e do instalador |

## Colocar no ar, passo a passo

O site fica no **GitHub Pages** (grátis), as contas e o limite de fotos no **Supabase** (grátis até 50 mil usuários ativos por mês) e a cobrança no **Mercado Pago**. Tudo é publicado sozinho pelo GitHub a cada alteração.

### 1. GitHub Pages (site no ar)
1. No repositório: **Settings → Pages → Source: GitHub Actions**.
2. Em **Settings → Secrets and variables → Actions → Variables**, crie:
   - `SITE_URL` = endereço do site (ex.: `https://SEU-USUARIO.github.io/gabiaocad` ou `https://gabiaocad.com.br`)
   - `CONTATO` = e-mail de contato
3. Faça qualquer alteração (ou rode **Actions → Publicar site → Run workflow**). Em 2 minutos o site está no ar.

Sem as contas configuradas, o programa abre direto, sem login (modo de demonstração, sem foto com IA). Com o Supabase configurado, o site exige login, dá **3 horas de uso grátis** (o tempo só conta com o programa aberto e em uso) e depois mostra a tela de planos. O programa do Windows segue as mesmas regras com a mesma conta, desde que o instalador seja gerado depois de definir as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SITE_URL` no GitHub. Para mudar o prazo, troque `3 * 3600` em `limite_teste_seg()` na migração `supabase/migrations/20261023000000_teste_gratis.sql` e `TESTE_SEG` em `supabase/functions/_shared/logic.ts`.

### 2. Supabase (contas, projetos na nuvem, limite de fotos)
1. Crie um projeto em supabase.com (região São Paulo). Guarde a **senha do banco**.
2. Em **Project Settings → API**, copie a **URL** e a chave **anon public**.
3. Em **Authentication → URL Configuration**: Site URL = `SITE_URL`; Redirect URLs = `SITE_URL/app/` **e** `gabiaocad://auth` (este último é para o programa do Windows receber o login de volta do navegador).
4. Em **Authentication → Providers**: e-mail já vem ligado. Para "Entrar com Google", ligue o Google e cole o Client ID e o Secret criados no Google Cloud Console (tipo "Aplicativo da Web", URI de redirecionamento mostrada pelo próprio Supabase).
5. Em supabase.com → **Account → Access Tokens**, crie um token.
6. Coloque a **Project URL** e a chave **anon public** (ou *publishable*) em `config/publico.json`, no próprio repositório (são dados públicos). O código do projeto é tirado da URL. As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_PROJECT_REF` do GitHub continuam funcionando, mas o arquivo tem prioridade.
   **Secrets**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `ANTHROPIC_API_KEY` (console.anthropic.com, com créditos).
7. Rode **Actions → Atualizar servidor**. Ele cria as tabelas e publica as funções.

### 3. Mercado Pago (cobrança do Premium)
1. Em mercadopago.com.br/developers → **Suas integrações → Criar aplicação** (produto: Assinaturas).
2. Copie o **Access Token de produção** → Secret `MP_ACCESS_TOKEN` no GitHub.
3. Em **Webhooks → Configurar notificações**: URL `https://SEU-PROJETO.supabase.co/functions/v1/mp-webhook`, evento **Planos e assinaturas**. Salve e copie a **assinatura secreta** → Secret `MP_WEBHOOK_SECRET`.
4. Rode **Atualizar servidor** de novo.
5. Teste com as **contas de teste** do Mercado Pago antes de divulgar.

Preços e limites ficam em `supabase/functions/_shared/logic.ts` (`PRECOS`, `LIMITES`).
Plano Institucional: libere manualmente no Supabase (tabela `profiles`, coluna `plano` = `institucional`, `premium_ate` = data de vencimento).

### 4. Instalador para Windows
Crie uma tag `v0.6.0` (Releases → Draft a new release → Choose a tag). O GitHub gera o `GabiaoCAD-Setup.exe` e anexa ao release; o botão "Baixar para Windows" do site aponta para o mais recente.

### 5. Domínio próprio (opcional)
Registre `gabiaocad.com.br` no registro.br, aponte um CNAME para `SEU-USUARIO.github.io` e informe o domínio em **Settings → Pages → Custom domain**. Atualize `SITE_URL` e as URLs do Supabase.

## Desenvolvimento
```
npm ci
npm test                       # regras de plano, preços e assinatura do webhook
python3 scripts/build.py site  # gera dist/site
cd dist/site && python3 -m http.server 8000
```

## Vídeo tutorial

O vídeo `site/assets/tutorial.mp4` tem narração em português gerada pela voz livre **pt_BR "faber"** do Piper (licença MIT). O texto de cada fala está em `tutorial/roteiro.json`. Ao alterar esse arquivo, o GitHub gera as falas novas sozinho (workflow **Narração do tutorial**, ramo `narracao`); depois é só pedir para montar o vídeo de novo.
