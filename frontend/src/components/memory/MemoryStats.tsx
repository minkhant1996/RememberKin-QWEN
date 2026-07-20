import { Brain, Lightbulb, Database, Cog } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MemoryStats as MemoryStatsType, MemoryLayer } from '../../types';

interface Props {
  stats: MemoryStatsType | null;
  selectedLayer: MemoryLayer;
  onSelectLayer: (layer: MemoryLayer) => void;
}

const layers = [
  {
    key: 'working' as const,
    label: 'Working',
    icon: Brain,
    description: 'Current session',
    colorClass: 'memory-working',
  },
  {
    key: 'episodic' as const,
    label: 'Episodic',
    icon: Lightbulb,
    description: 'Recent episodes',
    colorClass: 'memory-episodic',
  },
  {
    key: 'semantic' as const,
    label: 'Semantic',
    icon: Database,
    description: 'Long-term facts',
    colorClass: 'memory-semantic',
  },
  {
    key: 'procedural' as const,
    label: 'Procedural',
    icon: Cog,
    description: 'Learned patterns',
    colorClass: 'memory-procedural',
  },
];

export default function MemoryStats({ stats, selectedLayer, onSelectLayer }: Props) {
  const getCount = (key: MemoryLayer): number => {
    if (!stats) return 0;
    return stats[key]?.count ?? 0;
  };

  const getSecondaryInfo = (key: MemoryLayer): string => {
    if (!stats) return '';
    switch (key) {
      case 'working':
        return `${stats.working?.pendingFacts ?? 0} pending`;
      case 'episodic':
        return `${stats.episodic?.unconsolidated ?? 0} to consolidate`;
      case 'semantic':
        return `${Math.round((stats.semantic?.avgConfidence ?? 0) * 100)}% avg confidence`;
      case 'procedural':
        return `${Math.round((stats.procedural?.avgConfidence ?? 0) * 100)}% avg confidence`;
      default:
        return '';
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {layers.map((layer) => {
        const isSelected = selectedLayer === layer.key;
        const Icon = layer.icon;
        const count = getCount(layer.key);

        return (
          <Card
            key={layer.key}
            onClick={() => onSelectLayer(layer.key)}
            className={cn(
              'p-4 cursor-pointer transition-all duration-200 hover:shadow-md',
              `border-2 bg-${layer.colorClass}/5`,
              isSelected
                ? `ring-2 ring-${layer.colorClass} border-${layer.colorClass}`
                : `border-${layer.colorClass}/30 hover:border-${layer.colorClass}/60`
            )}
            style={{
              borderColor: isSelected
                ? `hsl(var(--${layer.colorClass}))`
                : `hsl(var(--${layer.colorClass}) / 0.3)`,
              backgroundColor: `hsl(var(--${layer.colorClass}) / 0.05)`,
            }}
          >
            <div className="flex items-center space-x-3">
              <div
                className="p-2 rounded-lg bg-background shadow-sm"
                style={{ color: `hsl(var(--${layer.colorClass}))` }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p
                  className="font-semibold text-sm"
                  style={{ color: `hsl(var(--${layer.colorClass}))` }}
                >
                  {layer.label}
                </p>
                <p className="text-2xl font-bold text-foreground">{count}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-left">
              {getSecondaryInfo(layer.key)}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
