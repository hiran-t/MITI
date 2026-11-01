import { Puzzle } from 'lucide-react';
import { usePanel } from '@/panels';

/** The icon a panel type is registered with; a widget's panel without one gets a puzzle piece. */
export default function PanelIcon({ type }: { type: string }) {
  const Icon = usePanel(type)?.icon ?? Puzzle;
  return <Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />;
}
