# Relatório de funcionalidades implementadas — Sistema Frutalize

**Atualizado em:** 13/11/2026

**Base de código:** branch `main`, commit `e2837ef`

**Repositório:** `GSM-Digital/sistema-frutalize`
**Escopo:** funcionalidades presentes no código e nas migrações versionadas. O status de implantação e os limites de aceite estão separados da descrição funcional.

## 1. Visão geral

O Sistema Frutalize é uma aplicação web em português do Brasil, construída com Next.js, React e Supabase. Cobre autenticação, estoque, recebimento, preparo de frutas, produção, gestão administrativa, suporte e consulta de pedidos por clientes. As telas administrativas e operacionais são separadas, mesmo quando trabalham sobre as mesmas ordens e dados. Valores monetários usam real brasileiro; datas operacionais são apresentadas no horário de Brasília.

| Área                       | Rotas                                 | Finalidade e acesso                                                            |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| Dashboard                  | `/dashboard` e subrotas               | Estoque, cadastros, produção e gestão; administrador ativo.                    |
| Terminal de produção       | `/terminal`                           | Execução touch de ordens de produção; equipe ativa, conforme o papel.          |
| Terminal de preparo        | `/terminal/preparo`                   | Preparo de frutas entre o recebimento e a despolpa; equipe ativa autorizada.   |
| Gestão independente        | `/gestao` e `/gestao/[module]`        | Módulos acessíveis conforme o papel, sem trocar de superfície para o terminal. |
| Portal                     | `/portal`                             | Consulta de pedidos e expedições próprios por cliente vinculado.               |
| Visualização demonstrativa | `/visualizar` e `/visualizar/preparo` | Prévia local, somente em desenvolvimento, sem gravações no Supabase.           |

## 2. Autenticação, conta e permissões

- Login e sessão com Supabase Auth; rotas protegidas redirecionam para autenticação e limitam o retorno a caminhos internos permitidos.
- Primeiro acesso e recuperação permitem definir senha com validação de comprimento e composição; a sessão é encerrada após a troca.
- Cloudflare Turnstile é opcional. Quando configurado integralmente, a validação ocorre no servidor; configuração parcial bloqueia o envio.
- `staff_members` associa identidade, nome, papel e estado ativo. Páginas, ações e funções de banco revalidam acesso. O bloqueio da equipe impede novas operações autorizadas.
- Administradores podem vincular usuários Auth existentes, convidar pessoas quando a chave administrativa estiver configurada, ajustar papel, bloquear ou reativar com motivo e auditoria. A remoção do último administrador ativo é impedida.
- A página `/dashboard/conta` exibe dados e perfil, permite editar informações de conta, trocar senha e configurar o PIN operacional individual exigido pelo terminal de preparo.
- O menu da conta oferece tema claro/escuro, conta, relato, atalhos para os dois terminais e saída. O tema escolhido é guardado no navegador.
- RLS, grants e funções SQL restringem consultas e alterações. Custos e dados administrativos não são expostos aos operadores no terminal.

## 3. Dashboard, cadastros e inventário

### 3.1 Painel inicial e navegação

- `/dashboard` apresenta indicadores de itens ativos, lotes com saldo, lotes a vencer em 30 dias e lotes vencidos, além de movimentações recentes e atalhos para tarefas frequentes.
- O menu administrativo oferece navegação para estoque, recebimentos, cadastros, produção, gestão, suporte e conta. A navegação e os componentes são adaptados a celular e tablet; é possível recolher o menu lateral.
- `/dashboard/gestao/[module]` mantém o layout do dashboard. `/gestao/[module]` mostra o conteúdo autorizado do módulo em sua própria superfície. A navegação não redireciona automaticamente uma tela para a outra.
- `/terminal` e `/terminal/preparo` são rotas próprias, com layouts operacionais touch. Links entre áreas são explícitos.

### 3.2 Cadastros

Em `/dashboard/cadastros` e `/dashboard/cadastros/[tipo]`:

