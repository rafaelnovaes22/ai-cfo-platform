import { judgeClarity } from "@/classification/judge.js";

const SAMPLES = [
  // Esperado: clear (NF + termo categórico)
  { entryId: "s1", description: "SALARIO FUNCIONARIOS ABRIL" },
  { entryId: "s2", description: "PAGAMENTO NF 1234 FORNECEDOR ACME LTDA" },
  { entryId: "s3", description: "AWS SERVICES ANNUAL SUBSCRIPTION" },
  { entryId: "s4", description: "RENDIMENTO CDB BANCO XP ABR/2026" },
  { entryId: "s5", description: "ENERGIA ELETRICA CEMIG" },

  // Esperado: ambiguous (sem identificador, ambíguos)
  { entryId: "a1", description: "PIX RECEBIDO MARIA" },
  { entryId: "a2", description: "PAGAMENTO ALUGUEL JOAO LOCADOR" },
  { entryId: "a3", description: "REEMBOLSO DESPESA COLABORADOR ABRIL" },
  { entryId: "a4", description: "ESTORNO TARIFA INDEVIDA REF 03/2026" },
  { entryId: "a5", description: "TED RECEBIDO" },
];

async function main(): Promise<void> {
  const t0 = Date.now();
  const results = await judgeClarity(SAMPLES, "smoke");
  const ms = Date.now() - t0;

  console.table(
    results.map((r) => ({
      entryId: r.entryId,
      description: SAMPLES.find((s) => s.entryId === r.entryId)?.description.slice(0, 50),
      clarity: r.clarity,
      reason: r.reason.slice(0, 60),
    })),
  );
  console.log(`\nLatência total: ${ms}ms para ${SAMPLES.length} entries`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
