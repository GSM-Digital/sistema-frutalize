# Integração do banco e acessos — administrador

## Separação das telas

- `/dashboard`, `/dashboard/producao` e `/dashboard/gestao/[module]`: gestão administrativa no mesmo layout. O detalhe `/dashboard/producao/[id]` mostra custos, insumos e lote de saída. Somente `staff_members.role = 'admin'` com `active = true` acessa essas páginas.
- `/terminal`: execução da produção. Administrador, gestor e colaborador ativos podem entrar; os comandos e dados disponíveis dependem do papel e das regras do banco. O terminal não mostra custos.
- O dashboard mantém o menu lateral como navegação principal em todas as páginas de gestão; no desktop, a lista de itens possui rolagem própria. A barra horizontal de módulos aparece somente na rota independente `/gestao/[module]`. Dashboard e terminal possuem links explícitos entre si, mas entrar em produção ou gestão não redireciona automaticamente para o terminal.

## Passos no Supabase

1. Confirmar o projeto Supabase usado pelo deploy e comparar o histórico remoto (`supabase_migrations.schema_migrations`) com todos os arquivos em `supabase/migrations/`. Não reaplicar migrações já registradas. Fazer backup e ter um plano de recuperação antes da atualização.
2. Aplicar somente as migrações pendentes, **na ordem dos nomes dos arquivos**. As versões adicionadas para os relatos e o preparo neste conjunto são:

   - `20261111045241_support_reports_and_admin_reasons.sql`
   - `20261111051042_support_report_context.sql`
   - `20261111052511_accept_current_fruit_category_for_production.sql`
   - `20261111143418_fruit_preparation_workflow.sql`
   - `20261111193237_preparation_guide_edit_and_pin_check.sql`

   Elas dependem do schema de estoque e produção anterior. Se qualquer migração anterior estiver pendente, aplique o conjunto completo em sequência desde a primeira versão ausente; não execute somente esses cinco arquivos isoladamente.

3. Confirmar suporte: tabela `public.support_reports`, políticas RLS de envio e triagem administrativa, colunas de autoria/origem, estados `todo`, `in_progress`, `done` e `discarded`, bucket privado `frutalize-support` e políticas de imagem. O bucket limita uploads a PNG/JPEG/WebP e 3,5 MiB. O envio fica disponível a membros ativos e clientes vinculados; a triagem está restrita ao administrador.
4. Confirmar preparo: tabelas `preparation_guides`, `preparation_batches` e `preparation_workers`; funções `preparation_snapshot` e `preparation_command`; coluna `lots.preparation_batch_id`; movimentos `preparation_input`, `preparation_return` e `preparation_output`; view `inventory_lots` atualizada; verificação que impede enviar fruta crua à despolpa quando existe guia aprovado. A migração cria a localização **Área de despolpa** se ainda não existir.
5. Conferir que a migração não exige lançamento manual de estoque legado: ela não inventa conversões, quantidades, pesos, baldes, datas ou participantes. Para frutas já descascadas antes da implantação, o responsável pelo estoque precisa reconciliar fisicamente cada lote e registrar apenas valores confirmados. Não registrar automaticamente os sacos mencionados no relato sem conferir os dados reais.
6. Para habilitar a operação, um administrador deve criar e aprovar guias reais por fruta em `/dashboard/preparo`. Cada pessoa deve configurar seu PIN individual em `/dashboard/conta`. Definir os destinos e locais usados pela fábrica e validar a separação dos terminais `/terminal` e `/terminal/preparo`. O aplicativo não fornece procedimento sanitário padrão.
7. Confirmar que `staff_members` contém as identidades Auth corretas, com `active = true` e papel compatível. Administradores usam o dashboard; os demais papéis ativos usam as telas operacionais conforme suas permissões. Não gravar senha, e-mail pessoal ou UUID em migrações.
8. No deploy, configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para esse mesmo projeto. Para convites, configurar `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor e `APP_ORIGIN` HTTPS; permitir `${APP_ORIGIN}/auth/confirm` no Supabase Auth.
9. Validar RLS, grants, buckets privados, fluxo com contas autorizadas e tablets antes do aceite físico. POPs, limites de qualidade e orientação sanitária devem vir dos responsáveis técnicos. A aplicação de migração e a CI verde não substituem aceite operacional.

O menu de tema usa o armazenamento local do navegador e não altera o schema. Em 12/11/2026, a página de migrações do projeto Supabase `ofemxaqzrnryrochqtrv` (branch `main`, ambiente `PRODUCTION`) mostrou as 17 versões presentes neste repositório, incluindo as cinco migrações de suporte e preparo acima. A verificação de `/api/health` retornou HTTP 200 com `app: ok` e `supabase: ok`. Não há migração pendente nesse projeto nesta data. Isso confirma o histórico registrado e a conectividade, mas não substitui o cadastro/aprovação de guias reais, configuração dos PINs nem a conciliação física de fruta previamente preparada.
