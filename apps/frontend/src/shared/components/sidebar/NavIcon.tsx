import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BedDouble,
  Circle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  DoorOpen,
  FileClock,
  FileHeart,
  FlaskConical,
  Globe,
  Heart,
  Laptop,
  LayoutDashboard,
  Link,
  Mail,
  Monitor,
  PenLine,
  PackageCheck,
  Pill,
  Settings,
  Shield,
  Stethoscope,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Clock,
  FileClock,
  UserCog,
  Heart,
  Stethoscope,
  ClipboardList,
  ClipboardCheck,
  BedDouble,
  Pill,
  FileHeart,
  BarChart3,
  DoorOpen,
  UserPlus,
  Globe,
  FlaskConical,
  LayoutDashboard,
  Monitor,
  Laptop,
  TrendingUp,
  PackageCheck,
  Settings,
  Users,
  Shield,
  Link,
  Mail,
  PenLine,
};

type Props = {
  name: string;
  className?: string;
};

export function NavIcon({ name, className }: Props) {
  const Icon = ICONS[name] ?? Circle;
  return <Icon className={className} aria-hidden />;
}
