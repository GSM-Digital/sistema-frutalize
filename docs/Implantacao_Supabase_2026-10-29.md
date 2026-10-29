# Implantação das migrações no Supabase — 29/10/2026

## Identificação

- Projeto: `Sistema Frutalize` (`ofemxaqzrnryrochqtrv`), o único projeto acessível nesta conta durante a implantação.
- Aplicação: `https://sistema-frutalize.vercel.app`.
- Código de referência: `main` em `bd7b78de7274005c406121be975696e26c448285`.
- Ambiente: desenvolvimento, conforme informado pelo responsável. O banco já continha duas ordens de produção antes da alteração.

## Estado anterior e cópia de segurança

O histórico remoto terminava em `20261021032108`; as três migrações de 28/10 estavam apenas no repositório. `supabase backups list` não retornou pontos de restauração e PITR estava desabilitado. O utilitário de dump do Supabase exigia Docker, ausente nesta máquina. Por isso foi usado `pg_dump` 17.11 portátil, obtido da EnterpriseDB e conferido pelo [SHA-256 publicado pelo fornecedor](https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip.sha256).

Cópia anterior às migrações, fora do repositório:

```text
C:\Users\Jeremias\AppData\Local\Frutalize\backups\frutalize-pre-migracao-20261029.dump
Formato: pg_dump custom, PostgreSQL 17.11
Schemas: public, private, auth, storage, supabase_migrations
Tamanho: 352343 bytes
SHA-256: FB2794F677FB17FD0E7B0DBC13F1DF390F1E74424538CB01BBC1FB6519B5823B
Verificação de leitura: pg_restore --list reconheceu 500 entradas, 49 de dados de tabelas.
```

O arquivo contém dados e metadados de acesso. Não o incluir no Git nem enviá-lo por mensagens. A leitura do índice confirma a integridade do arquivo, mas não equivale a um ensaio completo de restauração.

## Alterações aplicadas

`supabase db push --linked --skip-vault --yes` aplicou, nesta ordem:

1. `20261028100000_production_commands.sql`: configurações versionadas de produção, estado e eventos das ordens, qualidade, não conformidades e comandos do dashboard e terminal. Acrescenta colunas a `production_runs`, marca ordens legadas concluídas e desativa os comandos legados de checkpoint/PIN.
2. `20261028110000_operations_management.sql`: inventário, inspeções, alertas, financeiro, comercial e apontamentos. Acrescenta colunas e amplia os tipos de movimento em `stock_movements`.
3. `20261028110100_private_receipt_storage.sql`: funções de autorização e bucket privado `frutalize-receipts`, com políticas de acesso e limites de arquivo.

Não foram inseridos POPs, parâmetros de máquina, limites de qualidade nem dados sanitários fictícios.

## Verificação posterior

- As três versões aparecem no histórico remoto de migrações.
- `production_command` e `operations_command` existem no banco.
- `private_attachments` e o bucket privado `frutalize-receipts` existem.
- As duas ordens anteriores permanecem em `production_runs`.
- `/api/health` respondeu `{"app":"ok","supabase":"ok"}`.
- O checkout local usa apenas a chave **publicável** em `.env.local`, ignorado pelo Git. Nenhuma chave de serviço foi gravada no repositório.

Essas verificações confirmam a instalação técnica. Fluxos autenticados, Storage, permissões por papel e uso em equipamento real ainda exigem validação com contas e dados de desenvolvimento.

## Como reverter

O Git não desfaz migrações de banco. Para voltar ao estado anterior com preservação de dados, usar a cópia acima e **restaurá-la primeiro em um projeto Supabase novo e isolado**, com PostgreSQL 17 e os serviços Auth/Storage criados pela plataforma. Conferir o SHA-256 antes da restauração, inspecionar o conteúdo com `pg_restore --list` e seguir a documentação de restauração do PostgreSQL/Supabase para aplicar os schemas e dados selecionados. Validar autenticação, ordens, movimentos e arquivos antes de apontar a aplicação para esse projeto. Não executar `pg_restore --clean` diretamente no projeto atual sem um ensaio: o dump inclui schemas mantidos pela plataforma e a limpeza pode afetar outros objetos.

Para desfazer apenas o código, voltar a implantação Vercel para o commit anterior desejado. Isso **não** remove colunas, tabelas, funções, políticas ou dados criados pelas migrações. Para uma reversão no mesmo banco, preparar e ensaiar uma migração compensatória a partir dos três arquivos acima e do dump, depois de exportar quaisquer dados criados após 29/10. Remover as linhas do histórico de migrações sem reverter os objetos produz um estado inconsistente e não é um procedimento de reversão.

## Pendências operacionais

- Validar RLS, grants, comandos e Storage com administrador, gestor, colaborador e cliente reais.
- Cadastrar e aprovar POPs, equipamentos, calibrações, embalagens e critérios de qualidade da fábrica.
- Ensaiar a restauração da cópia antes de considerar o ambiente pronto para operação física.
