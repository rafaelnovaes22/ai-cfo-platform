import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import multipart from "@fastify/multipart";
import { requireAuth, requireWrite } from "@/auth/middleware.js";
import { problemDetail, ProblemDetailSchema } from "@/http/problem-detail.js";
import { ingest } from "@/ingest/service.js";
import { ClipboardBody, ManualBody, IngestResponse } from "@/ingest/schemas.js";

// Mutação: humano precisa ser admin/editor (viewer não importa lançamentos);
// api token precisa de ingest:write.
const ingestWrite = requireWrite(["admin", "editor"], ["ingest:write"]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } });

  const f = app.withTypeProvider<ZodTypeProvider>();

  // Upload de arquivo (xlsx, xls, csv, pdf)
  app.post("/ingest/upload", {
    // Response schema declarado para o OpenAPI tipar a resposta (antes saía como
    // 'never' no types.ts gerado, quebrando o acesso a .outcome/.entryCount no front).
    schema: { response: { 200: IngestResponse, 400: ProblemDetailSchema } },
    preHandler: [requireAuth, ingestWrite],
    handler: async (req, reply) => {
      const data = await req.file();
      if (!data) {
        return reply.status(400).send(
          problemDetail({ type: "https://api.aicfo.com.br/errors/bad-request", title: "Arquivo não enviado", status: 400 }),
        );
      }

      const referenceMonth = (req.query as Record<string, string>)["referenceMonth"];
      if (!referenceMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) {
        return reply.status(400).send(
          problemDetail({ type: "https://api.aicfo.com.br/errors/bad-request", title: "Query ?referenceMonth=YYYY-MM obrigatório", status: 400 }),
        );
      }

      const ext = data.filename.split(".").pop()?.toLowerCase() ?? "";
      const source = ext === "pdf" ? "pdf" : ["xlsx", "xls"].includes(ext) ? "excel" : "csv";
      const buffer = await data.toBuffer();

      const result = await ingest({ tenantId: req.auth!.tenantId, referenceMonth, source, buffer });
      return reply.send(result);
    },
  });

  // Texto colado (clipboard)
  f.post("/ingest/clipboard", {
    schema: { body: ClipboardBody, response: { 200: IngestResponse } },
    preHandler: [requireAuth, ingestWrite],
    handler: async (req, reply) => {
      const result = await ingest({
        tenantId: req.auth!.tenantId,
        referenceMonth: req.body.referenceMonth,
        source: "text",
        text: req.body.text,
      });
      return reply.send(result);
    },
  });

  // Formulário manual (JSON)
  f.post("/ingest/manual", {
    schema: { body: ManualBody, response: { 200: IngestResponse } },
    preHandler: [requireAuth, ingestWrite],
    handler: async (req, reply) => {
      const result = await ingest({
        tenantId: req.auth!.tenantId,
        referenceMonth: req.body.referenceMonth,
        source: "manual",
        entries: req.body.entries,
      });
      return reply.send(result);
    },
  });
};
