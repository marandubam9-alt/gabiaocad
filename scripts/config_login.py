"""Configura o login do Supabase pela API de gerenciamento (usado pelo workflow "Atualizar servidor").
Só altera estes itens: endereço do site, endereços de retorno permitidos e o texto dos e-mails de acesso (com código de 6 dígitos)."""
import json, os, sys, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pub = json.load(open(os.path.join(ROOT, 'config', 'publico.json'), encoding='utf-8'))
site = pub['siteUrl'].rstrip('/')
tpl = open(os.path.join(ROOT, 'supabase', 'templates', 'acesso.html'), encoding='utf-8').read()
corpo = {
    'site_url': site,
    'uri_allow_list': ','.join([f'{site}/app/', f'{site}/app/**', f'{site}/', 'gabiaocad://auth']),
    'mailer_subjects_magic_link': 'Seu código de acesso ao GabiãoCAD',
    'mailer_templates_magic_link_content': tpl,
    'mailer_subjects_confirmation': 'Seu código de acesso ao GabiãoCAD',
    'mailer_templates_confirmation_content': tpl,
}
req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{sys.argv[1]}/config/auth', data=json.dumps(corpo).encode(), method='PATCH',
                             headers={'Authorization': 'Bearer ' + os.environ['SUPABASE_ACCESS_TOKEN'], 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as r: print('login configurado:', r.status)
except urllib.error.HTTPError as e:
    print(f'::warning title=Login::Não consegui configurar o login automaticamente ({e.code}): {e.read().decode()[:400]}'); sys.exit(0)
