import { useEffect, useState } from "react";
import { useParams, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { delegationApi, type DelegationVote } from "../api/delegation";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "../components/PageSkeleton";
import { DelegationLevelBadge } from "../components/DelegationBoard";
import { DELEGATION_LEVEL_LABELS } from "@paperclipai/shared";
import { Check, X, Gamepad2 } from "lucide-react";

export function DelegationSessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [voteLevel, setVoteLevel] = useState<number | null>(null);
  const [voteRationale, setVoteRationale] = useState("");
  const [resolveLevel, setResolveLevel] = useState<number | null>(null);

  const sessionQuery = useQuery({
    queryKey: queryKeys.delegation.sessionDetail(sessionId!),
    queryFn: () => delegationApi.getSession(sessionId!),
    enabled: !!sessionId,
  });

  const votesQuery = useQuery({
    queryKey: queryKeys.delegation.votes(sessionId!),
    queryFn: () => delegationApi.listVotes(sessionId!),
    enabled: !!sessionId,
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.delegation.voteSummary(sessionId!),
    queryFn: () => delegationApi.getVoteSummary(sessionId!),
    enabled: !!sessionId,
  });

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const session = sessionQuery.data;
  const agent = session ? (agentsQuery.data ?? []).find((a) => a.id === session.agentId) : null;

  useEffect(() => {
    setBreadcrumbs([
      { label: "Delegation", href: "/delegation" },
      { label: "Sessions", href: "/delegation/sessions" },
      { label: agent?.name ?? "Session" },
    ]);
  }, [setBreadcrumbs, agent?.name]);

  const castVoteMutation = useMutation({
    mutationFn: () =>
      delegationApi.castVote(sessionId!, {
        level: voteLevel!,
        rationale: voteRationale || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delegation.votes(sessionId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.delegation.voteSummary(sessionId!) });
      setVoteLevel(null);
      setVoteRationale("");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      delegationApi.resolveSession(sessionId!, { finalLevel: resolveLevel! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delegation.sessionDetail(sessionId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.delegation.sessions(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.delegation.agreements(selectedCompanyId!) });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => delegationApi.cancelSession(sessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delegation.sessionDetail(sessionId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.delegation.sessions(selectedCompanyId!) });
    },
  });

  if (sessionQuery.isLoading) return <PageSkeleton variant="list" />;
  if (!session) return <p className="text-sm text-destructive">Session not found.</p>;

  const isOpen = session.status === "open";
  const votes = votesQuery.data ?? [];
  const summary = summaryQuery.data;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            Delegation Poker: {agent?.name ?? "Unknown"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Scope: <span className="font-medium capitalize">{session.scope.replace(/_/g, " ")}</span>
            {" · "}
            Started {timeAgo(session.createdAt)}
          </p>
        </div>
        <SessionStatusBadgeLarge status={session.status} />
      </div>

      {/* Proposed & Final levels */}
      <div className="flex gap-4">
        {session.proposedLevel && (
          <div className="rounded-lg border border-border bg-card p-4 flex-1">
            <p className="text-xs text-muted-foreground mb-2">Proposed Level</p>
            <DelegationLevelBadge level={session.proposedLevel} size="lg" />
          </div>
        )}
        {session.finalLevel && (
          <div className="rounded-lg border border-border bg-card p-4 flex-1">
            <p className="text-xs text-muted-foreground mb-2">Final Level</p>
            <DelegationLevelBadge level={session.finalLevel} size="lg" />
          </div>
        )}
      </div>

      {/* Vote Summary */}
      {summary && summary.count > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">Vote Summary</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{summary.count}</p>
              <p className="text-xs text-muted-foreground">Votes</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.average}</p>
              <p className="text-xs text-muted-foreground">Average</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.min}</p>
              <p className="text-xs text-muted-foreground">Min</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.max}</p>
              <p className="text-xs text-muted-foreground">Max</p>
            </div>
          </div>
          {/* Visual vote distribution */}
          <div className="flex gap-1 mt-4">
            {[1, 2, 3, 4, 5].map((level) => {
              const count = votes.filter((v) => v.level === level).length;
              const pct = summary.count > 0 ? (count / summary.count) * 100 : 0;
              return (
                <div key={level} className="flex-1 text-center">
                  <div className="h-16 flex items-end justify-center">
                    <div
                      className={cn(
                        "w-full max-w-[2rem] rounded-t-sm transition-all",
                        count > 0 ? levelBg(level) : "bg-muted/30",
                      )}
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">L{level}</p>
                  <p className="text-[10px] font-medium">{count}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Individual votes */}
      {votes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Votes</h3>
          <div className="grid gap-2">
            {votes.map((vote) => (
              <VoteCard key={vote.id} vote={vote} agents={agentsQuery.data ?? []} />
            ))}
          </div>
        </div>
      )}

      {/* Cast vote (if open) */}
      {isOpen && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">Cast Your Vote</h3>
          <div className="flex gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                onClick={() => setVoteLevel(level)}
                className={cn(
                  "flex-1 py-3 rounded-lg text-center transition-all border-2",
                  voteLevel === level
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50",
                )}
              >
                <p className="text-lg font-bold">{level}</p>
                <p className="text-[10px] text-muted-foreground">
                  {(DELEGATION_LEVEL_LABELS as Record<number, string>)[level]}
                </p>
              </button>
            ))}
          </div>
          <textarea
            placeholder="Rationale (optional)"
            value={voteRationale}
            onChange={(e) => setVoteRationale(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none h-16 mb-3"
          />
          {castVoteMutation.error && (
            <p className="text-sm text-destructive mb-2">
              {castVoteMutation.error instanceof Error ? castVoteMutation.error.message : "Failed to cast vote"}
            </p>
          )}
          <Button
            onClick={() => castVoteMutation.mutate()}
            disabled={voteLevel === null || castVoteMutation.isPending}
          >
            {castVoteMutation.isPending ? "Voting..." : "Submit Vote"}
          </Button>
        </div>
      )}

      {/* Resolve / Cancel (if open) */}
      {isOpen && (
        <div className="rounded-lg border border-dashed border-border p-4">
          <h3 className="text-sm font-medium mb-3">Resolve Session</h3>
          <div className="flex gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                onClick={() => setResolveLevel(level)}
                className={cn(
                  "w-10 h-10 rounded-lg text-sm font-bold transition-all border-2",
                  resolveLevel === level
                    ? "border-green-500 bg-green-500/10 text-green-600"
                    : "border-border text-muted-foreground hover:border-green-500/50",
                )}
              >
                {level}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => resolveMutation.mutate()}
              disabled={resolveLevel === null || resolveMutation.isPending}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {resolveMutation.isPending ? "Resolving..." : "Resolve"}
            </Button>
            <Button
              variant="outline"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Cancel Session
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function VoteCard({
  vote,
  agents,
}: {
  vote: DelegationVote;
  agents: { id: string; name: string }[];
}) {
  const voterName = vote.voterAgentId
    ? agents.find((a) => a.id === vote.voterAgentId)?.name ?? "Agent"
    : "User";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <DelegationLevelBadge level={vote.level} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{voterName}</p>
        {vote.rationale && (
          <p className="text-xs text-muted-foreground mt-0.5">{vote.rationale}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(vote.createdAt)}</p>
      </div>
    </div>
  );
}

function SessionStatusBadgeLarge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    resolved: "bg-green-500/15 text-green-600 border-green-500/30",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={cn("rounded-md px-3 py-1 text-xs font-medium border", styles[status])}>
      {status}
    </span>
  );
}

function levelBg(level: number): string {
  const map: Record<number, string> = {
    1: "bg-red-500",
    2: "bg-orange-500",
    3: "bg-yellow-500",
    4: "bg-blue-500",
    5: "bg-green-500",
  };
  return map[level] ?? "bg-muted";
}
