# Sistema Frutalize — requisitos consolidados

> Registro criado em 19 de outubro de 2026 a partir das respostas do responsável pelo projeto. Este documento separa decisões confirmadas, recomendações e pontos ainda pendentes.

## 1. Visão e objetivo

### Confirmado

- Nome do produto: **Sistema Frutalize**.
- Uso exclusivamente interno por funcionários e gestores da Frutalize.
- Sistema exclusivo para uma empresa e uma fábrica.
- Objetivo inicial: colocar uma versão funcional em uso até novembro de 2026.
- Primeira prioridade: gestão de estoque.
- Segunda etapa: módulo financeiro.
- O sistema público da marca continuará separado do sistema interno.
- O sistema interno será publicado em `sistema.frutalize.com.br`.
- Experiência simples, operacional, minimalista e intuitiva.
- Responsividade completa para celular e computador, sem reduzir funções conforme o dispositivo.
- Primeira versão executada no navegador, exclusivamente online.
- Idioma: português do Brasil.
- Moeda: real brasileiro.
- Fuso operacional: America/Sao_Paulo, correspondente ao horário de Brasília.

### Contexto do negócio

- A fábrica está iniciando as operações e ainda não produziu uma unidade comercial de polpa.
- Existem algumas polpas específicas e a equipe está aprendendo a operar os equipamentos.
- Não existe sistema, planilha ou caderno anterior para migração.
- O sistema deverá nascer já como fonte de registro das operações.

## 2. Estrutura física

### Confirmado

- Uma única fábrica.
- Escritório administrativo no mesmo endereço da produção.
- Áreas físicas citadas:
  - vestiário;
  - higienização de utensílios;
  - higienização das frutas;
  - estoque de frutas;
  - estoque congelado de polpas prontas;
  - setor de máquinas/operação;
  - produção;
  - escritório;
  - frente de venda ao consumidor, ainda secundária.
- Estoque congelado composto atualmente por três freezers horizontais.
- Não há necessidade atual de transferência entre unidades ou depósitos externos.
- Não existem representantes, vendedores externos ou distribuidores no momento.

## 3. Usuários e autorização

### Confirmado

- Aproximadamente 10 usuários iniciais e até 10 usuários simultâneos.
- Perfis iniciais:
  - **Administrador:** acesso total; pode criar, alterar, aprovar, excluir, bloquear usuários e consultar todas as áreas.
  - **Gestor:** acesso à gestão operacional e administrativa conforme permissões a detalhar.
  - **Colaborador:** acesso restrito à área de colaborador, incluindo futuramente presença/jornada e apontamento da própria produção.
- Administrador e gestor poderão criar usuários.
- O gestor poderá criar colaboradores e outros gestores.
- Somente um administrador poderá criar outro administrador.
- O gestor poderá bloquear colaboradores.
- O gestor poderá alterar lançamentos de estoque feitos por outros gestores, preservando o histórico da alteração.
- Não haverá cadastro público ou autoatendimento de criação de conta.
- Login inicial por e-mail e senha.
- Sem MFA na primeira versão.
- Usuários devem poder ser bloqueados imediatamente.
- Ao bloquear um usuário, todas as sessões abertas deverão ser encerradas imediatamente e novos logins serão impedidos enquanto o bloqueio permanecer.
- Primeiro acesso depende da criação/liberação pelo administrador ou gestor.
- Novos usuários receberão senha temporária e serão obrigados a criar uma nova senha no primeiro acesso.
- Cloudflare Turnstile será usado para proteção contra automação maliciosa.
- Durante o desenvolvimento inicial, somente a conta de administrador será usada. Os perfis de gestor e colaborador serão modelados desde o começo, mas a divisão final de acessos será ativada depois.

### Diretriz técnica de segurança

