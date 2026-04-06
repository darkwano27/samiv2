import { createFileRoute } from '@tanstack/react-router';
import { MiFirmaView } from '@/modules/auth/views/MiFirmaView';

export const Route = createFileRoute('/_authenticated/mi-firma')({
  component: MiFirmaView,
});
