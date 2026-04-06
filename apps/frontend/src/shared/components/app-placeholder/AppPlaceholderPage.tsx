type Props = {
  title: string;
  description: string;
};

export function AppPlaceholderPage({ title, description }: Props) {
  return (
    <div className="p-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      <p className="mt-6 text-sm font-medium text-muted-foreground">Módulo en desarrollo</p>
    </div>
  );
}
