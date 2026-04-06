import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ModuleSummaryItem } from '@/modules/admin/types/modules-summary.types';
import { cn } from '@/lib/utils';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
}

function formatRoleSummaryLines(mod: ModuleSummaryItem): string {
  if (mod.role_summary.length === 0) {
    return '0 workers con roles en este módulo';
  }
  return mod.role_summary
    .map((r) => `${r.worker_count} ${r.role_label.toLowerCase()}`)
    .join(', ');
}

type Props = {
  module: ModuleSummaryItem;
  onAssignAdmin?: () => void;
  assignDisabled?: boolean;
  assignDisabledTitle?: string;
  onRevokeAdmin?: (assignmentId: string, displayName: string) => void;
  revokeDisabled?: boolean;
};

export function ModuleAdminCard({
  module: mod,
  onAssignAdmin,
  assignDisabled,
  assignDisabledTitle,
  onRevokeAdmin,
  revokeDisabled,
}: Props) {
  return (
    <Card className="h-full shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 border-b border-border/60 pb-3">
        <CardTitle className="text-base font-semibold leading-tight">
          {mod.module_label}
        </CardTitle>
        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
          {mod.app_count} apps
        </span>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Admins del módulo
        </p>
        {mod.admins.length === 0 ? (
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Sin admin asignado
          </p>
        ) : (
          <ul className="space-y-3">
            {mod.admins.map((a) => (
              <li key={a.assignment_id} className="flex gap-3">
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                    'bg-primary/15 text-xs font-semibold text-primary',
                  )}
                  aria-hidden
                >
                  {initialsFromName(a.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.sap_code} — {a.scope}
                  </p>
                  {onRevokeAdmin ? (
                    <button
                      type="button"
                      disabled={revokeDisabled}
                      className="mt-1 text-xs font-medium text-destructive underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
                      onClick={() =>
                        onRevokeAdmin(String(a.assignment_id).trim(), a.name)
                      }
                    >
                      Quitar como admin
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {onAssignAdmin ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={assignDisabled}
            title={assignDisabled ? assignDisabledTitle : undefined}
            onClick={onAssignAdmin}
          >
            Asignar admin del módulo
          </Button>
        ) : null}
      </CardContent>
      <CardFooter className="border-t border-border/60 text-xs text-muted-foreground">
        {formatRoleSummaryLines(mod)}
      </CardFooter>
    </Card>
  );
}
