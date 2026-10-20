# Primeira entrega operacional do estoque

Esta implementação segue os [requisitos consolidados](Requisitos_Sistema_Frutalize.md) e o [contexto da fábrica](Contexto_Completo_Frutalize.md), adicionados na `main` pelo commit `f64ea24`. É uma primeira fatia funcional do MVP, não o encerramento de todos os requisitos.

## Disponível nesta entrega

| Área            | Comportamento implementado                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Painel          | Indicadores reais do banco, últimas movimentações e alerta de lotes vencidos                                                                                           |
| Produtos        | Produto principal, categoria e obrigatoriedade de validade                                                                                                             |
| Apresentações   | Cadastro separado, SKU editável e peso unitário conhecido opcional                                                                                                     |
| Categorias      | Nove categorias iniciais confirmadas; inclusão, edição e arquivamento                                                                                                  |
| Locais          | Seis locais ativos, incluindo os três freezers; o antigo local “Quarentena” permanece arquivado para preservar o histórico                                             |
| Fornecedores    | Nome, CNPJ opcional, telefone, endereço e pessoa de contato                                                                                                            |
| Recebimento     | Apresentação, fornecedor, referência/NF, lote interno e do fornecedor, local físico, data/hora operacional, fabricação, validade e sua origem, inspeção em texto livre |
| Quantidades     | Unidade por recebimento: kg, g, l, un, pct ou cx; peso líquido independente quando informado                                                                           |
| Custo           | Preço total da entrada e custo unitário calculado no PostgreSQL, preservados no lote para integração financeira futura                                                 |
| Conferência     | Observação de inspeção obrigatória; o lote recebido fica disponível imediatamente, respeitando saldo e validade                                                        |
| Saídas e perdas | Movimentações por lote com quantidade, data operacional, motivo e responsável                                                                                          |
| Consulta        | Busca por produto, SKU, lote, fornecedor e local; filtros por validade e saldo; paginação no servidor                                                                  |
| Histórico       | Livro imutável de movimentos e auditoria de criação, edição e arquivamento de cadastros, com antes/depois                                                              |
| Acesso          | Sessão verificada no servidor; vínculo e papel em tabela protegida; apenas administrador ativo habilitado nesta fase                                                   |
| Login           | Estado de envio, retorno seguro ao caminho solicitado e integração opcional com Turnstile validada no servidor                                                         |
| Qualidade       | TypeScript, lint, formatação, testes de validação e PostgreSQL embarcado; CI em pull requests e na main                                                                |

## Decisões desta primeira fatia

