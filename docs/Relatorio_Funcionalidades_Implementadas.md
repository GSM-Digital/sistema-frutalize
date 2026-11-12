# Relatório de funcionalidades implementadas — Sistema Frutalize

**Data do levantamento:** 12/11/2026
**Base:** branch `main`, commit `ff15b16`, do repositório `sistema-frutalize`
**Escopo:** funcionalidades presentes no código e nas migrações versionadas. A existência no repositório não comprova que as migrações foram aplicadas ao Supabase de produção nem que o deploy está ativo.

## 1. Visão geral

O sistema é uma aplicação web em português do Brasil, construída com Next.js, React e Supabase. Opera com autenticação por e-mail e senha, dados de estoque, produção, gestão interna e consulta de pedidos por cliente. Valores monetários usam real brasileiro e datas operacionais são apresentadas no horário de Brasília.

As superfícies estão separadas:

| Área          | Rota                    | Uso                                                             | Acesso no código                                                          |
| ------------- | ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Dashboard     | `/dashboard` e subrotas | Administração, estoque, produção e gestão                       | Administrador ativo                                                       |
| Terminal      | `/terminal`             | Execução de ordens de produção                                  | Equipe ativa; ações específicas dependem do papel e da ordem              |
| Gestão direta | `/gestao/[module]`      | Mesmo conteúdo dos módulos de gestão, sem o layout do dashboard | Administrador; gestor em equipe/apontamentos; colaborador em apontamentos |
| Portal        | `/portal`               | Consulta de pedidos próprios                                    | Cliente autenticado e vinculado                                           |

Os módulos de gestão dentro e fora do dashboard reutilizam o mesmo componente e os mesmos formulários; as rotas de documentos preservam a área de origem. O menu do dashboard contém um atalho identificado para o terminal touch, e o terminal oferece retorno ao dashboard para administradores. Cada visualização mantém seu layout e suas ações.

## 2. Identidade, acesso e proteção

- Login por e-mail e senha via Supabase Auth. Cloudflare Turnstile é opcional: quando as três variáveis de configuração estão presentes, a validação ocorre no servidor; uma configuração parcial bloqueia o envio.
- Primeiro acesso por link de convite ou recuperação, com definição de senha forte e encerramento da sessão após a troca.
- Vínculo de usuários e papéis em `staff_members`, com bloqueio por `active`. O banco revalida autorização nas operações; a interface também restringe páginas e ações.
- Cadastro de pessoa já existente no Auth, convite por e-mail quando a chave administrativa do servidor está configurada, bloqueio e reativação. O sistema impede remover o último administrador ativo.
- Ao bloquear ou reativar, o vínculo no banco é atualizado. Quando há `SUPABASE_SERVICE_ROLE_KEY`, a ação também tenta aplicar o bloqueio no Supabase Auth; uma falha nessa etapa é informada ao operador.
- RLS, grants e funções de banco limitam acesso a tabelas, snapshots e comandos. O terminal não recebe custos de estoque/produção para operadores.
- Rotas protegidas direcionam usuários sem sessão ao login. O retorno após login é limitado a caminhos internos permitidos.

## 3. Dashboard administrativo

### 3.1 Página inicial

- Indicadores de itens ativos, lotes com saldo, lotes a vencer em 30 dias e lotes vencidos.
- Atalhos para recebimento, acompanhamento da produção, pedido/expedição e lançamentos financeiros.
- Acesso aos módulos de estoque, produção, finanças, vendas, equipe, cadastros e auditoria.
- Lista de movimentações recentes e alerta visual quando há lote vencido com saldo.

### 3.2 Cadastros

Em `/dashboard/cadastros` e `/dashboard/cadastros/[tipo]`:

- Itens de estoque, apresentações/tamanhos e embalagens, fornecedores, locais de armazenamento e categorias.
- Criação, edição, busca, paginação e arquivamento sem apagar o histórico vinculado.
- Apresentações com SKU e peso unitário opcional; saldos separados quando o item tem variantes.
- Motivo obrigatório nas alterações e registro de dados anteriores/posteriores na auditoria.

### 3.3 Recebimento e estoque

