import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PreparationTerminal } from "@/components/production/preparation-terminal";
import type { PreparationSnapshot } from "@/lib/preparation/types";
import "@/app/preparation-styles.css";

export const instant = false;

export default async function PreparationPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  await connection();
  const now = Date.parse("2026-11-11T12:00:00.000Z");
  const steps = [
    "Conferir o lote e separar os utensílios.",
    "Seguir o procedimento aprovado para a fruta.",
    "Identificar e guardar os baldes no local definido.",
  ];
  const snapshot: PreparationSnapshot = {
    serverTime: new Date(now).toISOString(),
    actor: { id: "preview", name: "Operador de exemplo", role: "admin" },
    reminders: { workMinutes: 90, restMinutes: 30 },
    products: [{ id: "fruit", name: "Tamarindo" }],
    guides: [
      {
        id: "guide",
        productId: "fruit",
        productName: "Tamarindo",
        revision: 1,
        status: "approved",
        steps,
      },
    ],
    rawLots: [
      {
        id: "raw",
        code: "ITEM-EXEMPLO-1",
        productId: "fruit",
        productName: "Tamarindo",
        quantity: 3,
        unit: "pct",
        locationName: "Estoque de frutas",
        expiresOn: null,
      },
    ],
    locations: [
      { id: "freezer", name: "Freezer 1" },
      { id: "pulping", name: "Área de despolpa" },
    ],
    batches: [
      {
        id: "batch",
        code: "PREP-EXEMPLO-1",
        status: "active",
        sourceLotId: "raw",
        sourceCode: "ITEM-EXEMPLO-1",
        productName: "Tamarindo",
        productId: "fruit",
        inputQuantity: 2,
        inputUnit: "pct",
        startedAt: new Date(now - 25 * 60 * 1000).toISOString(),
        pausedAt: null,
        pausedSeconds: 0,
        completedAt: null,
        processedQuantity: null,
        bucketCount: null,
        destination: null,
        locationName: null,
        guide: { guideId: "guide", revision: 1, steps },
        workers: [
          {
            id: "worker-1",
            userId: "person-1",
            name: "Responsável pelo preparo",
            startedAt: new Date(now - 25 * 60 * 1000).toISOString(),
            endedAt: null,
            pausedAt: null,
            pausedSeconds: 0,
          },
          {
            id: "worker-2",
            userId: "person-2",
            name: "Ajudante",
            startedAt: new Date(now - 20 * 60 * 1000).toISOString(),
            endedAt: null,
            pausedAt: new Date(now - 5 * 60 * 1000).toISOString(),
            pausedSeconds: 0,
          },
        ],
        outputLots: [],
      },
    ],
  };
  return <PreparationTerminal initial={snapshot} preview />;
}