- Senhas nunca devem ser exibidas nem armazenadas em texto legível.
- Operações administrativas do Supabase Auth devem ocorrer exclusivamente no servidor; a chave secreta nunca pode chegar ao navegador.
- Papéis e permissões não devem usar metadados editáveis pelo próprio usuário como fonte de autorização.
- Todas as tabelas expostas devem usar Row Level Security e políticas específicas por perfil e ação.
- O bloqueio deve ser validado no servidor e acompanhado da revogação das sessões existentes; esconder telas no frontend não é suficiente.

### Pendente

- Matriz final de permissões de gestor e colaborador por módulo antes de liberar esses perfis em produção.
- Funcionalidades finais da área do colaborador.
- Fluxo de redefinição de senha administrada sem expor a senha ao administrador.

## 4. Estoque — escopo inicial

### Categorias confirmadas

- Frutas recebidas.
- Polpas prontas.
- Embalagens.
- Rótulos.
- Caixas.
- Produtos de limpeza e sanitização.
- Uniformes e EPIs.
- Materiais administrativos.
- Categoria “outros”.

### Produtos/sabores iniciais

- Tamarindo.
- Maracujá.
- Morango.
- Abacaxi.

Todos os cadastros devem permitir inclusão e edição futura.

### Locais de estoque confirmados

- Estoque de frutas.
- Estoque de insumos, embalagens, produtos de limpeza e demais materiais, com separação física por categoria.
- Produção.
- Quarentena.
- Freezer 1.
- Freezer 2.
- Freezer 3.

O módulo terá uma visão virtual global de todo o estoque da Frutalize, indicando em cada saldo onde o item está fisicamente. Cada freezer será um local separado, e a mesma apresentação de polpa poderá ficar em mais de um freezer. Inicialmente somente um freezer será usado, mas os três já existirão no cadastro. O controle de capacidade máxima dos freezers será uma evolução futura.

Descarte será um tipo de movimento de saída, não um local com saldo disponível. A localização física prevista para a quarentena, próxima à área de higienização de utensílios, ainda deverá ser validada pelo responsável técnico e pelas exigências sanitárias.

### Cadastro de itens

- Os itens ainda não possuem SKU.
- O sistema poderá sugerir um SKU, mantendo edição administrativa.
- Unidades possíveis incluem quilograma, grama, litro, unidade, pacote e caixa.
- A unidade de compra pode variar para o mesmo tipo de fruta, por exemplo quilo ou unidade.
- O sistema não exigirá do usuário uma unidade-base visível.
- Cada lançamento terá quantidade e unidade e poderá ter peso líquido total em quilogramas quando esse dado existir.
- Quando frutas forem compradas por unidade e pesadas no recebimento, serão registrados tanto o número de unidades quanto o peso total.
- Quando não houver pesagem, o lote permanecerá controlado em unidades, sem conversão estimada para peso.
- Polpas prontas serão controladas por apresentação/embalagem.
- O produto principal será separado de suas apresentações. Exemplo: `Polpa de Maracujá`, com apresentações de 100 g, 500 g ou 1 kg.
- Cada apresentação terá saldo e identificação próprios, podendo compartilhar o mesmo lote de produção ou utilizar lotes diferentes.
- Quando o peso unitário for conhecido, o sistema calculará também o peso total; por exemplo, duas unidades de 500 g equivalem a 1 kg.
- Apresentações e tamanhos de embalagem serão configuráveis.
- Lote e validade são obrigatórios quando aplicáveis.
- Estoque negativo não será permitido.
- Estoque mínimo não é obrigatório no MVP, mas deve ser previsto como configuração futura.

### Pendente

- Regras de conversão para embalagens com quantidade conhecida, como caixa com 20 unidades.
- Tamanhos de embalagem usados no início da operação.
- Critérios de geração automática de SKU.

## 5. Recebimento e entrada

### Dados confirmados

Cada recebimento deverá registrar:

- fornecedor;
- nota fiscal ou referência equivalente;
- lote do fornecedor, quando existente;
- lote interno;
- quantidade;
- peso;
- unidade de medida;
- preço total;
- custo unitário calculado;
- validade;
- data e horário;
- usuário responsável pelo lançamento;
- inspeção de qualidade.