- Produtos e categorias, variantes/apresentações e SKUs, fornecedores, locais de armazenamento e dados de embalagem.
- Busca, filtros, paginação, criação e edição conforme o tipo de registro.
- Arquivamento preserva o histórico e os vínculos existentes.
- Alterações administrativas exigem motivo e guardam comparação dos dados anteriores e posteriores.

### 3.3 Recebimentos, lotes e movimentos

- `/dashboard/recebimentos/novo` registra recebimento com fornecedor, referência, data e múltiplos itens. Cada item pode incluir variante, local, número de lote, validade e origem da validade, unidade, quantidade, peso líquido, custo e observações de inspeção.
- É possível cadastrar alguns itens e fornecedores durante o recebimento. A entrada de estoque e o registro de recebimento são atômicos e idempotentes.
- `/dashboard/lotes` permite buscar e filtrar saldos por produto, variante, SKU, lote, fornecedor e local, validade e disponibilidade.
- `/dashboard/lotes/[id]` apresenta dados, origem e histórico do lote, com ações autorizadas para produção, saída externa e perda/descarte.
- `/dashboard/movimentacoes` oferece livro de entradas, saídas, ajustes e outros movimentos, com filtros e datas registradas.
- Restrições de banco impedem saldo negativo, quantidades fracionárias para unidades inteiras e saídas de lotes vencidos. Falhas revertem a operação e o respectivo movimento em conjunto.
- Quantidade, peso e unidade são dados distintos; o sistema não infere conversões não cadastradas.

## 4. Produção

### 4.1 Gestão de produção no dashboard

- `/dashboard/producao` lista ordens recentes com situação, horário de início, quantidade de insumos e lote de saída; oferece visões de ordens em andamento, encerradas e todas.
- `/dashboard/producao/nova` cria ordem com procedimento, perfil, regra de qualidade e um ou mais lotes de origem.
- `/dashboard/producao/[id]` mostra o detalhe administrativo, insumos, custos, lote de saída e histórico. Permite os comandos administrativos disponíveis conforme o estado da ordem: assumir/configurar, confirmar instruções, registrar medições, pausar, retomar, informar problema, cancelar e finalizar.
- `/dashboard/producao/configuracao` mantém equipamentos/instrumentos, embalagens, procedimentos, perfis e regras de qualidade, com revisões, estados de análise/aprovação/retirada e calibrações.
- A ordem conserva as versões das instruções e dos critérios usados, mesmo quando configurações são atualizadas posteriormente.

### 4.2 Terminal Touch de produção

Em `/terminal`:

- Fila operacional e criação de ordens conforme papel e configurações aprovadas.
- Interface adaptada ao toque, com comandos claros, instrução atual e confirmação passo a passo.
- Identidade individual do operador, cronômetro com referência de servidor, pausa e retomada, troca de operador, estado de conexão e atualização manual.
- Medições de qualidade associadas à especificação e ao instrumento calibrado; desvios são registrados e podem bloquear a liberação conforme a regra aprovada.
- Comunicação e resolução de problemas, cancelamento restrito por papel e confirmação antes de finalizar.
- Comandos usam identificador de intenção e revisão esperada para que reenvios e conflitos não repitam consumo nem sobrescrevam etapas confirmadas.
- A finalização registra atomicamente o produto de saída e a genealogia dos lotes consumidos. O terminal não exibe custos.

### 4.3 Preparo de frutas antes da despolpa

- `/terminal/preparo` é o terminal touch próprio da área de preparo; `/dashboard/preparo` administra guias e consulta preparos registrados.
- Um lote de fruta recebido tem uma quantidade reservada ao iniciar o preparo. Participantes se identificam com PIN individual; o sistema registra sessões de trabalho, pausas e retomadas.
- Na conclusão, registram-se quantidade efetivamente preparada, número de baldes e destino/local físico. A quantidade reservada que não foi processada volta ao saldo do lote de origem.
- Cada balde resulta em lote intermediário separado, vinculado à fruta recebida e ao preparo. Com guia aprovado para a fruta, a despolpa aceita os lotes preparados correspondentes; não aceita a fruta crua nesse caso.
- Guias são versionados e podem ser preparados em rascunho/prévia; a operação real exige aprovação. O cancelamento é restrito e pede identificação, justificativa e confirmação de que nenhum material foi processado.
- O sistema não transforma automaticamente sacos, baldes, unidades e quilogramas, não calcula rendimento presumido e não cria polpa como resultado do preparo.
- A aplicação não fornece POP, receita ou instrução sanitária padrão. O conteúdo dos guias e os critérios operacionais devem vir da fábrica e dos responsáveis técnicos.

