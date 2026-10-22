"""Monta o site (dist/site) e a pasta do programa para Windows (desktop/app).
Uso: npm ci && python3 scripts/build.py [site|desktop|all]
Variáveis para o site: SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL (opcionais; sem elas o site roda só no plano grátis local)."""
import json, os, re, shutil, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, NM = os.path.join(ROOT, 'src'), os.path.join(ROOT, 'node_modules')
VENDOR = [('three/build/three.min.js', 'three.min.js'), ('three/examples/js/controls/OrbitControls.js', 'OrbitControls.js'),
          ('jspdf/dist/jspdf.umd.min.js', 'jspdf.umd.min.js'), ('jspdf-autotable/dist/jspdf.plugin.autotable.min.js', 'jspdf.plugin.autotable.min.js'),
          ('exceljs/dist/exceljs.min.js', 'exceljs.min.js')]
SUPA = [('@supabase/supabase-js/dist/umd/supabase.js', 'supabase.js')]
read = lambda p: open(os.path.join(SRC, p), encoding='utf-8').read()

def fonts(out):
    os.makedirs(out, exist_ok=True); css = []
    for pkg, weights in [('ibm-plex-sans', [400, 500, 600]), ('ibm-plex-mono', [400, 500]), ('barlow-condensed', [600, 700])]:
        for w in weights:
            txt = open(os.path.join(NM, '@fontsource', pkg, f'{w}.css'), encoding='utf-8').read()
            for block in re.findall(r'/\*[^*]*\*/\s*@font-face\s*\{[^}]*\}', txt):
                sub = re.search(r'/\* (\S+) \*/', block).group(1)
                if not re.search(r'-(latin|latin-ext|greek)-\d+-normal$', sub): continue
                f = re.search(r'url\(\./files/([^)]+\.woff2)\)', block).group(1)
                shutil.copy(os.path.join(NM, '@fontsource', pkg, 'files', f), os.path.join(out, f))
                css.append(re.sub(r"src:[^;]+;", f"src: url(./{f}) format('woff2');", block))
    open(os.path.join(out, 'fonts.css'), 'w', encoding='utf-8').write('\n'.join(css))

def page(extra_js, vendor_names, head_extra='', csp="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' data: blob:; worker-src 'self' blob:"):
    t = read('template.html')
    t = re.sub(r'<link rel="preconnect"[^>]*>\s*', '', t)
    t = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^"]*">', '<link rel="stylesheet" href="fonts/fonts.css">', t)
    t = t.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    vendor = ''.join(f'<script src="vendor/{v}"></script>\n' for v in vendor_names)
    t = t.replace('<script>\n/*FONTS*/', vendor + '<script>\n/*FONTS*/')
    t = t.replace('/*FONTS*/', read('pdffont.js')).replace('/*CALC*/', read('calc.js')).replace('/*APP*/', read('app.js'))
    t = t.rstrip() + '\n<script>\n' + extra_js + '\n</script>\n'
    head = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            f'<meta http-equiv="Content-Security-Policy" content="{csp}">\n' + head_extra +
            '<style>:root{color-scheme:light}body{margin:0;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n')
    return head + t + '</body>\n</html>\n'

def vendor_copy(out, items):
    os.makedirs(out, exist_ok=True)
    for src, dst in items: shutil.copy(os.path.join(NM, src), os.path.join(out, dst))
    # o pacote UMD do supabase às vezes vem dividido em pedaços
    sd = os.path.join(NM, '@supabase/supabase-js/dist/umd')
    if any(d == 'supabase.js' for _, d in items):
        for f in os.listdir(sd):
            if f.endswith('.supabase.js'): shutil.copy(os.path.join(sd, f), os.path.join(out, f))