- Uma fábrica e uma empresa. Não existe cadastro público dentro da aplicação.
- Gestor e colaborador estão modelados em `staff_members.role`, mas ainda não recebem acesso ao estoque. Isso segue a decisão de usar somente administrador durante o desenvolvimento inicial. Ativá-los exige políticas e interface próprias após revisão da matriz de permissões.
- O produto não fixa a unidade de compra. Cada lote conserva a quantidade e a unidade da entrada. A saída usa a unidade daquele lote, sem conversões estimadas ou mistura de saldos em unidades incompatíveis.
- Kg e g têm conversão exata para peso. Para `un`, o peso é calculado quando a apresentação possui peso conhecido. Caixas e pacotes não recebem equivalência automática. Frutas não pesadas continuam controladas em unidades.
- O peso conhecido e o custo são preservados no recebimento. Alterar o peso padrão de uma apresentação não modifica o peso de entradas antigas. O peso remanescente mostrado é proporcional ao peso inicial, não uma nova pesagem.
- O código interno automático usa `SKU-AAAAMMDD-sequência`. É uma convenção provisória e editável no recebimento; ainda precisa ser validada para o datador. Não é uma definição final de código de produção.
- Uma mesma identificação de lote pode existir em apresentações ou locais diferentes. Um lançamento é único por apresentação, código e local.
- Em 20/10/2026, o fluxo manual de situação `em quarentena`, `liberado` e `bloqueado` foi retirado desta fase. O lote recebido fica disponível imediatamente, e a possibilidade de reintroduzir esse controle permanece como evolução futura.
- O antigo local físico “Quarentena” foi arquivado, não apagado, para preservar vínculos históricos. Sua eventual reativação continua sujeita à validação técnica e sanitária.
- Os critérios finais de inspeção estão pendentes; por isso, há observações obrigatórias, sem aprovação automática por temperatura, tempo ou produto químico.
- A observação de inspeção começa vazia e precisa ser preenchida após a conferência. O sistema não presume a ausência de avarias.
- Saídas exigem saldo suficiente e validade atual. Perdas e descartes admitem lotes vencidos, com motivo. A destinação sanitária não é presumida pelo sistema.
- O alerta de 30 dias é um filtro operacional desta entrega e não define validade ou vida de prateleira.
- Retroatividade preserva a data real de criação. A data da saída pode ser anterior ao registro, mas não ao recebimento do lote, nem futura. O saldo é validado contra a posição atual; ainda não há reconstrução de saldo histórico por data operacional.
- Nenhum registro operacional pode ser apagado ou alterado diretamente pelo cliente. Cadastros são arquivados. Estornos, ajustes positivos e correções de recebimentos exigem um fluxo compensatório específico, ainda pendente.
- Quantidades usam até três casas decimais; pesos, até seis; valores totais, duas. Unidades, pacotes e caixas exigem quantidade inteira.
- Atualizações de saldo usam transação e bloqueio de linha no banco. Um UUID por submissão torna reenvios da mesma operação idempotentes. Depois de sucesso, a interface cria outro UUID para a próxima operação.

## Preparar o Supabase

O acesso ao GitHub não fornece credenciais administrativas do Supabase. Em 20/10/2026, a preparação foi aplicada ao projeto `Sistema Frutalize` (`ofemxaqzrnryrochqtrv`) com o Supabase CLI e ficou registrada no histórico remoto de migrações.

Estado confirmado do ambiente publicado:

- `202610200001_inventory.sql`: schema, RLS, funções, views, nove categorias e sete locais;
- `202610200002_bootstrap_admin.sql`: etapa portátil de bootstrap, sem e-mail ou UUID de ambiente; o vínculo administrativo já existente permanece no banco publicado;
- `202610200003_harden_inventory_rpcs.sql`: implementações privilegiadas isoladas no schema privado e RPCs públicas sem `SECURITY DEFINER`;
- `202610200004_simplify_receiving.sql`: recebimento agrupado, item padrão e regras de entrada simplificadas;
- `20261020221100_remove_lot_status_workflow.sql`: remove as situações manuais dos lotes, preserva movimentos antigos como registros históricos e arquiva o local físico “Quarentena”;
- cadastro público desabilitado globalmente, mantendo o provedor de e-mail ativo para login das contas criadas pelo administrador;
- senha mínima de oito caracteres, exigindo maiúscula, minúscula, número e símbolo;
- URLs autorizadas para `https://sistema-frutalize.vercel.app/**` e `http://localhost:3000/**`;
- lint do banco sem erros; advisor sem alertas das funções de estoque. Permanece apenas o aviso de proteção contra senhas vazadas, recurso disponível no plano Pro.

A configuração declarativa não secreta está em `supabase/config.toml`. Metadados e credenciais locais do CLI permanecem fora do Git.

Para preparar outro ambiente:

