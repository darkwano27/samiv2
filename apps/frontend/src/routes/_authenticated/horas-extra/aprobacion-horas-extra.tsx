import { createFileRoute } from '@tanstack/react-router';
import { ClipboardCheck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { assertAppAccess } from '@/shared/routing/authenticated-guards';

export const Route = createFileRoute('/_authenticated/horas-extra/aprobacion-horas-extra')({
  beforeLoad: ({ context }) => {
    assertAppAccess(context.session, 'aprobacion-horas-extra');
  },
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8 text-primary" aria-hidden />
            <CardTitle className="font-heading text-xl">Aprobación de horas extra</CardTitle>
          </div>
          <CardDescription>Bandeja de boletas y aprobaciones (próximamente).</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Acá verán los aprobadores las boletas pendientes y podrán aprobarlas. El flujo completo se
          implementa en la siguiente entrega.
        </CardContent>
      </Card>
    </div>
  );
}
