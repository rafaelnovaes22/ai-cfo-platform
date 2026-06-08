import { apiFetch, apiUpload, apiDownload } from "./client.js";
import type { paths } from "./types.js";

export interface TrendPoint {
  referenceMonth: string;
  receitaLiquida: number;
  lucroLiquido: number;
  ebitda: number;
  margemBruta: number;
  margemOperacional: number;
  margemLiquida: number;
}

export interface AnomalyTimelinePoint {
  referenceMonth: string;
  total: number;
  high: number;
  medium: number;
  low: number;
  codes: string[];
}

type Json<T> = T extends { content: { "application/json": infer R } }
  ? R
  : never;

type Req200<
  P extends keyof paths,
  M extends keyof paths[P],
> = paths[P][M] extends { responses: { 200: infer R } } ? Json<R> : never;
type Req201<
  P extends keyof paths,
  M extends keyof paths[P],
> = paths[P][M] extends { responses: { 201: infer R } } ? Json<R> : never;
type Body<
  P extends keyof paths,
  M extends keyof paths[P],
> = paths[P][M] extends {
  requestBody: { content: { "application/json": infer B } };
}
  ? B
  : never;

export type TokenResponse = Req200<"/auth/login", "post">;
export type MeResponse = Req200<"/auth/me", "get">;
export type HubResponse = Req200<"/hub", "get">;
export type AnalysesResponse = Req200<"/analyses", "get">;
export type DreResponse = Req200<"/analysis/{analysisId}/dre", "get">;
export type NarrativeResponse = Req200<
  "/analysis/{analysisId}/narrative",
  "get"
>;
export type ActionPlanResponse = Req200<
  "/analysis/{analysisId}/action-plan",
  "get"
>;
export type ClassificationReviewResponse = Req200<
  "/classification/{analysisId}/review",
  "get"
>;
export type WorkspaceProfileResponse = Req200<"/workspace/profile", "get">;
export type BillingSubscriptionResponse = Req200<
  "/billing/subscription",
  "get"
>;

