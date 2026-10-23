"""Configura o login do Supabase pela API de gerenciamento (usado pelo workflow "Atualizar servidor").
Só altera estes itens: endereço do site, endereços de retorno permitidos e o texto dos e-mails de acesso (com código de 6 dígitos)."""
import json, os, sys, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pub = json.load(open(os.path.join(ROOT, 'config', 'publico.json'), encoding='utf-8'))
site = pub['siteUrl'].rstrip('/')
tpl = open(os.path.join(ROOT, 'supabase', 'templates', 'acesso.html'), encoding='utf-8').read()
urls = {'site_url': site, 'uri_allow_list': ','.join([f'{site}/app/', f'{site}/app/**', f'{site}/', 'gabiaocad://auth'])}
emails = {
    'mailer_subjects_magic_link': 'Seu código de acesso ao GabiãoCAD',
    'mailer_templates_magic_link_content': tpl,
    'mailer_subjects_confirmation': 'Seu código de acesso ao GabiãoCAD',
    'mailer_templates_confirmation_content': tpl,
}
def patch(corpo, nome):
    req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{sys.argv[1]}/config/auth', data=json.dumps(corpo).encode(), method='PATCH',
                                 headers={'Authorization': 'Bearer ' + os.environ['SUPABASE_ACCESS_TOKEN'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r: print(nome, 'configurado:', r.status)
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:300]
        if 'custom SMTP' in msg: msg = 'o plano grátis só permite mudar o texto do e-mail com um provedor de e-mail próprio (SMTP). O login continua por link.'
        print(f'::warning title={nome}::{msg}')
patch(urls, 'Endereços do login')
patch(emails, 'E-mail com código')