- `/dashboard/recebimentos/novo`: registro de uma entrega com fornecedor, referência, data/hora e vários itens. Cada item informa apresentação, local, lote, validade e origem da validade, unidade, quantidade, peso líquido, custo e observações de inspeção. É possível cadastrar fornecedor ou item durante o preenchimento.
- Recebimento gravado de forma atômica e idempotente, com entrada imediata no saldo. O custo e o peso são registrados sem inventar conversões entre unidades.
- `/dashboard/lotes`: consulta de saldos por item, apresentação e local; busca por produto/SKU/lote/fornecedor/local; filtros de validade e lotes sem saldo; paginação.
- `/dashboard/lotes/[id]`: rastreabilidade, detalhes e histórico do lote; ações de envio para produção, saída externa e perda/descarte. A saída externa registra destino. Perdas recebem classificação automática conforme a validade.
- `/dashboard/movimentacoes`: livro de movimentos com busca, filtro por tipo e data real de registro; data operacional pode ser informada separadamente.
- Restrições de banco contra saldo negativo, quantidades fracionárias em unidades inteiras e saída de lote vencido. Operações que falham revertem saldo e histórico juntos.

### 3.4 Produção no dashboard

- `/dashboard/producao`: últimas 50 ordens com situação operacional, início, número de insumos e lote de saída; abas **Em andamento**, **Encerradas** e **Todas**. A lista possui apresentação adaptada a celular e computador.
- `/dashboard/producao/nova`: criação de ordem na interface administrativa, com seleção de procedimento, perfil, regra de qualidade e lotes de origem.
- `/dashboard/producao/[id]`: detalhe administrativo com datas, insumos consumidos, custo total dos insumos, lote e quantidade produzida. Permite assumir/configurar a ordem, confirmar instruções, registrar medições, pausar, retomar, informar problema, cancelar e finalizar conforme o estado da ordem.
- Dashboard e terminal consultam as mesmas ordens e enviam comandos às mesmas funções de banco. O dashboard apresenta painéis administrativos e custos; o terminal apresenta o fluxo touch da fábrica.
- `/dashboard/producao/configuracao`: cadastro de equipamentos/instrumentos, embalagens, procedimentos, perfis de máquina, parâmetros e regras de qualidade; registro de calibração.
- Procedimentos, perfis e regras têm revisão, envio para análise, aprovação e retirada. Versões usadas por uma ordem são congeladas para preservar a rastreabilidade.

### 3.5 Histórico

- `/dashboard/historico`: histórico global de alterações de cadastro, com responsável, momento, motivo e comparação entre valores anteriores e posteriores; paginação.

## 4. Terminal de produção

Em `/terminal`:

- Fila de ordens ativas, criação de ordem por papel autorizado, configuração com procedimento/perfil/regra aprovados e seleção de múltiplos lotes de entrada. Fila e ações têm interface adaptada para toque em celular e tablet.
- Operador assume a ordem com a própria identidade. A tela apresenta uma instrução por vez, com fase e passo, e exige confirmação para avançar.
- Registro de medições de qualidade e conferência conforme regra aprovada e instrumento calibrado; falha gera desvio e bloqueia a liberação quando a regra assim exige.
- Pausa segura, retomada, comunicação de problema, resolução de não conformidade, cancelamento por papel autorizado e conferência final antes de criar o lote acabado.
- Cronometria baseada no servidor, estado de conexão, atualização manual e opção de trocar operador/sair.
- Cada comando usa identificador idempotente e revisão esperada. Reenvios e conflitos de revisão são tratados sem repetir consumo ou sobrescrever um passo confirmado.
- Finalização atômica preserva a genealogia dos lotes de entrada e do lote de saída. Custos não aparecem na interface operacional.

### 4.1 Prévia local das visualizações

- `/visualizar`, disponível **somente em desenvolvimento**, mostra o dashboard de uma ordem, o terminal com ordem aberta e a fila do terminal.
- Usa dados fictícios, não consulta o Supabase e mantém comandos desativados. Serve para inspecionar as interfaces; não valida gravações nem permissões reais.

