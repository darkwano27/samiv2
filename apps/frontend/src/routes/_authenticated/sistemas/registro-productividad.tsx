import { createFileRoute } from '@tanstack/react-router';
import { PauseCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const Route = createFileRoute('/_authenticated/sistemas/registro-productividad')({
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PauseCircle className="h-8 w-8 text-muted-foreground" aria-hidden />
            <CardTitle className="font-heading text-xl">Registro de productividad</CardTitle>
          </div>
          <CardDescription>Módulo en pausa</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Esta aplicación no está disponible por ahora. Volvé al tablero o usá otras opciones del módulo
          Sistemas.
        </CardContent>
      </Card>
    </div>
  );
}
