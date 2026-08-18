# Segurança Supabase — decisão registrada

## Estado após os endurecimentos

As migrações de governança de eventos, isolamento de tabelas e views, correção de `search_path`, restrição de execução de funções e realocação da extensão `vector` foram aplicadas ao projeto `ksdvzqvwhrmvgozobjbt`. A auditoria de segurança posterior passou a reportar somente um aviso: **proteção contra senhas vazadas desativada**.

| Item | Estado | Evidência |
|---|---|---|
| Funções com `search_path` mutável | Corrigido | Migração `20260818004000_harden_function_search_path_and_execution.sql` e nova execução do auditor sem esse alerta. |
| Execução pública de funções `SECURITY DEFINER` | Corrigida | Acesso de `anon` e `authenticated` removido das funções sem uso direto da PWA; `service_role` recebeu acesso explícito. |
| Extensão `vector` no schema `public` | Corrigido | Migração `20260818005000_move_vector_extension_to_extensions.sql` e auditor sem esse alerta. |
| Proteção contra senhas vazadas | Bloqueada pelo plano | A opção foi localizada em Authentication → Sign In / Providers → Email. O usuário aprovou sua ativação, mas o Supabase recusou o salvamento: o recurso requer plano Pro ou superior. |

> A proteção contra senhas vazadas permanece desativada por uma **restrição do plano Supabase atual**, não por ausência de autorização. O usuário aprovou a mudança, mas o painel retornou: “Configuring leaked password protection via HaveIBeenPwned.org is available on Pro Plans and up.” Ela deve ser ativada após uma eventual mudança para Pro, mediante nova validação do painel.

## Evidência de auditoria

O resultado mais recente do Supabase está em `/home/ubuntu/.mcp/tool-results/2026-08-18_00-36-50.198820360_supabase_get_advisors_c18ef882.json`. O aviso remanescente é `auth_leaked_password_protection`.
