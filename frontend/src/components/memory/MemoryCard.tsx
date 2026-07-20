import { formatDistanceToNow } from 'date-fns';
import { User, Brain, Lightbulb, Repeat } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ConfidenceBar from './ConfidenceBar';

interface Props {
  fact: string;
  aboutName?: string;
  confidence: number;
  type?: 'working' | 'episodic' | 'semantic' | 'procedural';
  reinforcementCount?: number;
  factType?: string;
  timestamp?: string;
  decayFactor?: number;
  onClick?: () => void;
}

const typeIcons = {
  working: Brain,
  episodic: Lightbulb,
  semantic: User,
  procedural: Repeat,
};

const factTypeBadges: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  preference: { label: 'Preference', variant: 'default' },
  trait: { label: 'Trait', variant: 'secondary' },
  biographical: { label: 'Bio', variant: 'outline' },
  relationship: { label: 'Relationship', variant: 'default' },
  routine: { label: 'Routine', variant: 'secondary' },
  opinion: { label: 'Opinion', variant: 'outline' },
};

export default function MemoryCard({
  fact,
  aboutName,
  confidence,
  type = 'semantic',
  reinforcementCount,
  factType,
  timestamp,
  decayFactor,
  onClick,
}: Props) {
  const Icon = typeIcons[type];
  const badge = factType ? factTypeBadges[factType] : null;
  const colorVar = `--memory-${type}`;

  return (
    <Card
      className={cn(
        'p-4 border-2 transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md'
      )}
      style={{
        borderColor: `hsl(var(${colorVar}) / 0.3)`,
        backgroundColor: `hsl(var(${colorVar}) / 0.03)`,
      }}
      onClick={onClick}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div
            className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm"
            style={{ color: `hsl(var(${colorVar}))` }}
          >
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {/* About person */}
          {aboutName && (
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-sm font-medium text-foreground">{aboutName}</span>
              {badge && (
                <Badge variant={badge.variant} className="text-xs">
                  {badge.label}
                </Badge>
              )}
            </div>
          )}

          {/* Fact */}
          <p className="text-foreground">{fact}</p>

          {/* Metadata */}
          <div className="mt-3 flex items-center space-x-4">
            <div className="flex-1">
              <ConfidenceBar
                confidence={confidence}
                size="sm"
                variant={type === 'semantic' ? 'semantic' : type === 'procedural' ? 'procedural' : 'default'}
              />
            </div>
            {reinforcementCount && reinforcementCount > 1 && (
              <span className="text-xs text-muted-foreground flex items-center">
                <Repeat className="w-3 h-3 mr-1" />
                {reinforcementCount}x
              </span>
            )}
            {decayFactor !== undefined && decayFactor < 1 && (
              <span className="text-xs text-destructive flex items-center">
                ↓ {Math.round(decayFactor * 100)}%
              </span>
            )}
            {timestamp && (
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
