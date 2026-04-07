import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { delegationApi, type DelegationSession } from "../api/delegation";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { PageTabBar } from "../components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "../components/PageSkeleton";
import { timeAgo } from "../lib/timeAgo";
import { Gamepad2 } from "lucide-react";
import { DelegationBoardView } from "../components/DelegationBoard";
import { NewDelegationSessionDialog } from "../components/NewDelegationSessionDialog";

type TabValue = "board" | "sessions";

export function Delegations() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();
  const pathSegment = location.pathname.split("/").pop() ?? "board";
  const tab: TabValue = pathSegment === "sessions" ? "sessions" : "board";
  const [showNewSession, setShowNewSession] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Delegation" }]);
  }, [setBreadcrumbs]);

  const agreementsQuery = useQuery({
    queryKey: queryKeys.delegation.agreements(selectedCompanyId!),
    queryFn: () => delegationApi.listAgreements(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const sessionsQuery = useQuery({
    queryKey: queryKeys.delegation.sessions(selectedCompanyId!),
    queryFn: () => delegationApi.listSessions(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <p className="text-sm text-muted-foreground">Select a company first.</p>;
  }

  if (agreementsQuery.isLoading || agentsQuery.isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const openSessions = (sessionsQuery.data ?? []).filter((s) => s.status === "open");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => navigate(`/delegation/${v}`)}>
          <PageTabBar
            items={[
              { value: "board", label: "Board" },
              {
                value: "sessions",
                label: (
                  <>
                    Sessions
                    {openSessions.length > 0 && (
                      <span className={cn(
                        "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        "bg-yellow-500/20 text-yellow-500",
                      )}>
                        {openSessions.length}
                      </span>
                    )}
                  </>
                ),
              },
            ]}
          />
        </Tabs>
        <Button size="sm" onClick={() => setShowNewSession(true)}>
          <Gamepad2 className="h-3.5 w-3.5 mr-1.5" />
          New Session
        </Button>
      </div>

      {tab === "board" && (
        <DelegationBoardView
          agreements={agreementsQuery.data ?? []}
          agents={agentsQuery.data ?? []}
          companyId={selectedCompanyId}
        />
      )}

      {tab === "sessions" && (
        <SessionsList
          sessions={sessionsQuery.data ?? []}
          agents={agentsQuery.data ?? []}
        />
      )}

      {showNewSession && (
        <NewDelegationSessionDialog
          companyId={selectedCompanyId}
          agents={agentsQuery.data ?? []}
          onClose={() => setShowNewSession(false)}
        />
      )}
    </div>
  );
}

function SessionsList({
  sessions,
  agents,
}: {
  sessions: DelegationSession[];
  agents: { id: string; name: string; icon?: string | null }[];
}) {
  const navigate = useNavigate();
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Gamepad2 className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No delegation poker sessions yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {sorted.map((session) => {
        const agent = agents.find((a) => a.id === session.agentId);
        return (
          <button
            key={session.id}
            onClick={() => navigate(`/delegation/sessions/${session.id}`)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-accent/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {agent?.name ?? "Unknown agent"}
                </span>
                <span className="text-xs text-muted-foreground">/ {session.scope}</span>
                <SessionStatusBadge status={session.status} />
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {session.proposedLevel && (
                  <span>Proposed: L{session.proposedLevel}</span>
                )}
                {session.finalLevel && (
                  <span className="font-medium text-foreground">Final: L{session.finalLevel}</span>
                )}
                <span>{timeAgo(session.createdAt)}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-yellow-500/15 text-yellow-600",
    resolved: "bg-green-500/15 text-green-600",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", styles[status] ?? styles.open)}>
      {status}
    </span>
  );
}