1. Use preferencialmente um projeto de homologação separado para validar esta entrega.
2. Vincule o CLI ao projeto correto e use `supabase db push`, preservando o histórico das migrações. O conjunto completo pode ser reproduzido em um banco vazio sem exigir previamente um usuário Auth. Não aplique os arquivos repetidamente pelo SQL Editor nem sobre tabelas homônimas sem revisar conflitos.
3. Confirme que o schema `public` está entre os schemas expostos na Data API. A exposição automática estava desabilitada no projeto; a migração concede explicitamente leitura das tabelas/views e execução das funções ao papel `authenticated`. Não conceda escrita direta para contornar erros de configuração.
4. Crie ou reutilize a conta do administrador em Supabase Auth e vincule o UUID dela a `staff_members`. Exemplo a executar **somente no contexto administrativo do banco**, substituindo nome e e-mail:

   ```sql
   insert into public.staff_members(user_id, display_name, role, active)
   select id, 'Nome do responsável', 'admin', true
   from auth.users
   where lower(email) = lower('administrador@exemplo.com')
   on conflict (user_id) do update
   set display_name = excluded.display_name, role = 'admin', active = true;
   ```

   Confira que uma linha foi afetada. Não existe promoção de perfil por metadados, formulário de cadastro ou chave publicável. Não há promoção automática do primeiro usuário que entrar.

5. Confirme que novas inscrições públicas estão desabilitadas no Supabase Auth. A ausência de cadastro na interface não desabilita o endpoint de inscrição do provedor. Usuários sem vínculo administrativo ativo são negados pelas políticas mesmo se houver uma conta Auth.
6. Configure as variáveis de `.env.example`. A aplicação usa somente a chave publicável para autenticação e operações autorizadas por RLS; não precisa de `service_role` nesta fatia.
7. Valide o fluxo de aceite abaixo antes de integrar a branch à `main`.

A migração inclui as nove categorias e sete locais confirmados. Não inclui produtos, tamanhos de apresentação, fornecedores, saldos nem parâmetros sanitários fictícios.

## Turnstile

Para ativar a proteção opcional, configure juntos:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: chave pública do widget;
- `TURNSTILE_SECRET_KEY`: segredo somente no servidor;
- `TURNSTILE_EXPECTED_HOSTNAME`: hostname exato do ambiente, sem protocolo nem caminho.

O login verifica `success`, a ação `login` e o hostname no Siteverify. Token ausente, vencido/recusado, configuração incompleta ou indisponibilidade de validação impedem o login quando a proteção está habilitada. O segredo não é enviado ao widget. Cada ambiente precisa de hostname permitido e configuração compatível.

Com as três variáveis vazias, a proteção fica desabilitada e o login por e-mail e senha permanece disponível em qualquer ambiente. Não configure apenas parte dos valores. Não configure o captcha nativo do Supabase simultaneamente sem adaptar o envio de token: esta implementação valida o Turnstile na Server Action.

Referências: [validação no servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) e [widget](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/).

## Validação local e CI

Use Node 22, conforme `.nvmrc` e `package.json`:

```bash
npm ci
npm run lint
npm run format:check
npm test
npm run typecheck
npm run build
```

Os testes de banco executam o replay completo das migrações reais em PostgreSQL embarcado (PGlite), inclusive o bootstrap portátil sem usuário pré-existente. O schema `auth` e os papéis da plataforma são simulados no teste; não existe acesso ao Supabase de produção. São verificados RLS, grants, perfis negados, alterações auditadas, bloqueio por vínculo, integridade transacional, idempotência, precisão, custo, peso, saldo e validade.

O teste de requisições concorrentes usa uma conexão do PGlite, que serializa as consultas. Ele verifica que duas solicitações não consomem o mesmo saldo; a disputa real entre múltiplas conexões, o PostgREST, a renovação de sessão e o widget precisam de aceite em homologação Supabase. Os testes de Turnstile simulam respostas HTTP, sem usar chaves reais.

Nenhum teste usa automação visual de desktop ou navegador. Responsividade, câmera, widget e comportamento de formulários devem receber aceite manual em celular e computador antes de produção.

A CI também inicia o build e executa `scripts/check-http.mjs` por HTTP: verifica os redirecionamentos sem sessão, a renderização do formulário de login, os cabeçalhos de segurança, a disponibilidade do endpoint de saúde e o acesso ao favicon. A política CSP permite somente as origens necessárias da aplicação, do Supabase e do Turnstile; também são emitidas proteções contra enquadramento, detecção indevida de conteúdo e permissões desnecessárias do navegador. O endpoint de saúde verifica a conexão de autenticação; não confirma a instalação da migração nem um fluxo autenticado completo.