def build_site():
    out = os.path.join(ROOT, 'dist', 'site'); shutil.rmtree(out, ignore_errors=True)
    shutil.copytree(os.path.join(ROOT, 'site'), out)
    repo = os.environ.get('GITHUB_REPOSITORY', '')
    subs = {'{{DOWNLOAD_URL}}': os.environ.get('DOWNLOAD_URL') or (f'https://github.com/{repo}/releases/latest/download/GabiaoCAD-Setup.exe' if repo else '#download'),
            '{{CONTATO}}': os.environ.get('CONTATO', 'contato@gabiaocad.com.br'), '{{EMPRESA}}': os.environ.get('EMPRESA', '[NOME DA EMPRESA]'),
            '{{CNPJ}}': os.environ.get('CNPJ', '[CNPJ]'), '{{ENCARREGADO}}': os.environ.get('ENCARREGADO', '[NOME E E-MAIL]'), '{{DATA}}': os.environ.get('DATA_TERMOS', '22/10/2026')}
    for f in os.listdir(out):
        if f.endswith('.html'):
            p = os.path.join(out, f); t = open(p, encoding='utf-8').read()
            for k, v in subs.items(): t = t.replace(k, v)
            open(p, 'w', encoding='utf-8').write(t)
    app = os.path.join(out, 'app'); os.makedirs(app)
    vendor_copy(os.path.join(app, 'vendor'), VENDOR + SUPA); fonts(os.path.join(app, 'fonts'))
    supa, cfg, js = config_js()
    open(os.path.join(app, 'config.js'), 'w').write(js)
    connect = "'self' data: blob:" + (f' {supa}' if supa else '') + ' https://*.supabase.co'
    csp = f"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src {connect}; worker-src 'self' blob:; frame-src https://*.supabase.co"
    head = '<title>GabiãoCAD · programa</title>\n<link rel="icon" href="../assets/icon.png">\n<script src="config.js"></script>\n'
    html = page(read('web.js'), [v for _, v in VENDOR] + ['supabase.js'], head, csp)
    open(os.path.join(app, 'index.html'), 'w', encoding='utf-8').write(html)
    print('site ->', out, f'({len(html)//1024} KB app)', 'contas ligadas' if cfg['supabaseUrl'] else 'contas desligadas (sem SUPABASE_URL)')

def config_js(desktop=False):
    supa = os.environ.get('SUPABASE_URL', '').rstrip('/')
    cfg = {'supabaseUrl': supa, 'supabaseAnonKey': os.environ.get('SUPABASE_ANON_KEY', ''), 'siteUrl': os.environ.get('SITE_URL', ''), 'desktop': desktop}
    return supa, cfg, 'window.GABIAO_WEB = true;\nwindow.GABIAO_CONFIG = ' + json.dumps(cfg) + ';\n'

def build_desktop():
    app = os.path.join(ROOT, 'desktop', 'app'); shutil.rmtree(app, ignore_errors=True); os.makedirs(app)
    vendor_copy(os.path.join(app, 'vendor'), VENDOR + SUPA); fonts(os.path.join(app, 'fonts'))
    for f in ['icon.png', 'tutorial.mp4', 'tutorial-capa.webp']:
        shutil.copy(os.path.join(ROOT, 'site', 'assets', f), os.path.join(app, f))
    supa, cfg, js = config_js(desktop=True)
    open(os.path.join(app, 'config.js'), 'w').write(js)
    connect = "'self' data: blob:" + (f' {supa}' if supa else '') + ' https://*.supabase.co'
    csp = f"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self'; connect-src {connect}; worker-src 'self' blob:"
    html = page(read('desktop.js') + '\n' + read('web.js'), [v for _, v in VENDOR] + ['supabase.js'], '<script src="config.js"></script>\n', csp)
    open(os.path.join(app, 'index.html'), 'w', encoding='utf-8').write(html)
    print('desktop ->', app, 'contas ligadas' if supa else 'contas desligadas (sem SUPABASE_URL)')

if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what in ('site', 'all'): build_site()
    if what in ('desktop', 'all'): build_desktop()
