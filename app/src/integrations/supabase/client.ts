// Stub temporário — @supabase/supabase-js foi removido em Wave 3.
// Os arquivos que ainda importam daqui serão migrados para o api client
// Aicfo (src/lib/api/) na Wave 5. Qualquer chamada em runtime retornará erro
// até a migração ser completada.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = new Proxy({} as any, {
  get(_target, prop) {
    if (prop === "auth") {
      return new Proxy({} as Record<string, unknown>, {
        get() {
          return () =>
            Promise.resolve({
              data: null,
              error: new Error("Supabase removido — use api client Aicfo"),
            });
        },
      });
    }
    if (prop === "from") {
      return () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      });
    }
    return undefined;
  },
});
