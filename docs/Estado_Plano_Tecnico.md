# Estado local do plano técnico da Frutalize

Revisão do checkout em 28/10/2026. Referência: `FRUTALIZE-PLANO-TECNICO-FUTURAS-IMPLEMENTACOES.md` recebido pelo responsável. O plano descreve o commit `60d6f0a` de 27/10; esta revisão parte da `main` em `c9f83f4`. Os estados abaixo dizem respeito **ao código local**. Não comprovam implantação, migração remota ou aceite da fábrica.

| Item do plano                           | Estado no código local                                        | Evidência principal                                                                            | Próximo passo                                                                            |
| --------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| F01 Ambientes, backup e recuperação     | Pendente fora do checkout                                     | `docs/Evolucao_Producao_Gestao.md` documenta implantação e limites                             | Conferir deploy e schema remoto, criar homologação isolada, ensaiar backup e restauração |
| F02 Perfis, POPs e equipamentos         | Implementação de software presente                            | `20261028100000_production_commands.sql`, `/dashboard/producao/configuracao`                   | Cadastrar, revisar e aprovar dados reais com responsável técnico; homologar versões      |
| F03 Terminal, concorrência e identidade | Implementação de software presente; aceite físico pendente    | `production_command`, `production_run_events`, `/terminal` e `/dashboard/producao`             | Testar duas sessões reais, perda de rede e tablet horizontal em homologação              |
| F04 Qualidade e desvios                 | Implementação de software presente; critérios reais pendentes | `quality_specs`, `quality_checks`, `nonconformities`, `calibration_records`                    | Definir regras, instrumento e destino de desvios com responsável técnico                 |
| F05 Múltiplos insumos e genealogia      | Implementação de software presente                            | `20261028100000_production_commands.sql`; formulário de ordem com múltiplos lotes              | Validar cenários e saldos no PostgreSQL de homologação                                   |
| F06 Inventário e compensação            | Implementação de software presente                            | `inventory_counts`, `inventory_count_lines`, `/dashboard/gestao/inventory`                     | Aceitar fluxo físico de contagem e aprovação                                             |
| F07 Inspeção e anexos privados          | Implementação de software presente                            | `receipt_inspections`, `private_attachments`, `20261028110100_private_receipt_storage.sql`     | Validar regras e acesso ao Storage em homologação                                        |
| F08 Usuários e papéis                   | Fluxos de convite e bloqueio presentes; matriz final pendente | `/dashboard/gestao/staff`, `src/app/gestao/actions.ts`, `src/lib/auth.ts`                      | Fechar matriz por papel e ensaiar bloqueio de sessão com contas reais                    |
| F09 Alertas e temperatura               | Implementação de software presente; limites reais pendentes   | `alert_rules`, `temperature_readings`, `/dashboard/gestao/alerts`                              | Aprovar limites, rotinas de medição e resposta a desvios                                 |
| F10 Financeiro                          | Base presente; integração bancária não definida               | `financial_accounts`, `financial_titles`, `financial_settlements`, `financial_reconciliations` | Homologar fluxo com contabilidade e dados fictícios; definir integração se necessária    |
| F11 Comercial e portal                  | Base presente; operação comercial depende de regras           | `sales_orders`, `sales_shipments`, `stock_reservations`, `/portal`                             | Definir preço, tributação, emissão fiscal e futura integração de pagamento               |
| F12 Jornada e remuneração variável      | Apontamentos operacionais presentes; remuneração não definida | `time_entries`, `/dashboard/gestao/time`                                                       | Decidir se haverá ponto oficial e validar qualquer regra de remuneração com assessoria   |

## Duas visualizações da produção

- **Dashboard:** `/dashboard/producao` tem abas de acompanhamento, criação de ordem, detalhe administrativo com custos e operação em painéis próprios. A rota usa o layout administrativo e exige administrador nesta fase.
- **Terminal:** `/terminal` mantém fila, instrução vigente, comandos grandes e fluxo touch. Não exibe custos. A autenticação e a autorização são reavaliadas no servidor para os comandos.
- Ambas consultam e alteram as mesmas ordens via `production_terminal_snapshot` e `production_command`. A interface é diferente; a regra de negócio e a auditoria ficam no banco.

## Limites da revisão

O checkout não contém `.env.local` nem prova da versão em Vercel/Supabase. Build e análise estática locais verificam o código, mas não validam regras sanitárias, perfis reais, conexão com serviços, RLS em múltiplas sessões ou uso no equipamento da fábrica. As decisões pendentes do plano continuam pendentes; nenhum peso, temperatura, validade, parâmetro de máquina ou remuneração foi presumido.
