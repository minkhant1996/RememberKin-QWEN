import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, BookOpen, Calendar, Eye, Check, Lightbulb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EpisodicMemory, EpisodicEventType } from '../../types';
import ConfidenceBar from './ConfidenceBar';

interface Props {
  memories: EpisodicMemory[];
  onAccessMemory?: (id: string) => void;
}

const eventTypeConfig: Record<EpisodicEventType, { icon: typeof MessageSquare; label: string }> = {
  conversation: {
    icon: MessageSquare,
    label: 'Conversation',
  },
  story_added: {
    icon: BookOpen,
    label: 'Story',
  },
  event_created: {
    icon: Calendar,
    label: 'Event',
  },
  memory_recalled: {
    icon: Eye,
    label: 'Recall',
  },
};

export default function EpisodicMemoryList({ memories, onAccessMemory }: Props) {
  const safeMemories = memories ?? [];

  if (safeMemories.length === 0) {
    return (
      <div className="text-center py-12">
        <div
          className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
          style={{ backgroundColor: 'hsl(var(--memory-episodic) / 0.1)' }}
        >
          <Lightbulb className="w-6 h-6" style={{ color: 'hsl(var(--memory-episodic))' }} />
        </div>
        <p className="font-medium text-foreground">No Episodes Yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Conversations and events will appear here as episodes
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-4 pr-4">
        {safeMemories.map((memory) => {
          const config = eventTypeConfig[memory.eventType] ?? eventTypeConfig.conversation;
          const Icon = config.icon;
          const extractedFacts = memory.extractedFacts ?? [];
          const participants = memory.participants ?? [];
          const createdAt = memory.createdAt ? new Date(memory.createdAt) : null;

          return (
            <Card
              key={memory.id}
              onClick={() => onAccessMemory?.(memory.id)}
              className="border-2 transition-all duration-200 animate-fade-in-up"
              style={{
                borderColor: 'hsl(var(--memory-episodic) / 0.3)',
                backgroundColor: 'hsl(var(--memory-episodic) / 0.03)',
                cursor: onAccessMemory ? 'pointer' : undefined,
              }}
            >
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span
                      className="p-1.5 rounded-full"
                      style={{
                        backgroundColor: 'hsl(var(--memory-episodic) / 0.15)',
                        color: 'hsl(var(--memory-episodic))',
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <Badge variant="episodic" className="text-xs">
                      {config.label}
                    </Badge>
                    {memory.consolidated && (
                      <Badge variant="semantic" className="text-xs flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Consolidated
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {createdAt && !Number.isNaN(createdAt.getTime())
                      ? formatDistanceToNow(createdAt, { addSuffix: true })
                      : 'Unknown date'}
                  </span>
                </div>

                {/* Content Preview */}
                <p className="text-foreground line-clamp-2 mb-3">
                  {memory.summary || memory.content?.slice(0, 150) || 'No content available'}
                </p>

                {/* Extracted Facts */}
                {extractedFacts.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1">Extracted facts:</p>
                    <div className="flex flex-wrap gap-1">
                      {extractedFacts.slice(0, 3).map((fact, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-normal">
                          {fact.length > 50 ? fact.slice(0, 50) + '...' : fact}
                        </Badge>
                      ))}
                      {extractedFacts.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{extractedFacts.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <span>Importance:</span>
                    <div className="w-16">
                      <ConfidenceBar confidence={memory.importance} showLabel={false} size="sm" />
                    </div>
                  </div>
                  <span>Views: {memory.accessCount ?? 0}</span>
                  {participants.length > 0 && (
                    <span>{participants.length} participant(s)</span>
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
