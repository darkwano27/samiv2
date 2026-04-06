import { SoEmailSettingsTab } from '@/modules/salud-ocupacional/ajustes/components/SoEmailSettingsTab';

/**
 * Ajustes globales de Administración (superadmin): SMTP `module_slug=system`, etc.
 */
export function AdminAjustesPage() {
  return (
    <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 p-3 sm:gap-6 sm:p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          Ajustes — Administración
        </h1>
        <p className="text-sm text-muted-foreground">
          Configuración del correo del sistema (recuperación de contraseña y avisos globales).
        </p>
      </header>
      <SoEmailSettingsTab variant="admin" />
    </div>
  );
}