### Regras confirmadas

- O gestor responsável pelo recebimento fará o lançamento.
- O cadastro de fornecedor terá nome, CNPJ, telefone, endereço e pessoa de contato.
- Não há balança integrada atualmente.
- Não haverá aceite parcial de entrega na primeira regra informada.
- O custo da entrada deverá ficar pronto para alimentar o módulo financeiro.
- O sistema permitirá fotografar a nota fiscal com a câmera do celular. Na primeira versão, a imagem será armazenada para consulta, sem extração automática obrigatória de dados.
- A validade poderá ser informada pelo fornecedor ou definida internamente no recebimento, registrando a origem dessa informação.
- Somente gestor ou administrador poderá liberar um lote em quarentena.
- O lote interno seguirá um padrão simples baseado no produto, na data e em uma sequência. O mesmo código poderá ser usado no datador da envasadora e nas embalagens.

### Pendente

- Critérios e resultados possíveis da inspeção de qualidade.
- Padrão definitivo do lote interno e validação do comprimento/caracteres aceitos pelo datador da envasadora.
- Tratamento de itens rejeitados, deteriorados ou colocados em quarentena.
- Destino e reaproveitamento de subprodutos, como cascas, sem tratar material impróprio como reaproveitável.
- Confirmação sanitária e contábil do processo de descarte e reaproveitamento.

## 6. Movimentações e auditoria

### Confirmado

- A lista de tipos de movimentação deverá ser configurável.
- Toda alteração ou movimentação deverá ter motivo e usuário responsável.
- Movimentações poderão ter data operacional retroativa.
- Administradores terão uma tela de histórico global.
- O histórico deverá mostrar quem realizou a ação, o que mudou e quando ocorreu.
- Não permitir saldo negativo.
- Administradores e gestores poderão aprovar movimentações na primeira versão.
- Gestores poderão realizar ajustes de estoque inicialmente; essa permissão deverá ser configurável para futura restrição.

### Diretriz recomendada

- Registros concluídos não devem ser apagados silenciosamente; correções devem ocorrer por estorno ou lançamento compensatório, preservando a trilha de auditoria.
- Cadastros com histórico vinculado, como produtos, fornecedores e locais, devem ser arquivados em vez de excluídos.
- Somente registros ainda em rascunho e sem efeito sobre o estoque poderão ser excluídos definitivamente.
- Data/hora real de criação não deve ser substituída pela data operacional retroativa.

### Pendente

- Tipos iniciais de movimento.
- Quais perfis podem registrar cada tipo de movimento quando gestor e colaborador forem ativados.
- Inventário físico e frequência de contagem.
- Regras de perdas, descartes, devoluções e reaproveitamento.

## 7. Produção e colaboradores

### Confirmado

- A área do colaborador deverá futuramente registrar presença/jornada e produção.
- Existe interesse em calcular remuneração por quantidade produzida, em quilos ou unidades.
- O modelo ainda não foi aprovado.

### Recomendação a validar com contabilidade e assessoria trabalhista

- Preferir remuneração fixa compatível com a legislação e instrumentos coletivos, acrescida de bônus variável de produção.
- Evitar remuneração exclusivamente por quilo/unidade durante a fase de aprendizado.
- A produção deve ser medida por ordem/lote e somente após aprovação de qualidade.
- O cálculo deve considerar produção em equipe, perdas justificadas, higienização, preparação, treinamento, manutenção e paradas fora do controle do colaborador.
- O sistema deve registrar horas/presença e apontamentos de produção separadamente.

### Pendente

- Vínculo trabalhista e convenção coletiva aplicável.
- Salário-base e regras de remuneração variável.
- Pagamento individual ou por equipe.
- Unidade de cálculo: quilo aprovado, embalagem aprovada ou combinação.
- Valor por faixa de produção.
- Critérios de qualidade, perda e segurança.
- Tratamento de retrabalho, rejeição de lote e paradas de máquina.
- Definição se o registro de jornada será apenas operacional ou um ponto eletrônico oficial.

