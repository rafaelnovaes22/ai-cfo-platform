import { PDFParse } from "pdf-parse";

// Defesa em profundidade (paridade com MAX_XLSX_BYTES do excel.ts): o multipart
// já limita em 20MB, mas o parser não deve confiar só na borda HTTP.
const MAX_PDF_BYTES = 20 * 1024 * 1024;
// PDFs malformados/escaneados podem prender o pdf-parse por minutos (DoS).
const PDF_PARSE_TIMEOUT_MS = 30_000;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error(`pdf-file-too-large: ${buffer.length} bytes > ${MAX_PDF_BYTES}`);
  }

  const parser = new PDFParse({ data: buffer });
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`pdf-parse-timeout: extração excedeu ${PDF_PARSE_TIMEOUT_MS}ms`)),
        PDF_PARSE_TIMEOUT_MS,
      );
    });
    const result = await Promise.race([parser.getText(), timeout]);
    return result.text;
  } finally {
    if (timer) clearTimeout(timer);
    await parser.destroy().catch(() => {});
  }
}
