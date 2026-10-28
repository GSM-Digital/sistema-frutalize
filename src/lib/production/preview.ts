import type { TerminalSnapshot } from "./ui-types";

const actorId = "11111111-1111-4111-8111-111111111111";
export const previewRunId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";
const variantId = "44444444-4444-4444-8444-444444444444";

export const previewSnapshot: TerminalSnapshot = {
  actor: { id: actorId, name: "Operador(a) de exemplo", role: "admin" },
  serverTime: "2026-10-28T15:00:00-03:00",
  locations: [
    { id: "55555555-5555-4555-8555-555555555555", name: "Freezer 1" },
  ],
  instruments: [
    { id: "66666666-6666-4666-8666-666666666666", name: "Balança de exemplo" },
  ],
  lots: [
    {
      id: "77777777-7777-4777-8777-777777777777",
      code: "EXEMPLO-FRUTA-01",
      product_name: "Fruta fictícia",
      product_id: productId,
      quantity: 25,
      unit: "kg",
    },
  ],
  procedures: [
    {
      id: "88888888-8888-4888-8888-888888888888",
      name: "Procedimento fictício para demonstração",
      product_id: productId,
      output_variant_id: variantId,
      revision: 1,
      status: "approved",
      steps: [
        {
          phase: 1,
          step: 1,
          title: "Conferir a ordem e os insumos",
          instruction:
            "Exemplo visual: confira os dados e siga apenas o procedimento real aprovado pela operação.",
          kind: "confirm",
          required: true,
        },
        {
          phase: 1,
          step: 2,
          title: "Registrar a medição",
          instruction:
            "Exemplo visual de uma etapa de qualidade, sem parâmetros reais de produção.",
          kind: "quality",
          required: true,
        },
      ],
    },
  ],
  profiles: [
    {
      id: "99999999-9999-4999-8999-999999999999",
      name: "Perfil fictício",
      product_id: productId,
      output_variant_id: variantId,
      revision: 1,
      status: "approved",
      parameters: [],
    },
  ],
  qualitySpecs: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Regra fictícia",
      output_variant_id: variantId,
      revision: 1,
      status: "approved",
      unit: "g",
      minimum: 0,
      maximum: 0,
      tare: 0,
      requires_calibration: false,
    },
  ],
  runs: [
    {
      id: previewRunId,
      code: "ORDEM-EXEMPLO-01",
      revision: 3,
      status: "in_progress",
      operational_status: "in_progress",
      phase: 1,
      step: 1,
      operator_id: actorId,
      operator_name: "Operador(a) de exemplo",
      started_at: "2026-10-28T14:30:00-03:00",
      paused_at: null,
      paused_seconds: 0,
      procedure_id: "88888888-8888-4888-8888-888888888888",
      profile_id: "99999999-9999-4999-8999-999999999999",
      quality_spec_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      procedure: {
        id: "88888888-8888-4888-8888-888888888888",
        name: "Procedimento fictício para demonstração",
        product_id: productId,
        output_variant_id: variantId,
        revision: 1,
        status: "approved",
        steps: [
          {
            phase: 1,
            step: 1,
            title: "Conferir a ordem e os insumos",
            instruction:
              "Exemplo visual: confira os dados e siga apenas o procedimento real aprovado pela operação.",
            kind: "confirm",
            required: true,
          },
        ],
      },
      profile: {
        id: "99999999-9999-4999-8999-999999999999",
        name: "Perfil fictício",
        product_id: productId,
        output_variant_id: variantId,
        revision: 1,
        status: "approved",
        parameters: [],
      },
      qualitySpec: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Regra fictícia",
        output_variant_id: variantId,
        revision: 1,
        status: "approved",
        unit: "g",
        minimum: 0,
        maximum: 0,
        tare: 0,
        requires_calibration: false,
      },
      inputs: [
        {
          lot_id: "77777777-7777-4777-8777-777777777777",
          code: "EXEMPLO-FRUTA-01",
          product_name: "Fruta fictícia",
          quantity: 5,
          unit: "kg",
        },
      ],
      qualityChecks: [],
      nonconformities: [],
      output_lot_id: null,
      output_variant_id: variantId,
      updated_at: "2026-10-28T14:45:00-03:00",
    },
  ],
};