### 4.2 Terminal de preparo de frutas

- `/terminal/preparo` oferece uma tela touch independente para a etapa entre recebimento e despolpa; `/dashboard/preparo` administra guias versionados e acompanha lotes de preparo.
- O lote recebido é reservado quando o preparo começa. A equipe se identifica individualmente por PIN, pode pausar e retomar, e a conclusão registra quantidade processada, número de baldes e destino físico. Quantidade não preparada retorna ao lote de origem.
- Cada balde gera um lote intermediário rastreável até o recebimento. Quando há guia aprovado, a ordem de produção aceita esses lotes preparados para despolpa. O preparo não cria polpa nem converte automaticamente sacos, baldes e peso.
- Guias são escritos e aprovados pela fábrica. A aplicação não fornece instruções sanitárias ou parâmetros operacionais. A implantação não registra automaticamente saldos ou preparações legadas; a conciliação física é manual.

## 4.3 Navegação, tema e relatos de suporte

- O menu da conta contém tema claro/escuro, conta, acesso ao terminal de produção, acesso ao terminal de preparo, relato de problema/sugestão e saída. A navegação é adaptada a toque e telas menores.
- O formulário de relato guarda tipo, descrição e página de origem e aceita até cinco imagens PNG/JPG/WebP, limitadas em conjunto a 3,5 MiB. As imagens ficam em bucket privado.
- Administradores triagem relatos em `/dashboard/suporte`, com filtros e estados **A fazer**, **Em andamento**, **Concluído** e **Descartado**. A página apresenta autoria, origem e links assinados para anexos.
- O tema escolhido fica no armazenamento local do navegador; ele não exige migração de banco.

## 5. Módulos de gestão

No dashboard, as rotas seguem `/dashboard/gestao/<módulo>`. O conteúdo também está disponível em `/gestao/<módulo>` para os papéis autorizados.

### 5.1 Inventário físico — `inventory`

- Abertura de contagem por local e lançamento da quantidade contada de cada lote.
- Aprovação das diferenças com movimento compensatório; quando há diferença, aprovador distinto do contador.
- Detecção de alteração de saldo durante a contagem, exigindo nova conferência.
- Compensação de movimentos permitidos com motivo, preservando o registro original. Recebimento, produção e expedição usam seus fluxos específicos.

### 5.2 Inspeções e documentos — `receiving`

- Criação de versões de checklist com perguntas obrigatórias ou opcionais dos tipos sim/não, número e texto.
- Inspeção vinculada ao recebimento, com respostas, decisão de aceite/rejeição e observações.
- Envio e consulta de PDF, PNG e JPEG em bucket privado, com autorização verificada antes do download; limite de 10 MiB definido na migração de Storage.
- A inspeção não cria automaticamente quarentena nem retira retroativamente o lote do saldo. Material rejeitado exige destinação registrada em fluxo próprio.

### 5.3 Equipe e acessos — `staff`

- Vínculo de identidade existente do Supabase Auth, nome e papel; convite de primeiro acesso quando o serviço administrativo está configurado.
- Bloqueio e reativação com motivo e trilha de auditoria; proteção do último administrador ativo.

### 5.4 Alertas e temperaturas — `alerts`

- Regras de estoque mínimo, validade, limite de temperatura e ausência de leitura, com escopo por item/categoria/local conforme o tipo.
- Registro manual de temperatura com horário, local e instrumento.
- Avaliação das regras sob comando do usuário e registro de resolução de alerta.
- Limites de temperatura dependem da definição e aprovação técnica da fábrica; não são presumidos pelo software.

### 5.5 Financeiro — `finance`

- Cadastro de contas de caixa/banco e títulos a pagar ou receber, com competência, vencimento, valor e origem opcional em recebimento, produção ou pedido.
- Registro de pagamento/recebimento parcial ou total, estorno de baixa e conciliação com referência externa.
- Histórico e controles contra duplicidade. A baixa é um registro administrativo; não movimenta dinheiro em banco.

### 5.6 Pedidos e expedição — `commercial`

