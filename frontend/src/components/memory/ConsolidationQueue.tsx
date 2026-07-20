import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConsolidationCandidate } from '../../types';
import ConfidenceBar from './ConfidenceBar';

interface Props {
  candidates: ConsolidationCandidate[];
  onConsolidate: () => void;
  isConsolidating: boolean;
}

export default function ConsolidationQueue({ candidates, onConsolidate, isConsolidating }: Props) {
  if (candidates.length === 0) {
    return (
      <Card className="border-2 border-dashed border-muted">
        <CardContent className="py-8 text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No facts pending consolidation</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="border-2"
      style={{
        borderColor: 'hsl(var(--memory-semantic) / 0.5)',
        backgroundColor: 'hsl(var(--memory-semantic) / 0.03)',
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div>
            <CardTitle className="text-lg" style={{ color: 'hsl(var(--memory-semantic))' }}>
              Consolidation Queue
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {candidates.length} fact{candidates.length !== 1 ? 's' : ''} ready to consolidate
            </p>
          </div>
          <Button
            onClick={onConsolidate}
            disabled={isConsolidating}
            variant="semantic"
            className="gap-2 w-full"
          >
            {isConsolidating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Consolidating...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                Consolidate Now
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="space-y-2 pr-4">
            {candidates.slice(0, 5).map((candidate) => (
              <div
                key={candidate.episodeId}
                className="p-3 bg-background rounded-lg border animate-fade-in-up"
              >
                <div className="flex flex-col gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {candidate.aboutName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {candidate.mentionCount} mention{candidate.mentionCount !== 1 ? 's' : ''}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {candidate.factType}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">{candidate.fact}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground shrink-0">Suggested</p>
                    <div className="w-24">
                      <ConfidenceBar confidence={candidate.suggestedConfidence} size="sm" variant="semantic" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {candidates.length > 5 && (
              <p className="text-center text-sm text-muted-foreground pt-2">
                +{candidates.length - 5} more facts
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