### 4.4 Visualizações de demonstração

- `/visualizar` e `/visualizar/preparo` permitem inspecionar telas com dados fictícios durante desenvolvimento.
- As prévias não consultam nem alteram o Supabase e não comprovam permissões, integrações ou aceite físico.

## 5. Módulos de gestão

O conteúdo aparece dentro do dashboard em `/dashboard/gestao/<módulo>` e nas rotas independentes `/gestao/<módulo>`, conforme papel e autorização. As duas superfícies usam o mesmo conteúdo funcional sem uma redirecionar para a outra.

### 5.1 Inventário físico — `inventory`

- Abre contagem por local e registra quantidades observadas por lote.
- Aprova diferenças por movimentos compensatórios. Quando há diferença, contador e aprovador devem ser pessoas distintas.
- Detecta mudanças no saldo durante a contagem e pede nova conferência.
- Compensa movimentos permitidos com motivo, preservando o evento original.

### 5.2 Recebimento, inspeção e documentos — `receiving`

- Mantém modelos versionados de checklist com respostas sim/não, numéricas ou textuais, obrigatórias ou opcionais.
- Registra inspeção do recebimento, respostas, decisão de aceite/rejeição e observações.
- Anexos JPEG, PNG e PDF ficam em bucket privado, com limite de 10 MiB e controle de acesso.
- Uma inspeção rejeitada não cria automaticamente quarentena nem altera saldos antigos; a destinação do material precisa ser registrada em fluxo apropriado.

### 5.3 Equipe — `staff`

- Vincula identidade, nome e papel de administrador, gestor ou colaborador.
- Convida novos usuários se o serviço administrativo de servidor estiver configurado.
- Registra bloqueio e reativação com motivo; protege o último administrador ativo.

### 5.4 Alertas e temperaturas — `alerts`

- Regras configuráveis de estoque mínimo, validade, limites de temperatura e ausência de leitura, com escopo por item/categoria/local conforme o tipo.
- Registra temperatura, momento, local e instrumento informado.
- Avalia regras sob comando e registra resolução de alerta.
- O software não presume limites de temperatura; a fábrica deve definir e aprovar os valores.

### 5.5 Financeiro — `finance`

- Contas internas de caixa/banco e títulos a pagar ou receber, com valor, competência, vencimento e vínculo opcional a recebimento, produção ou pedido.
- Baixas parciais ou totais, estorno de baixa e conciliação por referência externa, com histórico e controles de duplicidade.
- O módulo registra informação administrativa; não inicia transações bancárias nem confirma saldo bancário real.

### 5.6 Comercial, pedidos e expedição — `commercial`

- Cadastro de clientes e associação opcional a uma conta do portal.
- Catálogo comercial ligado a variante fabril, preço e unidade de venda.
- Pedidos com múltiplos itens e reserva de lotes válidos sem alterar imediatamente o saldo físico.
- Cancelamento libera reservas; expedição atômica baixa lotes reservados e mantém rastreabilidade.
- Devoluções são registradas separadamente e não retornam automaticamente ao estoque disponível.

### 5.7 Apontamento de atividade — `time`

- Registro pessoal de início, pausa, retorno e fim, com observação.
- Correção de horário exige motivo e preserva o histórico.
- O apontamento não substitui ponto eletrônico oficial e não calcula remuneração.

## 6. Suporte e relatos

- O formulário abre pelo menu da conta ou por atalhos em outras áreas. Registra problema, sugestão ou outro tipo, descrição e rota de origem.
- Aceita até cinco imagens PNG/JPG/WebP, com limite conjunto de 3,5 MiB. Os arquivos ficam em bucket privado.
- Clientes vinculados e membros ativos autorizados podem enviar relato; a triagem é administrativa.
- `/dashboard/suporte` apresenta autoria, data, página de origem, descrição e links temporários para anexos; permite filtrar por situação e data.
- Estados disponíveis: **A fazer**, **Em andamento**, **Concluído** e **Descartado**.
- RLS restringe leitura e atualização dos relatos e acesso aos anexos.