- Cadastro de clientes e vínculo opcional com usuário do portal; catálogo comercial ligado à apresentação fabril, preço e unidade de venda.
- Criação de pedidos com múltiplos itens; reserva por lote válido sem alterar o saldo físico.
- Cancelamento com liberação de reservas; expedição atômica que baixa os lotes reservados e preserva a rastreabilidade.
- Registro de devolução comercial segregada, sem recolocar automaticamente o produto no saldo disponível.

### 5.7 Apontamentos de atividade — `time`

- Registro pessoal de início, pausa, retorno e fim com horário e observações.
- Correção de horário com motivo e preservação do histórico.
- É um apontamento operacional: não substitui ponto eletrônico oficial nem calcula remuneração.

## 6. Portal do cliente

- `/portal`: cliente vinculado consulta seus pedidos, itens, expedições e devoluções permitidos pelo banco.
- Consulta apenas; não há checkout, pagamento, criação de pedido pelo cliente nem exposição de custos e dados de fornecedores.

## 7. Persistência, auditoria e operação

- O esquema versionado em `supabase/migrations/` cobre estoque, produção, gestão, permissões e Storage privado. Comandos sensíveis são executados por funções SQL com validação de papel, identificadores de intenção e transações. Segundo o registro de implantação de 29/10/2026, as três migrações finais foram aplicadas ao projeto Supabase de desenvolvimento; o estado atual desse projeto não foi revalidado para este relatório.
- Registros de produção, qualidade, movimentação e gestão preservam autoria e histórico; correções relevantes usam estorno ou compensação em vez de apagar o evento original.
- `/api/health` verifica se a aplicação está configurada e se o endpoint de saúde do Supabase Auth responde.
- A CI do GitHub executa instalação, lint, formatação, testes, tipagem, build e verificação HTTP sem sessão em pushes à `main` e pull requests. A execução do commit `ff15b16` concluiu todos esses passos com sucesso em 11/11/2026.

## 8. Dependências e limites de implantação

- Antes de usar os novos módulos, o administrador deve comparar o histórico remoto com todos os arquivos versionados e aplicar as migrações pendentes em ordem, com backup e plano de reversão. Este checkout contém migrações posteriores às três de outubro para relatos, contexto de suporte, preparo e aprovação dos guias. O estado remoto atual não foi consultado neste levantamento; siga [o guia atualizado de integração do banco](Integracao_BD_Administrador.md).
- Configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Convites e bloqueio no Auth exigem `SUPABASE_SERVICE_ROLE_KEY` no servidor e `APP_ORIGIN`; o retorno `/auth/confirm` deve ser permitido no Supabase Auth. Para ativar o Turnstile opcional, configurar em conjunto site key, segredo e hostname esperado.
- Vincular usuários reais e aprovar procedimentos, equipamentos, parâmetros, embalagens, calibrações e critérios de qualidade antes de operar a produção física.
- O sistema depende de conexão online. Os testes de banco usam PGlite e dados sintéticos; é necessária validação no Supabase de homologação, incluindo permissões, concorrência e uso em tablet.
- Este relatório descreve o código versionado e a execução de CI. Não confirma que as novas migrações estejam aplicadas no Supabase, que o deploy do commit esteja ativo, que os guias operacionais reais estejam aprovados ou que houve aceite no terminal físico.

## 9. Referências no repositório

- [Rotas da aplicação](../src/app/), [menus do dashboard](../src/components/inventory/navigation.tsx) e [regras de acesso](../src/lib/auth.ts).
- [Formulários de gestão](../src/lib/operations/forms.ts), [área compartilhada de gestão](../src/components/operations/management-page.tsx), [operações no dashboard](../src/components/production/dashboard-operations.tsx), [terminal](../src/components/production/terminal.tsx) e [prévia local](../src/app/visualizar/page.tsx).
- [Migrações do Supabase](../supabase/migrations/) e [testes automatizados](../tests/).
- [Guia de integração do banco](Integracao_BD_Administrador.md) e [evolução de produção e gestão](Evolucao_Producao_Gestao.md).
- [Estado do plano técnico](Estado_Plano_Tecnico.md) e [registro da implantação no Supabase](Implantacao_Supabase_2026-10-29.md).
