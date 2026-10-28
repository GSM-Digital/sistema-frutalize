import type { OperationsModule } from "./types";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "checkbox" | "email";
  source?: string;
  options?: readonly (readonly [string, string])[];
  optional?: boolean;
  fields?: Field[];
};
export type OperationForm = {
  action: string;
  title: string;
  fields: Field[];
  description?: string;
  critical?: boolean;
};
const reason: Field = {
  name: "reason",
  label: "Motivo / referência da decisão",
};
const field = (
  name: string,
  label: string,
  type?: Field["type"],
  optional = false,
): Field => ({ name, label, type, optional });
const select = (
  name: string,
  label: string,
  source: string,
  optional = false,
): Field => ({ name, label, source, optional });
const choice = (
  name: string,
  label: string,
  options: Field["options"],
  optional = false,
): Field => ({ name, label, options, optional });
const unitOptions = [
  ["kg", "kg"],
  ["g", "g"],
  ["l", "Litro"],
  ["un", "Unidade"],
  ["pct", "Pacote"],
  ["cx", "Caixa"],
] as const;
export const moduleNames: Record<OperationsModule, string> = {
  inventory: "Inventário físico",
  receiving: "Inspeções e documentos",
  staff: "Equipe e acessos",
  alerts: "Alertas e temperaturas",
  finance: "Financeiro",
  commercial: "Pedidos e expedição",
  time: "Apontamentos de atividade",
};
export const operationForms: Record<OperationsModule, OperationForm[]> = {
  inventory: [
    {
      action: "count_open",
      title: "Abrir contagem",
      fields: [select("location_id", "Local", "locations"), reason],
    },
    {
      action: "count_line",
      title: "Registrar contagem de lote",
      fields: [
        select("session_id", "Sessão", "counts"),
        select("lot_id", "Lote", "lots"),
        field(
          "counted_quantity",
          "Quantidade contada na unidade do lote",
          "number",
        ),
      ],
    },
    {
      action: "count_approve",
      title: "Aprovar contagem e compensar diferenças",
      description:
        "Diferenças exigem aprovador diferente de quem contou. Saldos alterados durante a contagem exigem nova conferência.",
      fields: [select("session_id", "Sessão", "counts"), reason],
      critical: true,
    },
    {
      action: "compensate",
      title: "Compensar movimento",
      description:
        "O original permanece no histórico. Recebimentos, produção e expedição exigem seu fluxo específico.",
      fields: [select("movement_id", "Movimento", "movements"), reason],
      critical: true,
    },
  ],
  receiving: [
    {
      action: "template_create",
      title: "Criar versão de checklist",
      fields: [
        field("name", "Nome"),
        {
          name: "criteria",
          label: "Critérios de inspeção",
          fields: [
            field("key", "Identificador do critério"),
            field("label", "Pergunta"),
            choice("type", "Tipo da resposta", [
              ["boolean", "Sim / não"],
              ["number", "Número"],
              ["text", "Texto"],
            ]),
            field("required", "Resposta obrigatória", "checkbox"),
          ],
        },
        reason,
      ],
    },
    {
      action: "inspect",
      title: "Registrar inspeção",
      description:
        "Este registro não ativa quarentena nem retira retroativamente lotes do saldo. A destinação de material rejeitado exige ação operacional registrada.",
      fields: [
        select("receipt_id", "Recebimento", "receipts"),
        select("template_id", "Checklist", "templates"),
        choice("decision", "Decisão", [
          ["accepted", "Aceito"],
          ["rejected", "Rejeitado"],
        ]),
        field("notes", "Observações", "text", true),
        reason,
      ],
    },
  ],
  staff: [
    {
      action: "save",
      title: "Vincular usuário existente",
      description:
        "Para primeiro acesso, envie um convite abaixo. O identificador do usuário existente está disponível no Supabase Auth.",
      fields: [
        field("user_id", "Identificador do usuário Auth"),
        field("display_name", "Nome"),
        choice("role", "Papel", [
          ["collaborator", "Colaborador"],
          ["manager", "Gestor"],
          ["admin", "Administrador"],
        ]),
        reason,
      ],
    },
    {
      action: "block",
      title: "Bloquear acesso",
      fields: [select("user_id", "Pessoa", "members"), reason],
      critical: true,
    },
    {
      action: "reactivate",
      title: "Reativar acesso",
      fields: [select("user_id", "Pessoa", "members"), reason],
      critical: true,
    },
  ],
  alerts: [
    {
      action: "rule_save",
      title: "Configurar regra",
      description:
        "Estoque mínimo usa a unidade da variante/local. Validade usa dias; ausência de leitura usa minutos. Limites de temperatura dependem da aprovação técnica.",
      fields: [
        select("id", "Regra para revisar (vazio cria nova)", "rules", true),
        field("name", "Nome"),
        choice("kind", "Tipo", [
          ["minimum_stock", "Estoque mínimo"],
          ["expiry", "Validade"],
          ["temperature", "Temperatura"],
          ["missing_reading", "Ausência de leitura"],
        ]),
        select("variant_id", "Apresentação", "variants", true),
        select("category_id", "Categoria", "categories", true),
        select("location_id", "Local", "locations", true),
        field("threshold", "Limite de saldo / dias / minutos", "number", true),
        field("lower_limit", "Temperatura mínima (°C)", "number", true),
        field("upper_limit", "Temperatura máxima (°C)", "number", true),
        field("active", "Ativa", "checkbox"),
        reason,
      ],
    },
    {
      action: "reading_record",
      title: "Registrar temperatura",
      fields: [
        select("location_id", "Local", "locations"),
        field("value_c", "Temperatura (°C)", "number"),
        field(
          "measured_at",
          "Data e hora da medição (Brasília)",
          "datetime-local",
        ),
        field("equipment", "Equipamento / instrumento"),
        reason,
      ],
    },
    { action: "evaluate", title: "Verificar regras agora", fields: [reason] },
    {
      action: "resolve",
      title: "Registrar resolução de alerta",
      fields: [select("id", "Alerta", "events"), reason],
    },
  ],
  finance: [
    {
      action: "account_create",
      title: "Cadastrar conta",
      fields: [
        field("name", "Nome"),
        choice("kind", "Tipo", [
          ["cash", "Caixa"],
          ["bank", "Banco"],
        ]),
        reason,
      ],
    },
    {
      action: "title_create",
      title: "Registrar título",
      description:
        "Vincule a origem para impedir duplicidade. A baixa registra o pagamento; não realiza transferência bancária.",
      fields: [
        choice("kind", "Tipo", [
          ["payable", "A pagar"],
          ["receivable", "A receber"],
        ]),
        field("description", "Descrição"),
        field("amount", "Valor (R$)", "number"),
        field("competence_on", "Competência", "date"),
        field("due_on", "Vencimento", "date"),
        choice(
          "source_type",
          "Tipo da origem",
          [
            ["receipt", "Recebimento"],
            ["production", "Produção"],
            ["order", "Pedido"],
          ],
          true,
        ),
        field("source_id", "Identificador da origem", "text", true),
        reason,
      ],
    },
    {
      action: "settle",
      title: "Registrar pagamento / recebimento",
      fields: [
        select("title_id", "Título", "titles"),
        select("account_id", "Conta", "accounts"),
        field("amount", "Valor da baixa (R$)", "number"),
        field("paid_on", "Pagamento", "date"),
        reason,
      ],
      critical: true,
    },
    {
      action: "reverse",
      title: "Estornar baixa",
      fields: [select("settlement_id", "Baixa", "settlements"), reason],
      critical: true,
    },
    {
      action: "reconcile",
      title: "Conciliar baixa",
      fields: [
        select("settlement_id", "Baixa", "settlements"),
        field("external_reference", "Referência no extrato"),
        reason,
      ],
    },
  ],
  commercial: [
    {
      action: "customer_create",
      title: "Cadastrar cliente",
      fields: [
        field("name", "Nome"),
        field("user_id", "Usuário Auth para acesso ao portal", "text", true),
        reason,
      ],
    },
    {
      action: "catalog_save",
      title: "Cadastrar oferta comercial",
      fields: [
        select("id", "Oferta para revisar (vazio cria nova)", "catalog", true),
        select("variant_id", "Apresentação fabril", "variants"),
        field("name", "Nome comercial"),
        choice("unit", "Unidade de venda", unitOptions),
        field("price", "Preço unitário (R$)", "number"),
        field("active", "Ativa", "checkbox"),
        reason,
      ],
    },
    {
      action: "order_create",
      title: "Criar pedido",
      fields: [
        select("customer_id", "Cliente", "customers"),
        {
          name: "items",
          label: "Itens",
          fields: [
            select("catalog_id", "Oferta", "catalog"),
            field("quantity", "Quantidade", "number"),
          ],
        },
        reason,
      ],
    },
    {
      action: "reserve",
      title: "Reservar lotes para pedido",
      description:
        "A reserva comercial não altera o saldo físico. Selecione lotes válidos e priorize a menor validade.",
      fields: [
        select("order_id", "Pedido", "orders"),
        {
          name: "allocations",
          label: "Separação por lote",
          fields: [
            select("line_id", "Item do pedido", "lines"),
            select("lot_id", "Lote", "lots"),
            field("quantity", "Quantidade", "number"),
          ],
        },
        reason,
      ],
    },
    {
      action: "cancel",
      title: "Cancelar pedido e liberar reservas",
      fields: [select("order_id", "Pedido", "orders"), reason],
      critical: true,
    },
    {
      action: "ship",
      title: "Confirmar expedição",
      description:
        "Baixa física atômica de todos os lotes reservados, com rastreabilidade.",
      fields: [select("order_id", "Pedido", "orders"), reason],
      critical: true,
    },
    {
      action: "return",
      title: "Registrar devolução comercial",
      description:
        "O produto devolvido fica segregado. Este registro não devolve quantidade ao saldo disponível; o destino exige decisão técnica.",
      fields: [
        select("shipment_line_id", "Item expedido", "shipment_lines"),
        field("quantity", "Quantidade", "number"),
        reason,
      ],
      critical: true,
    },
  ],
  time: [
    {
      action: "record",
      title: "Apontar atividade",
      description:
        "Apontamento operacional pessoal. Não constitui ponto eletrônico oficial nem calcula remuneração.",
      fields: [
        choice("kind", "Evento", [
          ["start", "Início"],
          ["pause", "Pausa"],
          ["resume", "Retorno"],
          ["end", "Fim"],
        ]),
        field("occurred_at", "Data e hora (Brasília)", "datetime-local"),
        field("notes", "Observações", "text", true),
      ],
    },
    {
      action: "correct",
      title: "Corrigir horário com histórico",
      fields: [
        select("entry_id", "Apontamento", "entries"),
        field("occurred_at", "Horário correto (Brasília)", "datetime-local"),
        reason,
      ],
    },
  ],
};
