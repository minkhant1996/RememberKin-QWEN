import { Brain, Clock, Tag, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { WorkingMemoryState } from '../../types';
import ConfidenceBar from './ConfidenceBar';

interface Props {
  workingMemory: WorkingMemoryState | null;
}

export default function WorkingMemoryList({ workingMemory }: Props) {
  const pendingFacts = workingMemory?.pendingFacts ?? [];
  const activeEntities = workingMemory?.activeEntities ?? [];
  const currentTopics = workingMemory?.currentTopics ?? [];

  if (pendingFacts.length === 0 && activeEntities.length === 0) {
    return (
      <div className="text-center py-12">
        <div
          className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
          style={{ backgroundColor: 'hsl(var(--memory-working) / 0.1)' }}
        >
          <Brain className="w-6 h-6" style={{ color: 'hsl(var(--memory-working))' }} />
        </div>
        <p className="font-medium text-foreground">Working Memory Empty</p>
        <p className="text-sm text-muted-foreground mt-1">
          Start a conversation to see extracted facts here
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-6 pr-4">
        {/* Pending Facts */}
        {pendingFacts.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Clock className="w-4 h-4" style={{ color: 'hsl(var(--memory-working))' }} />
              <h3 className="text-sm font-semibold text-foreground">
                Pending Facts ({pendingFacts.length})
              </h3>
            </div>
            <div className="space-y-3">
              {pendingFacts.map((fact) => (
                <Card
                  key={fact.id}
                  className="border-2 animate-fade-in-up"
                  style={{
                    borderColor: 'hsl(var(--memory-working) / 0.3)',
                    backgroundColor: 'hsl(var(--memory-working) / 0.05)',
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <User className="w-4 h-4" style={{ color: 'hsl(var(--memory-working))' }} />
                          <span className="text-sm font-medium" style={{ color: 'hsl(var(--memory-working))' }}>
                            {fact.aboutName}
                          </span>
                          <Badge variant="working" className="text-xs">
                            Pending
                          </Badge>
                        </div>
                        <p className="text-foreground">{fact.fact}</p>
                        <div className="mt-3 flex items-center space-x-4">
                          <div className="w-32">
                            <ConfidenceBar confidence={fact.confidence} size="sm" />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            from {fact.extractedFrom}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(fact.extractedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {pendingFacts.length > 0 && activeEntities.length > 0 && (
          <Separator />
        )}

        {/* Active Entities */}
        {activeEntities.length > 0 && (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Tag className="w-4 h-4" style={{ color: 'hsl(var(--memory-working))' }} />
              <h3 className="text-sm font-semibold text-foreground">
                Active Entities ({activeEntities.length})
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeEntities.map((entity) => (
                <Badge
                  key={entity.id}
                  variant="outline"
                  className="px-3 py-2 text-sm"
                >
                  <span className="font-medium">{entity.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {entity.type}
                  </span>
                  {entity.mentionCount > 1 && (
                    <span className="ml-2 text-xs" style={{ color: 'hsl(var(--memory-working))' }}>
                      {entity.mentionCount}x
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Current Topics */}
        {currentTopics.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Current Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {currentTopics.map((topic, i) => (
                  <Badge
                    key={i}
                    variant="working"
                    className="text-sm"
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
