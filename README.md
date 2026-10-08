# Painel de Leads Novo

Painel separado do CRM 2.0 e do painel antigo. A aplicação usa Next.js, Supabase Auth e Supabase Database.

## Fluxo
1. Usuário entra com o e-mail que recebe os leads.
2. No primeiro acesso, aceita os termos.
3. O painel consulta apenas os leads permitidos pela política RLS.
4. A próxima etapa é conectar a ingestão dos e-mails do Google e gravar os leads automaticamente no Supabase.

## Variáveis
Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
