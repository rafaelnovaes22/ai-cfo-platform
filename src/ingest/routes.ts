import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import multipart from "@fastify/multipart";
import { requireAuth, requireWrite } from "@/auth/middleware.js";
import { problemDetail, ProblemDetailSchema } from "@/http/problem-detail.js";
import { ingest } from "@/ingest/service.js";
import { ClipboardBody, ManualBody, IngestResponse } from "@/ingest/schemas.js";
import { getPrisma } from "@/persistence/prisma.js";
import { isSubscriber } from "@/auth/subscription-access.js";
import { analysisQueueAtCapacity } from "@/queue/index.js";
import type { FastifyReply } from "fastify";

// Backpressure (Gate 1.2): recusa ingestão que GERA análise quando a fila de
// análise está saturada, antes de parsear a planilha em memória. Free tier
// (skipAnalysis=true, não enfileira) passa direto. Retorna true se já respondeu 503.
async function rejectIfQueueSaturated(reply: FastifyReply, skipAnalysis: boolean): Promise<boolean> {
  if (skipAnalysis) return false;
  if (await analysisQueueAtCapacity()) {
    reply.status(503).header("Retry-After", "60").send(
      problemDetail({
        type: "https://api.aicfo.com.br/errors/service-unavailable",
        title: "Sistema sob alta demanda",
        status: 503,
        detail: "A fila de análise está cheia no momento. Tente novamente em alguns instantes.",
      }),
    );
    return true;
  }
  return false;
}

// Mutação: humano precisa ser admin/editor (viewer não importa lançamentos);
// api token precisa de ingest:write.
const ingestWrite = requireWrite(["admin", "editor"], ["ingest:write"]);

// A análise (DRE + classificação + narrativa, tudo com LLM) é feature PAGA: roda
// só para assinante ativo. Lead/free (student/trial/sem assinatura/inadimplente)
// importa em modo cashflow-only — parse+store determinístico, zero IA, custo R$0.
export async function resolveSkipAnalysis(tenantId: string): Promise<boolean> {
  const sub = await getPrisma().subscription.findUnique({
    where: { tenantId },
    select: { plan: true, status: true },
  });
  return !isSubscriber(sub?.plan, sub?.status);
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } });

  const f = app.withTypeProvider<ZodTypeProvider>();

  // Upload de arquivo (xlsx, xls, csv, pdf)
  app.post("/ingest/upload", {
    // Response schema declarado para o OpenAPI tipar a resposta (antes saía como
    // 'never' no types.ts gerado, quebrando o acesso a .outcome/.entryCount no front).
    schema: { response: { 200: IngestResponse, 400: ProblemDetailSchema, 503: ProblemDetailSchema } },
    preHandler: [requireAuth, ingestWrite],
    handler: async (req, reply) => {
      // Backpressure antes de consumir/parsear o arquivo (evita carregar planilha
      // em memória sob saturação). Free tier passa direto.
      const skipAnalysis = await resolveSkipAnalysis(req.auth!.tenantId);
      if (await rejectIfQueueSaturated(reply, skipAnalysis)) return;

      const data = await req.file();
      if (!data) {
        return reply.status(400).send(
          problemDetail({ type: "https://api.aicfo.com.br/errors/bad-request", title: "Arquivo não enviado", status: 400 }),
        );
      }

      // referenceMonth é OPCIONAL: o ingest distribui os lançamentos por mês de
      // competência do próprio extrato (uma análise por mês). Quando informado,
      // serve só de fallback para lançamentos sem data; ausente → usa o mês atual.
      // Formato inválido (não-vazio e malformado) ainda é 400.
      const referenceMonthRaw = (req.query as Record<string, string>)["referenceMonth"];
      if (referenceMonthRaw && !/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonthRaw)) {
        return reply.status(400).send(
          problemDetail({ type: "https://api.aicfo.com.br/errors/bad-request", title: "Query ?referenceMonth deve ser YYYY-MM", status: 400 }),
        );
      }
      const referenceMonth = referenceMonthRaw || new Date().toISOString().slice(0, 7);

      // Whitelist de extensões: antes, qualquer extensão desconhecida (.exe,
      // .zip, sem extensão) caía silenciosamente no parser CSV.
      const ext = data.filename.split(".").pop()?.toLowerCase() ?? "";
      const SOURCE_BY_EXT: Record<string, "pdf" | "excel" | "csv"> = {
        pdf: "pdf", xlsx: "excel", xls: "excel", csv: "csv",
      };
      const source = SOURCE_BY_EXT[ext];
      if (!source) {
        return reply.status(400).send(
          problemDetail({
            type: "https://api.aicfo.com.br/errors/bad-request",
            title: "Formato de arquivo não suportado",
            status: 400,
            detail: `Extensão ".${ext}" não é aceita. Envie PDF, Excel (.xlsx/.xls) ou CSV.`,
          }),
        );
      }
      const buffer = await data.toBuffer();

      const result = await ingest({ tenantId: req.auth!.tenantId, referenceMonth, source, buffer, fileName: data.filename, skipAnalysis });
      return reply.send(result);
    },
  });

  // Texto colado (clipboard)
  f.post("/ingest/clipboard", {
    schema: { body: ClipboardBody, response: { 200: IngestResponse, 503: ProblemDetailSchema } },
    preHandler: [requireAuth, ingestWrite],
    handler: async (req, reply) => {
      const skipAnalysis = await resolveSkipAnalysis(req.auth!.tenantId);
      if (await rejectIfQueueSaturated(reply, skipAnalysis)) return;
      const result = await ingest({
        tenantId: req.auth!.tenantId,
        referenceMonth: req.body.referenceMonth,
        source: "text",
        text: req.body.text,
        skipAnalysis,
      });
      return reply.send(result);
    },
  });

  // Formulário manual (JSON)
  f.post("/ingest/manual", {
    schema: { body: ManualBody, response: { 200: IngestResponse, 503: ProblemDetailSchema } },
    preHandler: [requireAuth, ingestWrite],
    handler: async (req, reply) => {
      const skipAnalysis = await resolveSkipAnalysis(req.auth!.tenantId);
      if (await rejectIfQueueSaturated(reply, skipAnalysis)) return;
      const result = await ingest({
        tenantId: req.auth!.tenantId,
        referenceMonth: req.body.referenceMonth,
        source: "manual",
        entries: req.body.entries,
        skipAnalysis,
      });
      return reply.send(result);
    },
  });
};