`npm audit --omit=dev` não apontou vulnerabilidades nas dependências de produção na verificação desta entrega. A auditoria completa apontou avisos altos de desenvolvimento na cadeia `eslint-config-next → fast-glob → micromatch → braces` (GHSA-vfj7-8cjw-p6xm). Não havia versão corrigida de `braces` publicada na consulta; não foi feito downgrade incompatível do Next.js/ESLint para mascarar o aviso. Acompanhar a correção antes das próximas atualizações.

## Aceite em homologação

1. Entrar com o administrador vinculado e confirmar a ausência de saldos fictícios.
2. Cadastrar um fornecedor, um produto e uma apresentação. Para uma apresentação conhecida de 500 g, informar peso unitário de 0,5 kg.
3. Receber duas unidades, com referência, custo, validade, local e inspeção. Verificar disponibilidade imediata, peso de 1 kg, custo por unidade e responsável no histórico.
4. Registrar uma saída e verificar saldo, motivo, data operacional, data real e responsável. Tentar consumir mais do que o saldo e verificar a recusa.
5. Arquivar fornecedor, produto, apresentação ou local e conferir que o histórico permanece e o cadastro não aceita novos recebimentos.
6. Editar um cadastro com motivo e verificar os valores antes/depois no histórico.
7. Confirmar busca, filtros, paginação, navegação por teclado e acesso a todas as operações em celular e computador.
8. Com Turnstile configurado, validar sucesso, falha e expiração; verificar que o login funciona após uma tentativa recusada.
9. Com outro usuário Auth, sem vínculo ou com perfil futuro, confirmar a negação do estoque inclusive pela Data API.

## Próximas entregas necessárias

| Requisito                                               | Situação                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Gestão de usuários por administrador/gestor             | Pendente: interface e operações administrativas de Auth exclusivamente no servidor                                          |
| Senha temporária e troca obrigatória no primeiro acesso | Pendente                                                                                                                    |
| Bloqueio com revogação de todas as sessões Auth         | Pendente. Vínculo inativo já impede leitura e operações no banco imediatamente; isso não encerra as sessões Auth existentes |
| Permissões de gestor e colaborador                      | Perfis modelados e negados nesta fase; matriz e ativação pendentes                                                          |
| Anexo/foto de nota fiscal                               | Pendente: bucket privado, políticas, limites, captura e consulta segura                                                     |
| Tipos de movimento configuráveis                        | Pendente; esta fatia usa recebimento, saída e perda/descarte; mudanças antigas de situação permanecem apenas como histórico |
| Ajustes, estorno, devolução e correção de recebimentos  | Pendentes; não oferecer edição silenciosa de movimentos concluídos                                                          |
| Transferência de saldo entre locais/freezers            | Pendente: operação atômica entre posições, preservando lote e auditoria                                                     |
| Produção, consumo de matérias-primas e vínculo de lotes | Pendente: ordem de produção e genealogia entre entrada e produto acabado                                                    |
| Quantidade por caixa/pacote                             | Sem conversão automática; regras pendentes de aprovação                                                                     |
| Inspeção estruturada e critérios de qualidade           | Texto obrigatório disponível; critérios finais e eventual fluxo de situação permanecem pendentes                            |
| Estoque mínimo                                          | Não exigido neste MVP; configuração futura pendente                                                                         |
| Contagens/inventário físico e correções                 | Pendente                                                                                                                    |
| Presença, apontamento e remuneração de colaboradores    | Pendente de definição e implementação                                                                                       |
| Financeiro e vendas                                     | Etapas futuras; custo inicial já preservado por recebimento                                                                 |
| Domínio, homologação, backup e recuperação              | Exigem configuração e validação dos ambientes                                                                               |

Não se deve tratar esta primeira entrega como liberação integral do MVP para uso produtivo sem resolver os bloqueadores correspondentes e concluir o aceite.
