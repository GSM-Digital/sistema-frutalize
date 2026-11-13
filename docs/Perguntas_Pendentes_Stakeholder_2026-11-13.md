# Perguntas pendentes para o stakeholder — Frutalize

Este documento reúne decisões que dependem da operação real da Frutalize. O próximo agente que analisar ou implementar o repositório deve revisar estas perguntas com o stakeholder antes de definir regras sanitárias, parâmetros de equipamento, permissões ou tratamento de dados físicos. Não presumir respostas com base em exemplos, nomes de telas ou dados de demonstração.

## Decisões já respondidas nesta conversa

- **Foto da nota no recebimento (L06):** integrar a fotografia/anexo diretamente ao fluxo de recebimento.
- **Retorno após relato de suporte (L07):** registrar a resposta/retorno dentro do sistema.

Esses dois pontos não precisam ser perguntados novamente; o agente deve implementar a decisão e, se necessário, confirmar apenas detalhes de operação que ainda não estejam especificados.

## Perguntas operacionais em aberto

### Guias de preparo e segurança do processo

1. Quais são as instruções aprovadas para cada fruta (etapas, limites, tempos, condições e critérios de conclusão)? Quem é responsável por redigir, revisar e aprovar cada versão?
2. Para cada fruta, em que ponto terminam higienização/sanitização e começam descasque, corte, hidratação ou outras etapas? Quais áreas físicas são usadas em cada etapa?
3. Para baldes de fruta preparada que ficam congelados: qual identificação deve acompanhar cada balde, qual temperatura e tempo máximo de espera se aplicam, e qual regra aprovada determina sua validade? Quem aprova essa regra?
4. Já existem preparos ou baldes em estoque (incluindo o tamarindo mencionado no guia)? Quem fará a contagem física, como confirmar lote de origem, quantidade e localização, e quem autoriza registrar essa reconciliação no sistema?

### Recebimento, inspeção e destinação

5. Quando um recebimento é rejeitado total ou parcialmente, onde o material fica fisicamente e qual é o processo autorizado para devolução, descarte ou liberação? Quem registra e aprova cada destino?
6. Para a foto/documento no recebimento, ela é opcional ou obrigatória? Além da nota fiscal, quais documentos/imagens podem ser anexados? Quem deve conseguir consultá-los?

### Equipamentos e qualidade

7. Quais são os modelos e manuais dos equipamentos usados? Para cada máquina, quais controles e parâmetros o operador pode ajustar, com unidades e escalas correspondentes ao equipamento real?
8. Quais apresentações de polpa são efetivamente produzidas? Para cada uma, qual peso-alvo, tara, tolerância, frequência e tamanho de amostra de controle, e como tratar unidades fora do padrão?
9. Como são definidos o código de lote e as datas impressas no datador? Qual regra aprovada define a validade do produto acabado? Como proceder quando a ordem atravessa a meia-noite?
10. Para cada máquina e etapa, quais são os pontos seguros de pausa, o tratamento do produto exposto e a cadência real de trabalho e descanso? Os lembretes existentes são apenas informativos ou há outro procedimento aprovado?

### Acesso e responsabilidades

11. Qual é a matriz final de permissões por papel para criar/editar guias, aprovar guias, operar, assumir/trocar responsável por uma ordem, corrigir registros, cancelar operações e tratar desvios?
12. Qual procedimento a equipe deve seguir quando alguém esquecer o PIN individual? (O PIN não deve ser revelado a administradores; pode-se substituir por um novo após autenticação na própria conta.)

## Aceite operacional pendente

Também combinar responsáveis e evidências para estes aceites antes de declarar os fluxos prontos para uso regular:

- Uso em tablet e celular reais: dashboard, estoque, recebimento, terminais, legibilidade, teclado PIN, alvos de toque e ausência de rolagem lateral.
- Navegação entre dashboard e terminais para os papéis autorizados, incluindo entrada, saída e persistência da visualização.
- Relato de suporte ponta a ponta: autoria, anexos privados, triagem, atribuição e resposta visível ao autor dentro do sistema.
- Preparo supervisionado: guia aprovado, PIN de participantes, reserva/consumo, pausas, conclusão parcial, baldes, transferência freezer–despolpa, genealogia e envio à ordem.
- Duas sessões concorrentes, reenvio de ação, perda/retorno de rede e bloqueio de usuário durante operação.
- Backup, responsável pelo procedimento e ensaio seguro de restauração sem sobrescrever o projeto ativo.
- Acesso a anexos com contas reais e decisão de destinação de material rejeitado.
- Limites de temperatura, frequência de leitura, alertas e resposta a desvios, definidos com o responsável técnico.

## Instrução para o próximo agente

Ao iniciar uma nova análise, leia também `docs/Estado_Plano_Tecnico.md`, `docs/Preparo_de_Frutas.md` e a análise de lacunas que motivou este registro. Faça as perguntas ainda abertas ao stakeholder e atualize este arquivo com respostas, data e contexto. Não reabra os itens L06 e L07 como perguntas já respondidas, e não transforme qualquer decisão que exija validação técnica em regra operacional sem a aprovação correspondente.

### Prompt para encaminhar ao agente responsável pelo stakeholder

> Analise `docs/Perguntas_Pendentes_Stakeholder_2026-11-13.md` e consulte o stakeholder sobre as perguntas operacionais que ainda estão em aberto. Não pergunte novamente as decisões já confirmadas: integrar a foto da nota ao recebimento e registrar as respostas de suporte dentro do sistema. Preserve as perguntas que dependem do responsável técnico/equipamentos reais; não invente parâmetros nem aprove procedimentos em nome do stakeholder. Registre cada resposta neste documento com data e contexto, marque explicitamente os tópicos ainda sem resposta e devolva um resumo das decisões que liberam implementação e dos aceites físicos que continuam pendentes.
