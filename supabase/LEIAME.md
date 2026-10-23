# Servidor do GabiãoCAD (Supabase)

- `migrations/`: tabelas, regras de acesso (RLS) e o teste grátis de 3 horas.
- `functions/`: análise de foto (`analisar`), assinatura (`assinar`, `cancelar`) e aviso de pagamento do Mercado Pago (`mp-webhook`).

Tudo é publicado automaticamente pelo workflow **Atualizar servidor (Supabase)** sempre que algo nesta pasta muda.

Se o workflow avisar "Nada foi publicado", a mensagem diz o que falta (endereço ou segredos).
