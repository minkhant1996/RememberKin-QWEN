import { Brain, Lightbulb, Database, Cog } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MemoryLayer } from '../../types';

interface Props {
  selectedLayer: MemoryLayer;
  onSelectLayer: (layer: MemoryLayer) => void;
}

const tabs = [
  { key: 'working' as const, label: 'Working', icon: Brain, colorVar: '--memory-working' },
  { key: 'episodic' as const, label: 'Episodic', icon: Lightbulb, colorVar: '--memory-episodic' },
  { key: 'semantic' as const, label: 'Semantic', icon: Database, colorVar: '--memory-semantic' },
  { key: 'procedural' as const, label: 'Procedural', icon: Cog, colorVar: '--memory-procedural' },
];

export default function MemoryLayerTabs({ selectedLayer, onSelectLayer }: Props) {
  return (
    <Tabs value={selectedLayer} onValueChange={(v) => onSelectLayer(v as MemoryLayer)}>
      <TabsList className="w-full justify-start bg-muted/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedLayer === tab.key;

          return (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="flex-1 data-[state=active]:shadow-sm"
              style={isSelected ? {
                color: `hsl(var(${tab.colorVar}))`,
                borderBottomColor: `hsl(var(${tab.colorVar}))`,
              } : undefined}
            >
              <Icon className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
