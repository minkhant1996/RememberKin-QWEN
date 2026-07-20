import { formatDistanceToNow } from 'date-fns';
import {
  ArrowRight,
  Sparkles,
  RefreshCw,
  TrendingDown,
  Eye,
  Zap,
  Plus,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MemoryActivity } from '../../types';

interface Props {
  activities: MemoryActivity[];
  maxItems?: number;
}

const activityConfig = {
  extracted: {
    icon: Plus,
    variant: 'working' as const,
    label: 'Extracted',
  },
  episode_created: {
    icon: Sparkles,
    variant: 'episodic' as const,
    label: 'Episode',
  },
  consolidated: {
    icon: ArrowRight,
    variant: 'semantic' as const,
    label: 'Consolidated',
  },
  reinforced: {
    icon: RefreshCw,
    variant: 'semantic' as const,
    label: 'Reinforced',
  },
  decayed: {
    icon: TrendingDown,
    variant: 'destructive' as const,
    label: 'Decayed',
  },
  pattern_detected: {
    icon: Zap,
    variant: 'procedural' as const,
    label: 'Pattern',
  },
  memory_recalled: {
    icon: Eye,
    variant: 'episodic' as const,
    label: 'Recalled',
  },
};

export default function MemoryActivityFeed({ activities, maxItems = 10 }: Props) {
  const displayActivities = activities ?? [];

  if (displayActivities.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No activity yet</p>
        <p className="text-sm text-muted-foreground/70">Start a conversation to see memory activity</p>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2 pr-4">
        {displayActivities.slice(0, maxItems).map((activity) => {
          const config = activityConfig[activity.type] ?? activityConfig.extracted;
          const Icon = config.icon;
          const timestamp = activity.timestamp ? new Date(activity.timestamp) : null;

          return (
            <div
              key={activity.id}
              className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors animate-fade-in-up"
            >
              <div
                className="p-1.5 rounded-full"
                style={{ backgroundColor: `hsl(var(--memory-${config.variant === 'destructive' ? 'working' : config.variant}) / 0.15)` }}
              >
                <Icon
                  className="w-4 h-4"
                  style={{ color: `hsl(var(--memory-${config.variant === 'destructive' ? 'working' : config.variant}))` }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge variant={config.variant} className="text-xs">
                    {config.label}
                  </Badge>
                  {activity.fromLayer && activity.toLayer && (
                    <span className="text-xs text-muted-foreground">
                      {activity.fromLayer} → {activity.toLayer}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground/70 ml-auto">
                    {timestamp && !Number.isNaN(timestamp.getTime())
                      ? formatDistanceToNow(timestamp, { addSuffix: true })
                      : ''}
                  </span>
                </div>
                <p className="text-sm text-foreground mt-1 break-words">{activity.description}</p>
                {activity.confidence !== undefined && activity.confidence !== null && (
                  <span className="text-xs text-muted-foreground">
                    Confidence: {Math.round(activity.confidence * 100)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
