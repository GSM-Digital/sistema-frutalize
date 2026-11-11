# Preparo de frutas

O preparo acontece entre o recebimento e a despolpa. A tela `/terminal/preparo` foi feita para um terminal horizontal na área de limpeza e descascamento. A administração mantém os guias e os lembretes em `/dashboard/preparo`.

## Antes de operar

1. Um administrador cadastra e aprova instruções curtas para cada fruta, conforme o procedimento físico aprovado pela fábrica. O sistema não fornece técnica sanitária nem receita padrão.
2. Cada colaborador configura um PIN individual de quatro dígitos na própria conta. O terminal exige o PIN para iniciar, entrar, pausar, retomar, sair e concluir.
3. O local físico precisa estar cadastrado. O destino pode ser um freezer ativo ou a Área de despolpa.

## Fluxo

1. Selecione um lote de fruta no estoque e toque em **Começar preparo**. Informe seu PIN para identificação; depois informe a quantidade. Ao iniciar, o sistema reserva essa quantidade no estoque e começa a contagem regressiva de três segundos.
2. As instruções aprovadas ficam visíveis numa única tela. Pessoas adicionais entram com seu próprio PIN. A duração do preparo e a de cada pessoa são contadas no servidor; pausas pessoais não contam como trabalho. O lembrete padrão é de 90 minutos de trabalho e 30 de descanso, configurável pelo administrador. O lembrete não pausa o trabalho automaticamente.
3. Na conclusão, informe a quantidade efetivamente preparada, o número de baldes e o local físico. Pesos individuais em kg são opcionais e só devem ser informados se medidos. A parte reservada que não foi preparada volta ao lote de fruta recebido.
4. Cada balde vira um lote intermediário separado, ligado ao lote de origem e ao preparo. Ele não é polpa pronta. Quando existe guia aprovado para a fruta, a despolpa recebe somente esses lotes preparados. A polpa acabada continua a ser criada apenas na finalização da ordem de produção.

O cancelamento só é permitido a gestor ou administrador, com PIN próprio, justificativa e confirmação de que nenhuma fruta foi preparada. A operação devolve toda a quantidade reservada.

## Guia de demonstração

Um administrador pode manter um rascunho editável e conferir sua aparência no terminal por **Visualizar guia de teste**. A prévia não inicia preparo nem libera o uso físico do lote. O guia só libera o botão de início depois que instruções reais forem revisadas e aprovadas.

## Dados anteriores ao lançamento

Frutas já descascadas antes desta atualização precisam de conferência física e registro com dados reais. A migração não inventa datas, pesos, baldes ou participantes e não altera automaticamente saldos existentes. Para os dois sacos de tamarindo já descascados, confira o lote de origem, a quantidade e os baldes antes de fazer o primeiro registro; se não houver dados suficientes, trate a conciliação com o responsável pelo estoque.
