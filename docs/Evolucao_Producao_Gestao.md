# Evolução de produção e gestão

> Em 11/11/2026, Thiago decidiu manter um único projeto Supabase. As verificações remotas devem respeitar os dados operacionais existentes. O histórico da implantação de 29/10/2026 permanece registrado abaixo.

Esta branch implementa a base de software para os módulos descritos no plano técnico de 27/10/2026. O uso físico da produção depende de POP, parâmetros de máquina, regra de qualidade, instrumento e embalagem aprovados pela operação e pelo responsável técnico. Nenhum valor desses itens é criado automaticamente. Ordens legadas precisam ser vinculadas explicitamente às versões aprovadas antes de avançar.

## Funcionalidades

- `/terminal`: operador autenticado com a própria conta, uma instrução aprovada por vez, revisão do checkpoint, reenvio idempotente, pausa, problema, medição, desvio e finalização. A tela não mostra custos. Não há logout automático por inatividade; a troca de operador é manual. A autenticação e a autorização são reavaliadas nas ações e RPCs.
- `/dashboard/producao/configuracao`: equipamentos, embalagens, POPs, perfis e regras de qualidade versionados, revisão e aprovação. A ordem congela as versões usadas. Ordens podem consumir mais de um lote, com locks em ordem estável e genealogia de entrada e saída.
- `/dashboard/gestao/inventory`, `/dashboard/gestao/receiving`, `/dashboard/gestao/staff`, `/dashboard/gestao/alerts`, `/dashboard/gestao/finance`, `/dashboard/gestao/commercial` e `/dashboard/gestao/time`: contagem e ajustes compensatórios, checklist de inspeção, documentos privados, vínculo de equipe e bloqueio imediato, alertas configuráveis, títulos e baixas financeiras, pedidos com reservas e expedição atômica, e apontamentos pessoais. Essas rotas usam o layout do dashboard para administradores. `/gestao/[module]` continua acessível diretamente aos papéis autorizados, com o mesmo conteúdo de módulo, sem navegação para o terminal.
- `/portal`: leitura de pedidos e rastreabilidade permitida ao cliente vinculado. Não há checkout, pagamento ou dados de custos/fornecedores.

Devolução comercial registra o material recebido sem recolocá-lo no saldo disponível. A destinação requer decisão técnica própria. Apontamentos de atividade não são ponto eletrônico oficial nem geram remuneração. A baixa financeira não movimenta contas bancárias.

## Implantação e limites

1. Identificar o commit efetivamente implantado, comparar as migrações presentes no projeto Supabase atual e verificar a disponibilidade do aplicativo. Não criar outro projeto por este plano.
2. Ensaiar mudanças de schema e regras com os testes locais antes de aplicá-las ao projeto atual. Conferir RLS, grants, Storage privado e views por leitura remota. Testes que gravam dados ou simulam concorrência não devem usar registros fictícios no banco ativo sem escopo e reversão definidos.
3. Configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` do projeto atual. Para convites, configurar **somente no servidor** `SUPABASE_SERVICE_ROLE_KEY` e `APP_ORIGIN` (origem HTTPS exata), além de permitir `${APP_ORIGIN}/auth/confirm` nas URLs de redirecionamento do Supabase Auth. Nunca colocar a service role no navegador nem no repositório.
4. Cadastrar e aprovar POPs, equipamentos, perfis e regras de qualidade reais. Validar os fluxos no tablet e com contas autorizadas. Definir critérios de liberação com os responsáveis técnicos antes de operação física.
5. Conferir módulos, saldos e acessos com operações reais autorizadas. Manter backup atual e plano de recuperação; não executar restauração sobre o banco ativo para ensaio. Rollback do frontend não desfaz migrações.

Em 29/10/2026, as três migrações desta evolução foram aplicadas ao projeto Supabase de desenvolvimento. Uma cópia anterior às migrações foi salva fora do Git e o procedimento de reversão está em [Implantação das migrações no Supabase](Implantacao_Supabase_2026-10-29.md). Ainda não há projeto de homologação separado, restauração ensaiada, parâmetros sanitários aprovados ou aceite em equipamento físico. A instalação técnica não certifica prontidão operacional.

Em 11/11/2026, o projeto `ofemxaqzrnryrochqtrv` foi reativado após uma pausa no plano Free. O endpoint público `/api/health` voltou a responder `200` com `supabase: ok`. O histórico remoto contém as 12 migrações versionadas; uma consulta somente de leitura confirmou zero tabelas comuns no schema `public` sem RLS, as funções `production_command` e `operations_command`, e o bucket `frutalize-receipts` privado. Leituras anônimas de `production_runs` e `staff_members` foram negadas. Os 46 testes locais, lint, tipagem, build e formatação dos arquivos versionados passaram. Login autenticado, operações reais com múltiplas sessões, restauração e uso no tablet físico não foram validados neste levantamento. A decisão de projeto único não substitui esses testes nem autoriza gravar dados fictícios no banco ativo.

## Validação reproduzível

Com Node 22: `npm ci`, `npm run lint`, `npm run format:check`, `npm test`, `npm run typecheck` e `npm run build`. Os testes de banco fazem replay das migrações em PGlite com dados sintéticos, incluindo autorização, idempotência, revisão, qualidade, saldo, reservas, finanças e portal. PGlite não substitui um teste de múltiplas conexões no PostgreSQL remoto; esse teste e o aceite em tablet permanecem pendentes até que possam ocorrer sem afetar os dados da fábrica.

## Acompanhamento de incidentes

Em erro ou conflito de checkpoint, consultar a ordem e o `command_id` antes de reenviar a mesma intenção. Em divergência de saldo, suspender expedição e contar o local/lote; usar movimento compensatório com motivo e aprovador, preservando o registro original. Em indisponibilidade do Supabase, manter a produção em ponto físico seguro definido no POP e registrar o incidente no procedimento operacional. Não continuar a produção com telemetria ou checkpoint presumidos.

## Correção de navegação dashboard/terminal — 29/10/2026

As regras visuais e o bloqueio de rolagem do terminal ficam limitados a `.production-terminal-route`; estilos globais no `body` não devem ocultar a navegação, o cabeçalho ou o rodapé do dashboard em transições do App Router. O retorno de uma ordem do terminal para `/dashboard/producao` foi conferido no navegador local, preservando o layout administrativo. O comando `npm test` agora descobre os arquivos `.test.ts` em `tests/` via `scripts/run-tests.mjs`, inclusive no Windows. Para desfazer a alteração após o merge, use `git revert <commit-da-correcao>`.
