# Evolução de produção e gestão

Esta branch implementa a base de software para os módulos descritos no plano técnico de 27/10/2026. O uso físico da produção depende de POP, parâmetros de máquina, regra de qualidade, instrumento e embalagem aprovados pela operação e pelo responsável técnico. Nenhum valor desses itens é criado automaticamente. Ordens legadas precisam ser vinculadas explicitamente às versões aprovadas antes de avançar.

## Funcionalidades

- `/terminal`: operador autenticado com a própria conta, uma instrução aprovada por vez, revisão do checkpoint, reenvio idempotente, pausa, problema, medição, desvio e finalização. A tela não mostra custos. Não há logout automático por inatividade; a troca de operador é manual. A autenticação e a autorização são reavaliadas nas ações e RPCs.
- `/dashboard/producao/configuracao`: equipamentos, embalagens, POPs, perfis e regras de qualidade versionados, revisão e aprovação. A ordem congela as versões usadas. Ordens podem consumir mais de um lote, com locks em ordem estável e genealogia de entrada e saída.
- `/dashboard/gestao/inventory`, `/dashboard/gestao/receiving`, `/dashboard/gestao/staff`, `/dashboard/gestao/alerts`, `/dashboard/gestao/finance`, `/dashboard/gestao/commercial` e `/dashboard/gestao/time`: contagem e ajustes compensatórios, checklist de inspeção, documentos privados, vínculo de equipe e bloqueio imediato, alertas configuráveis, títulos e baixas financeiras, pedidos com reservas e expedição atômica, e apontamentos pessoais. Essas rotas usam o layout do dashboard para administradores. `/gestao/[module]` continua acessível diretamente aos papéis autorizados, com o mesmo conteúdo de módulo, sem navegação para o terminal.
- `/portal`: leitura de pedidos e rastreabilidade permitida ao cliente vinculado. Não há checkout, pagamento ou dados de custos/fornecedores.

Devolução comercial registra o material recebido sem recolocá-lo no saldo disponível. A destinação requer decisão técnica própria. Apontamentos de atividade não são ponto eletrônico oficial nem geram remuneração. A baixa financeira não movimenta contas bancárias.

## Implantação e limites

1. Criar projetos separados de desenvolvimento/homologação e backup/restauração verificados antes de migrar produção. Identificar o commit efetivamente implantado e as migrações presentes no Supabase remoto.
2. Aplicar as migrações `20261028100000`, `20261028110000` e `20261028110100` em homologação, nessa ordem. Verificar RLS, grants, Storage privado e views com contas reais de administrador, gestor, colaborador e cliente. Ensaiar restore antes de qualquer migração em produção.
3. Configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de homologação. Para convites, configurar **somente no servidor** `SUPABASE_SERVICE_ROLE_KEY` e `APP_ORIGIN` (origem HTTPS exata), além de permitir `${APP_ORIGIN}/auth/confirm` nas URLs de redirecionamento do Supabase Auth. Nunca colocar a service role no navegador nem no repositório.
4. Cadastrar e aprovar POPs, equipamentos, perfis e regras de qualidade reais. Validar os fluxos em tablet e com dados sintéticos. Definir critérios de liberação com os responsáveis técnicos antes de operação física.
5. Conferir todos os módulos e saldos no ambiente isolado. A migração de banco exige plano de restauração próprio; rollback do frontend não desfaz migrações.

Em 29/10/2026, as três migrações desta evolução foram aplicadas ao projeto Supabase de desenvolvimento. Uma cópia anterior às migrações foi salva fora do Git e o procedimento de reversão está em [Implantação das migrações no Supabase](Implantacao_Supabase_2026-10-29.md). Ainda não há projeto de homologação separado, restauração ensaiada, parâmetros sanitários aprovados ou aceite em equipamento físico. A instalação técnica não certifica prontidão operacional.

## Validação reproduzível

Com Node 22: `npm ci`, `npm run lint`, `npm run format:check`, `npm test`, `npm run typecheck` e `npm run build`. Os testes de banco fazem replay das migrações em PGlite com dados sintéticos, incluindo autorização, idempotência, revisão, qualidade, saldo, reservas, finanças e portal. PGlite não substitui um teste de múltiplas conexões em PostgreSQL/Supabase de homologação; esse teste e o aceite em tablet permanecem como gates de implantação.

## Acompanhamento de incidentes

Em erro ou conflito de checkpoint, consultar a ordem e o `command_id` antes de reenviar a mesma intenção. Em divergência de saldo, suspender expedição e contar o local/lote; usar movimento compensatório com motivo e aprovador, preservando o registro original. Em indisponibilidade do Supabase, manter a produção em ponto físico seguro definido no POP e registrar o incidente no procedimento operacional. Não continuar a produção com telemetria ou checkpoint presumidos.
