import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import type { UsageInfo, UsageSummary } from '../../types';

interface UsageDisplayProps {
  usage: UsageInfo;
  compact?: boolean;
}

export function UsageDisplay({ usage, compact = false }: UsageDisplayProps) {
  const formatCost = (cost: number) => {
    if (cost === 0) return '$0.00';
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return tokens.toString();
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{formatTokens(usage.tokenUsage.total)} tokens</span>
              <span>|</span>
              <span>{formatCost(usage.costEstimate.totalCost)}</span>
              <span>|</span>
              <span>{usage.latencyMs}ms</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1.5 text-xs">
              <p className="font-medium">Model: {usage.model || usage.models?.join(', ')}</p>
              <div className="grid grid-cols-2 gap-x-4">
                <span>Input tokens:</span>
                <span>{usage.tokenUsage.input}</span>
                <span>Output tokens:</span>
                <span>{usage.tokenUsage.output}</span>
                <span>Input cost:</span>
                <span>{formatCost(usage.costEstimate.inputCost)}</span>
                <span>Output cost:</span>
                <span>{formatCost(usage.costEstimate.outputCost)}</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>API Usage</span>
          <Badge variant="outline" className="text-xs">
            {usage.model || usage.models?.join(', ')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">{formatTokens(usage.tokenUsage.total)}</p>
            <p className="text-xs text-muted-foreground">Total Tokens</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{formatCost(usage.costEstimate.totalCost)}</p>
            <p className="text-xs text-muted-foreground">Cost</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{usage.latencyMs}ms</p>
            <p className="text-xs text-muted-foreground">Latency</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Input: {formatTokens(usage.tokenUsage.input)}</span>
            <span className="text-muted-foreground">Output: {formatTokens(usage.tokenUsage.output)}</span>
          </div>
          <Progress
            value={(usage.tokenUsage.input / usage.tokenUsage.total) * 100}
            className="h-1.5"
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface UsageSummaryDisplayProps {
  summary: UsageSummary;
}

export function UsageSummaryDisplay({ summary }: UsageSummaryDisplayProps) {
  const formatCost = (cost: number) => {
    if (cost === 0) return '$0.00';
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return tokens.toString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Session Usage Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{summary.requests}</p>
            <p className="text-xs text-muted-foreground">Requests</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-primary">{formatTokens(summary.totalTokens)}</p>
            <p className="text-xs text-muted-foreground">Total Tokens</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-green-600">{formatCost(summary.totalCost)}</p>
            <p className="text-xs text-muted-foreground">Total Cost</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-blue-600">
              {summary.requests > 0 ? formatTokens(Math.round(summary.totalTokens / summary.requests)) : '0'}
            </p>
            <p className="text-xs text-muted-foreground">Avg Tokens/Req</p>
          </div>
        </div>

        {Object.keys(summary.byModel).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">By Model</p>
            <div className="space-y-2">
              {Object.entries(summary.byModel).map(([model, stats]) => (
                <div key={model} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{model}</Badge>
                    <span className="text-muted-foreground">{stats.requests} requests</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span>{formatTokens(stats.input + stats.output)} tokens</span>
                    <span className="text-green-600 font-medium">{formatCost(stats.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UsageDisplay;