export const auth = {
  register: (body: Body<"/auth/register", "post">) =>
    apiFetch<Req201<"/auth/register", "post">>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: Body<"/auth/login", "post">) =>
    apiFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  refresh: (refreshToken: string) =>
    apiFetch<TokenResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    apiFetch<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  me: () => apiFetch<MeResponse>("/auth/me"),

  requestPasswordReset: (email: string) =>
    apiFetch<{ ok: true }>("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  confirmPasswordReset: (token: string, password: string) =>
    apiFetch<{ ok: true }>("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
};

export const workspace = {
  getProfile: () => apiFetch<WorkspaceProfileResponse>("/workspace/profile"),

  updateProfile: (body: Body<"/workspace/profile", "patch">) =>
    apiFetch<WorkspaceProfileResponse>("/workspace/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  listMembers: () =>
    apiFetch<Req200<"/workspace/members", "get">>("/workspace/members"),

  inviteMember: (body: Body<"/workspace/members", "post">) =>
    apiFetch<Req201<"/workspace/members", "post">>("/workspace/members", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  removeMember: (userId: string) =>
    apiFetch<void>(`/workspace/members/${userId}`, { method: "DELETE" }),
};

export const billing = {
  getSubscription: () =>
    apiFetch<BillingSubscriptionResponse>("/billing/subscription"),

  createCheckout: (plan: "lite" | "pro" | "business") =>
    apiFetch<Req200<"/billing/checkout", "post">>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),

  openPortal: () =>
    apiFetch<Req200<"/billing/portal", "post">>("/billing/portal", {
      method: "POST",
    }),
};

export const tenantConfig = {
  get: () => apiFetch<Record<string, unknown>>("/config"),

  update: (body: Body<"/config", "patch">) =>
    apiFetch<Record<string, unknown>>("/config", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  updateMemberRole: (userId: string, role: "admin" | "editor" | "viewer") =>
    apiFetch<Req200<"/config/members/{userId}/role", "patch">>(
      `/config/members/${userId}/role`,
      { method: "PATCH", body: JSON.stringify({ role }) }
    ),

  listTokens: () => apiFetch<Req200<"/config/tokens", "get">>("/config/tokens"),

  createToken: (body: Body<"/config/tokens", "post">) =>
    apiFetch<Req201<"/config/tokens", "post">>("/config/tokens", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  revokeToken: (tokenId: string) =>
    apiFetch<void>(`/config/tokens/${tokenId}`, { method: "DELETE" }),
};

export const notificationConfig = {
  get: () => apiFetch<any>("/config/whatsapp"),

  update: (body: Body<"/config/whatsapp", "patch">) =>
    apiFetch<Record<string, unknown>>("/config/whatsapp", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

export const ingest = {
  upload: (file: File, referenceMonth: string) => {
    const form = new FormData();
    form.append("file", file);
    return apiUpload<Req200<"/ingest/upload", "post">>(
      `/ingest/upload?referenceMonth=${encodeURIComponent(referenceMonth)}`,
      form
    );
  },

  clipboard: (body: Body<"/ingest/clipboard", "post">) =>
    apiFetch<Req200<"/ingest/clipboard", "post">>("/ingest/clipboard", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  manual: (body: Body<"/ingest/manual", "post">) =>
    apiFetch<Req200<"/ingest/manual", "post">>("/ingest/manual", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const classification = {
  review: (analysisId: string) =>
    apiFetch<ClassificationReviewResponse>(
      `/classification/${analysisId}/review`
    ),

  correct: (
    entryId: string,
    body: Body<"/classification/entries/{entryId}/correct", "patch">
  ) =>
    apiFetch<Req200<"/classification/entries/{entryId}/correct", "patch">>(
      `/classification/entries/${entryId}/correct`,
      { method: "PATCH", body: JSON.stringify(body) }
    ),
};

export const dre = {
  get: (analysisId: string) =>
    apiFetch<DreResponse>(`/analysis/${analysisId}/dre`),

  getNarrative: (analysisId: string) =>
    apiFetch<NarrativeResponse>(`/analysis/${analysisId}/narrative`),

  narrativeFeedback: (
    analysisId: string,
    cardId: string,
    body: Body<"/analysis/{analysisId}/narrative/{cardId}/feedback", "patch">
  ) =>
    apiFetch<
      Req200<"/analysis/{analysisId}/narrative/{cardId}/feedback", "patch">
    >(`/analysis/${analysisId}/narrative/${cardId}/feedback`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

export const actionPlan = {
  get: (analysisId: string) =>
    apiFetch<ActionPlanResponse>(`/analysis/${analysisId}/action-plan`),

  feedback: (
    analysisId: string,
    itemId: string,
    body: Body<"/analysis/{analysisId}/action-plan/{itemId}/feedback", "patch">
  ) =>
    apiFetch<
      Req200<"/analysis/{analysisId}/action-plan/{itemId}/feedback", "patch">
    >(`/analysis/${analysisId}/action-plan/${itemId}/feedback`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

export const hub = {
  get: () => apiFetch<HubResponse>("/hub"),
};

export const analyses = {
  list: () => apiFetch<AnalysesResponse>("/analyses"),

  trend: () => apiFetch<{ trend: TrendPoint[] }>("/analyses/trend"),

  anomalyTimeline: () =>
    apiFetch<{ timeline: AnomalyTimelinePoint[] }>(
      "/analyses/anomaly-timeline"
    ),

  approve: (analysisId: string) =>
    apiFetch<Req200<"/analysis/{analysisId}/approve", "post">>(
      `/analysis/${analysisId}/approve`,
      { method: "POST" }
    ),
};

export const exportApi = {
  // Baixa o PDF como binário (Blob) e dispara o download no navegador.
  // Antes usava apiFetch<void>, que fazia res.json() sobre o stream PDF e quebrava.
  download: async (
    analysisId: string,
    type: "monthly" | "investors" | "partners",
  ): Promise<void> => {
    const blob = await apiDownload(`/analysis/${analysisId}/export/${type}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise-${analysisId}-${type}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const api = {
  auth,
  workspace,
  billing,
  tenantConfig,
  ingest,
  classification,
  dre,
  actionPlan,
  hub,
  analyses,
  notificationConfig,
  export: exportApi,
};
