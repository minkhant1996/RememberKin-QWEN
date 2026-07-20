import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Props {
  confidence: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'semantic' | 'procedural';
}

export default function ConfidenceBar({
  confidence,
  showLabel = true,
  size = 'md',
  variant = 'default'
}: Props) {
  const percentage = Math.round(confidence * 100);

  const getIndicatorColor = () => {
    if (variant === 'semantic') return 'bg-memory-semantic';
    if (variant === 'procedural') return 'bg-memory-procedural';

    // Default gradient based on confidence
    if (confidence >= 0.8) return 'bg-memory-semantic';
    if (confidence >= 0.6) return 'bg-memory-working';
    if (confidence >= 0.4) return 'bg-primary';
    return 'bg-destructive';
  };

  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="flex items-center space-x-2">
      <Progress
        value={percentage}
        className={cn('flex-1', heights[size])}
        indicatorClassName={getIndicatorColor()}
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground font-medium w-10 text-right">
          {percentage}%
        </span>
      )}
    </div>
  );
}