## 8. Financeiro e vendas futuras

### Confirmado

- O financeiro será a segunda etapa após estoque.
- Escopo financeiro esperado:
  - contas a pagar;
  - contas a receber;
  - fluxo de caixa;
  - bancos;
  - conciliação.
- Custos de recebimento devem ser aproveitados pelo financeiro.
- Futuramente haverá um ponto de venda em outro subdomínio.
- O futuro módulo comercial deverá atender B2C e B2B.
- Clientes poderão futuramente consultar pedidos e rastrear lotes.
- Não existem atualmente e-commerce, maquininha, marketplace ou sistema de vendas para integrar.
- Não há integração atual com balanças, impressoras, WhatsApp, e-mail ou Google Drive.

## 9. Plataforma e publicação

### Confirmado

- Organização Supabase: `Sistema Frutalize`.
- Projeto Supabase criado em 19 de outubro de 2026 com o nome `Sistema Frutalize`.
- Referência pública do projeto: `ofemxaqzrnryrochqtrv`.
- URL pública do projeto: `https://ofemxaqzrnryrochqtrv.supabase.co`.
- Região provisionada pelo grupo Américas: East US (North Virginia), `us-east-1`.
- Plano inicial: Free, compute Nano.
- Data API habilitada.
- Exposição automática de novas tabelas desabilitada.
- RLS automática para novas tabelas no schema público habilitada.
- Senha do banco gerada pelo Supabase e não registrada nos arquivos do projeto.
- O sistema interno ficará separado do site público atual.
- Frontend deve ser responsivo e executado no navegador.
- Aplicativo instalável poderá ser considerado futuramente.
- Não há requisito de funcionamento offline na primeira versão.
- Subdomínio definido: `sistema.frutalize.com.br`.
- A aplicação será preparada para publicação provisória na Vercel.
- Framework confirmado e iniciado: Next.js 16, TypeScript e Tailwind CSS.
- Repositório criado e conectado: `https://github.com/GSM-Digital/sistema-frutalize`.
- Projeto Vercel conectado ao repositório e ao projeto Supabase.
- Primeira versão publicada em `https://sistema-frutalize.vercel.app`.
- Cada atualização enviada à branch `main` inicia uma nova publicação automática na Vercel.

### Pendente

- Configurações detalhadas do Supabase Auth.
- Alterar a visibilidade do repositório `GSM-Digital/sistema-frutalize` de público para privado, caso aprovado pelo responsável.
- Ambiente de homologação e ambiente de produção.
- Política de backup, retenção e recuperação.

## 10. Prioridade preliminar do MVP

1. Estrutura do projeto e ambientes.
2. Login por e-mail e senha.
3. Criação, liberação e bloqueio de usuários.
4. Papéis e permissões: administrador, gestor e colaborador.
5. Cadastros de fornecedores, produtos, categorias e unidades.
6. Locais de estoque, incluindo identificação dos três freezers.
7. Lotes e validades.
8. Recebimento e inspeção de qualidade.
9. Entradas e cálculo de custo unitário.
10. Movimentações com motivo e rastreabilidade.
11. Consulta de saldos por produto, lote e local.
12. Histórico global de auditoria.
13. Anexo/foto de nota fiscal.
14. Dashboard responsivo.
15. Publicação em ambiente provisório protegido por login.

## 11. Princípios de implementação

- Modelar estoque como livro de movimentações; o saldo deriva de entradas e saídas auditáveis.
- Manter custo e vínculo financeiro desde o recebimento, mesmo antes do módulo financeiro completo.
- Separar quantidade, unidade informada e peso líquido opcional para permitir conversões futuras sem inventar equivalências.
- Não excluir histórico operacional relevante.
- Não permitir que o frontend determine sozinho permissões ou valores de estoque.
- Nunca expor chaves administrativas do Supabase.
- Preparar rastreabilidade de matéria-prima, produção e produto acabado desde o modelo inicial.
- Manter parâmetros sanitários e de máquinas como pendentes até validação competente.
