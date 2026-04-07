import { api } from "./client";

// --- Response types (match server schema) ---

export interface DelegationAgreement {
  id: string;
  companyId: string;
  agentId: string;
  scope: string;
  level: number;
  decidedByUserId: string | null;
  decidedByAgentId: string | null;
  sessionId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DelegationSession {
  id: string;
  companyId: string;
  agentId: string;
  scope: string;
  status: "open" | "resolved" | "cancelled";
  proposedLevel: number | null;
  finalLevel: number | null;
  participants: string[];
  initiatedByUserId: string | null;
  initiatedByAgentId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DelegationVote {
  id: string;
  sessionId: string;
  voterUserId: string | null;
  voterAgentId: string | null;
  level: number;
  rationale: string | null;
  createdAt: string;
}

export interface VoteSummary {
  session: DelegationSession;
  count: number;
  average: number;
  min: number;
  max: number;
}

// --- API client ---

export const delegationApi = {
  // Agreements
  listAgreements: (companyId: string, agentId?: string) =>
    api.get<DelegationAgreement[]>(
      `/companies/${companyId}/delegation-agreements${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ""}`,
    ),
  createAgreement: (companyId: string, data: { agentId: string; scope?: string; level: number; notes?: string }) =>
    api.post<DelegationAgreement>(`/companies/${companyId}/delegation-agreements`, data),
  getAgreement: (id: string) => api.get<DelegationAgreement>(`/delegation-agreements/${id}`),
  updateAgreement: (id: string, data: { level?: number; notes?: string }) =>
    api.patch<DelegationAgreement>(`/delegation-agreements/${id}`, data),
  deleteAgreement: (id: string) => api.delete(`/delegation-agreements/${id}`),

  // Sessions
  listSessions: (companyId: string, status?: string) =>
    api.get<DelegationSession[]>(
      `/companies/${companyId}/delegation-sessions${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  createSession: (companyId: string, data: { agentId: string; scope?: string; proposedLevel?: number; participants?: string[] }) =>
    api.post<DelegationSession>(`/companies/${companyId}/delegation-sessions`, data),
  getSession: (id: string) => api.get<DelegationSession>(`/delegation-sessions/${id}`),
  resolveSession: (id: string, data: { finalLevel: number; notes?: string }) =>
    api.post<DelegationSession>(`/delegation-sessions/${id}/resolve`, data),
  cancelSession: (id: string) => api.post<DelegationSession>(`/delegation-sessions/${id}/cancel`, {}),

  // Votes
  listVotes: (sessionId: string) => api.get<DelegationVote[]>(`/delegation-sessions/${sessionId}/votes`),
  castVote: (sessionId: string, data: { level: number; rationale?: string }) =>
    api.post<DelegationVote>(`/delegation-sessions/${sessionId}/votes`, data),
  getVoteSummary: (sessionId: string) => api.get<VoteSummary>(`/delegation-sessions/${sessionId}/summary`),
};
