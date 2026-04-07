import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { delegationApi, type DelegationAgreement } from "../api/delegation";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { DELEGATION_LEVEL_LABELS, DELEGATION_SCOPES } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Handshake } from "lucide-react";

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-red-500/20 text-red-600 border-red-500/30",
  2: "bg-orange-500/20 text-orange-600 border-orange-500/30",
  3: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  4: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  5: "bg-green-500/20 text-green-600 border-green-500/30",
};

const LEVEL_BG: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-yellow-500",
  4: "bg-blue-500",
  5: "bg-green-500",
};

interface Agent {
  id: string;
  name: string;
  icon?: string | null;
  status?: string;
}

export function DelegationBoardView({
  agreements,
  agents,
  companyId,
}: {
  agreements: DelegationAgreement[];
  agents: Agent[];
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState<{ agentId: string; scope: string } | null>(null);

  const upsertMutation = useMutation({
    mutationFn: (data: { agentId: string; scope: string; level: number }) =>
      delegationApi.createAgreement(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delegation.agreements(companyId) });
      setEditingCell(null);
    },
  });

  // Build lookup: agentId+scope -> agreement
  const lookup = new Map<string, DelegationAgreement>();
  for (const a of agreements) {
    lookup.set(`${a.agentId}:${a.scope}`, a);
  }

  // Get scopes that have at least one agreement, plus standard scopes
  const usedScopes = new Set(agreements.map((a) => a.scope));
  const scopes: string[] = ([...DELEGATION_SCOPES] as string[]).filter((s) => s !== "all");
  // Add any custom scopes
  for (const s of usedScopes) {
    if (!scopes.includes(s) && s !== "all") scopes.push(s);
  }

  // Filter to active agents
  const activeAgents = agents.filter((a) => a.status !== "archived");

  if (activeAgents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Handshake className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No agents to display delegation levels for.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall delegation level per agent */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Overall Delegation Level
        </h3>
        <div className="grid gap-2">
          {activeAgents.map((agent) => {
            const overall = lookup.get(`${agent.id}:all`);
            return (
              <AgentDelegationRow
                key={agent.id}
                agent={agent}
                agreement={overall ?? null}
                scope="all"
                isEditing={editingCell?.agentId === agent.id && editingCell?.scope === "all"}
                onEdit={() => setEditingCell({ agentId: agent.id, scope: "all" })}
                onSetLevel={(level) => upsertMutation.mutate({ agentId: agent.id, scope: "all", level })}
                onCancel={() => setEditingCell(null)}
                isPending={upsertMutation.isPending}
              />
            );
          })}
        </div>
      </div>

      {/* Scope matrix */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Per-Scope Delegation
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground w-40">
                  Agent
                </th>
                {scopes.map((scope) => (
                  <th
                    key={scope}
                    className="text-center py-2 px-2 text-xs font-medium text-muted-foreground capitalize"
                  >
                    {scope.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeAgents.map((agent) => (
                <tr key={agent.id} className="border-b border-border/50">
                  <td className="py-2 pr-4">
                    <span className="text-sm font-medium truncate">{agent.name}</span>
                  </td>
                  {scopes.map((scope) => {
                    const agreement = lookup.get(`${agent.id}:${scope}`);
                    const isEditing = editingCell?.agentId === agent.id && editingCell?.scope === scope;
                    return (
                      <td key={scope} className="py-2 px-2 text-center">
                        {isEditing ? (
                          <LevelPicker
                            currentLevel={agreement?.level}
                            onSelect={(level) =>
                              upsertMutation.mutate({ agentId: agent.id, scope, level })
                            }
                            onCancel={() => setEditingCell(null)}
                          />
                        ) : (
                          <button
                            onClick={() => setEditingCell({ agentId: agent.id, scope })}
                            className={cn(
                              "inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium transition-colors min-w-[4rem]",
                              agreement
                                ? LEVEL_COLORS[agreement.level]
                                : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
                            )}
                          >
                            {agreement
                              ? `L${agreement.level} ${(DELEGATION_LEVEL_LABELS as Record<number, string>)[agreement.level]}`
                              : "—"}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2">
        {[1, 2, 3, 4, 5].map((level) => (
          <div key={level} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-sm", LEVEL_BG[level])} />
            <span className="text-xs text-muted-foreground">
              L{level} {(DELEGATION_LEVEL_LABELS as Record<number, string>)[level]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentDelegationRow({
  agent,
  agreement,
  scope,
  isEditing,
  onEdit,
  onSetLevel,
  onCancel,
  isPending,
}: {
  agent: Agent;
  agreement: DelegationAgreement | null;
  scope: string;
  isEditing: boolean;
  onEdit: () => void;
  onSetLevel: (level: number) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{agent.name}</span>
      </div>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <LevelPicker
            currentLevel={agreement?.level}
            onSelect={onSetLevel}
            onCancel={onCancel}
          />
        ) : (
          <>
            {agreement ? (
              <DelegationLevelBadge level={agreement.level} />
            ) : (
              <span className="text-xs text-muted-foreground">Not set</span>
            )}
            <Button variant="ghost" size="icon-sm" onClick={onEdit}>
              <Handshake className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function LevelPicker({
  currentLevel,
  onSelect,
  onCancel,
}: {
  currentLevel?: number;
  onSelect: (level: number) => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          onClick={() => onSelect(level)}
          className={cn(
            "w-7 h-7 rounded-md text-xs font-bold transition-all",
            level === currentLevel
              ? cn(LEVEL_COLORS[level], "ring-2 ring-offset-1 ring-offset-background", `ring-current`)
              : cn("bg-muted/50 text-muted-foreground hover:scale-110", `hover:${LEVEL_BG[level]} hover:text-white`),
          )}
          title={`L${level} ${(DELEGATION_LEVEL_LABELS as Record<number, string>)[level]}`}
        >
          {level}
        </button>
      ))}
      <button
        onClick={onCancel}
        className="ml-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}

export function DelegationLevelBadge({ level, size = "sm" }: { level: number; size?: "sm" | "lg" }) {
  const label = (DELEGATION_LEVEL_LABELS as Record<number, string>)[level] ?? `L${level}`;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-medium border",
        LEVEL_COLORS[level],
        size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs",
      )}
    >
      L{level} {label}
    </span>
  );
}
