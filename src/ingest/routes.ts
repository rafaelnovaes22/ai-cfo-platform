import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import multipart from "@fastify/multipart";
import { requireAuth, requireScope } from "@/auth/middleware.js";
import { ingest } from "@/ingest/service.js";
import { ClipboardBody, ManualBody, IngestResponse } from "@/ingest/schemas.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE } });

  const f = app.withTypeProvider<ZodTypeProvider>();

  // Upload de arquivo (xlsx, xls, csv, pdf)
  app.post("/ingest/upload", {
    preHandler: [requireAuth, requireScope("ingest:write")],
    handler: async (req, reply) => {
      const data = await req.file();
      if (!data) return reply.status(400).send({ message: "Arquivo não enviado" });

      const referenceMonth = (req.query as Record<string, string>)["referenceMonth"];
      if (!referenceMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) {
        return reply.status(400).send({ message: "Query ?referenceMonth=YYYY-MM obrigatório" });
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
    preHandler: [requireAuth, requireScope("ingest:write")],
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
    preHandler: [requireAuth, requireScope("ingest:write")],
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
