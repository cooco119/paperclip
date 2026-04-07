import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { delegationApi } from "../api/delegation";
import { queryKeys } from "../lib/queryKeys";
import { DELEGATION_SCOPES } from "@paperclipai/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Agent {
  id: string;
  name: string;
}

export function NewDelegationSessionDialog({
  companyId,
  agents,
  onClose,
}: {
  companyId: string;
  agents: Agent[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [scope, setScope] = useState("all");
  const [proposedLevel, setProposedLevel] = useState<number | undefined>(undefined);

  const createMutation = useMutation({
    mutationFn: () =>
      delegationApi.createSession(companyId, {
        agentId,
        scope,
        proposedLevel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delegation.sessions(companyId) });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Delegation Poker Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (global)</SelectItem>
                {DELEGATION_SCOPES.filter((s) => s !== "all").map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Proposed Level (optional)</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => setProposedLevel(proposedLevel === level ? undefined : level)}
                  className={`w-10 h-10 rounded-lg text-sm font-bold transition-all border-2 ${
                    proposedLevel === level
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {createMutation.error && (
            <p className="text-sm text-destructive">
              {createMutation.error instanceof Error ? createMutation.error.message : "Failed to create session"}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!agentId || createMutation.isPending}
            >
              {createMutation.isPending ? "Starting..." : "Start Session"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
