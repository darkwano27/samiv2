export function PasswordRequirements() {
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      <li>Mínimo 8 caracteres</li>
      <li>Al menos una mayúscula</li>
      <li>Al menos un número</li>
    </ul>
  );
}
