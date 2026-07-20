import { formatDistanceToNow } from 'date-fns';
import { Cog, Zap, RefreshCw, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProceduralMemory, PatternType } from '../../types';
import ConfidenceBar from './ConfidenceBar';

interface Props {
  patterns: ProceduralMemory[];
}

const patternTypeConfig: Record<PatternType, { icon: typeof Cog; label: string }> = {
  routine: {
    icon: RefreshCw,
    label: 'Routine',
  },
  preference_cluster: {
    icon: User,
    label: 'Preferences',
  },
  interaction_style: {
    icon: Zap,
    label: 'Style',
  },
  trigger_response: {
    icon: Cog,
    label: 'Trigger',
  },
};

export default function ProceduralMemoryList({ patterns }: Props) {
  const safePatterns = patterns ?? [];

  if (safePatterns.length === 0) {
    return (
      <div className="text-center py-12">
        <div
          className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
          style={{ backgroundColor: 'hsl(var(--memory-procedural) / 0.1)' }}
        >
          <Cog className="w-6 h-6" style={{ color: 'hsl(var(--memory-procedural))' }} />
        </div>
        <p className="font-medium text-foreground">No Patterns Detected Yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          The system will learn patterns from your conversations over time
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-4 pr-4">
        {safePatterns.map((pattern) => {
          const config = patternTypeConfig[pattern.patternType] ?? patternTypeConfig.routine;
          const Icon = config.icon;
          const createdAt = pattern.createdAt ? new Date(pattern.createdAt) : null;
          const appliesToIds = pattern.appliesToIds ?? [];

          return (
            <Card
              key={pattern.id}
              className="border-2 animate-fade-in-up"
              style={{
                borderColor: 'hsl(var(--memory-procedural) / 0.3)',
                backgroundColor: 'hsl(var(--memory-procedural) / 0.03)',
              }}
            >
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span
                      className="p-1.5 rounded-full"
                      style={{
                        backgroundColor: 'hsl(var(--memory-procedural) / 0.15)',
                        color: 'hsl(var(--memory-procedural))',
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="font-medium text-foreground">{pattern.name}</span>
                    <Badge variant="procedural" className="text-xs">
                      {config.label}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {createdAt && !Number.isNaN(createdAt.getTime())
                      ? formatDistanceToNow(createdAt, { addSuffix: true })
                      : 'Unknown date'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-foreground mb-3">{pattern.description}</p>

                {/* Trigger & Action */}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="p-3 bg-background rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Trigger</p>
                    <p className="text-sm text-foreground">{pattern.trigger}</p>
                  </div>
                  <div className="p-3 bg-background rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Action</p>
                    <p className="text-sm text-foreground">{pattern.action}</p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <span>Confidence:</span>
                    <div className="w-20">
                      <ConfidenceBar confidence={pattern.confidence} showLabel={true} size="sm" variant="procedural" />
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {pattern.frequency}x frequency
                  </Badge>
                  {appliesToIds.length > 0 && (
                    <span>
                      Applies to {appliesToIds.length} person(s)
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