## 7. Portal do cliente

- `/portal` mostra os pedidos, itens, expedições e devoluções do cliente vinculado, de acordo com a autorização do banco.
- A tela é de consulta: não cria pedidos, não realiza checkout ou pagamento e não expõe custos ou dados de fornecedores.
- Oferece relato de problema e saída da conta.

## 8. Persistência, integridade e auditoria

- Migrações em `supabase/migrations/` versionam estoque, autenticação e funções auxiliares, produção, módulos administrativos, anexos privados, suporte e preparo de frutas.
- Operações críticas usam transações e funções SQL com validação de papel, estado, saldo, concorrência e identificador idempotente.
- RLS e grants limitam tabelas e Storage; custos e dados de gestão não são passados para a interface operacional.
- Auditoria registra autoria, motivo e alterações relevantes. Correções de movimentos usam compensações ou estornos para manter o histórico.
- `/api/health` indica disponibilidade da aplicação e da conexão de saúde do Supabase.
- CI do GitHub executa instalação, lint, verificação de formatação, testes, tipagem, build e resposta HTTP sem sessão.

## 9. Situação verificada e itens ainda pendentes

- Em 12/11/2026, o painel do projeto Supabase `ofemxaqzrnryrochqtrv`, branch `main`/`PRODUCTION`, mostrava as **17 migrações** versionadas neste repositório, incluindo as cinco de suporte e preparo. Não havia migração pendente naquele momento.
- Na mesma data, `/api/health` respondeu HTTP 200 com `app: ok` e `supabase: ok`.
- A execução de CI do commit `e2837ef` concluiu lint, formatação, testes, tipagem, build e verificação HTTP sem sessão com sucesso em 12/11/2026.
- A verificação remota confirma as versões registradas e conectividade naquele momento; não comprova o aceite de todos os fluxos com contas reais ou no equipamento físico.
- Antes de operar o preparo, ainda é necessário cadastrar e aprovar guias reais, cada operador configurar seu PIN e a fábrica validar os locais/destinos e o fluxo em terminal físico.
- Frutas que já estavam descascadas precisam de conferência física e reconciliação com quantidades reais; a migração não inventa pesos, baldes, datas, participantes ou conversões.
- Produção física depende de procedimentos, limites de qualidade, equipamentos e calibrações definidos e aprovados pelos responsáveis técnicos.
- O sistema depende de conexão online. Testes locais em PGlite com dados sintéticos não substituem validação controlada de concorrência e autorização no PostgreSQL remoto.
- Foram abertas issues para acompanhar aceites: [#3 interface mobile-first](https://github.com/GSM-Digital/sistema-frutalize/issues/3), [#4 menu e separação dos terminais](https://github.com/GSM-Digital/sistema-frutalize/issues/4), [#5 relatos e triagem](https://github.com/GSM-Digital/sistema-frutalize/issues/5) e [#6 configuração e aceite operacional do preparo](https://github.com/GSM-Digital/sistema-frutalize/issues/6).

## 10. Referências

- [Rotas da aplicação](../src/app/), [navegação](../src/components/inventory/navigation.tsx) e [regras de autorização](../src/lib/auth.ts).
- [Tipos e comandos de gestão](../src/lib/operations/types.ts), [terminal de produção](../src/components/production/terminal.tsx) e [terminal de preparo](../src/components/production/preparation-terminal.tsx).
- [Relatos de suporte](../src/components/support/report-dialog.tsx), [migrações do Supabase](../supabase/migrations/) e [testes automatizados](../tests/).
- [Guia de integração para o administrador](Integracao_BD_Administrador.md), [guia de preparo de frutas](Preparo_de_Frutas.md), [estado do plano técnico](Estado_Plano_Tecnico.md) e [evolução de produção e gestão](Evolucao_Producao_Gestao.md).
