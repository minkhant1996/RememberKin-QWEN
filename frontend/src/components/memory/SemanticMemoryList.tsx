import { Database } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SemanticMemory } from '../../types';
import MemoryCard from './MemoryCard';

interface Props {
  memories: SemanticMemory[];
  byPerson?: Record<string, SemanticMemory[]>;
  groupByPerson?: boolean;
}

export default function SemanticMemoryList({ memories, byPerson, groupByPerson = true }: Props) {
  const safeMemories = memories ?? [];

  if (safeMemories.length === 0) {
    return (
      <div className="text-center py-12">
        <div
          className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
          style={{ backgroundColor: 'hsl(var(--memory-semantic) / 0.1)' }}
        >
          <Database className="w-6 h-6" style={{ color: 'hsl(var(--memory-semantic))' }} />
        </div>
        <p className="font-medium text-foreground">No Long-term Facts Yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Consolidated facts from conversations will appear here
        </p>
      </div>
    );
  }

  // Group memories by person if not already grouped
  const groupedMemories = byPerson || safeMemories.reduce((acc, memory) => {
    const key = memory.aboutId;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(memory);
    return acc;
  }, {} as Record<string, SemanticMemory[]>);

  // If grouped by person
  if (groupByPerson && Object.keys(groupedMemories).length > 0) {
    return (
      <ScrollArea className="h-[500px]">
        <div className="space-y-6 pr-4">
          {Object.entries(groupedMemories).map(([personId, personMemories], index) => {
            const firstName = personMemories[0]?.aboutName || 'Unknown';
            const initials = firstName.split(' ').map(n => n[0]).join('').toUpperCase();

            return (
              <div key={personId}>
                {index > 0 && <Separator className="mb-6" />}

                {/* Person Header */}
                <div className="flex items-center space-x-3 mb-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback
                      style={{
                        backgroundColor: 'hsl(var(--memory-semantic) / 0.15)',
                        color: 'hsl(var(--memory-semantic))',
                      }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground">{firstName}</h3>
                    <div className="flex items-center space-x-2">
                      <Badge variant="semantic" className="text-xs">
                        {personMemories.length} fact{personMemories.length !== 1 ? 's' : ''}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Avg confidence: {Math.round(
                          personMemories.reduce((sum, m) => sum + m.confidence, 0) / personMemories.length * 100
                        )}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Facts for this person */}
                <div
                  className="space-y-2 pl-4 border-l-2"
                  style={{ borderColor: 'hsl(var(--memory-semantic) / 0.3)' }}
                >
                  {personMemories.map((memory) => (
                    <MemoryCard
                      key={memory.id}
                      fact={memory.fact}
                      confidence={memory.confidence}
                      type="semantic"
                      reinforcementCount={memory.reinforcementCount}
                      factType={memory.factType}
                      timestamp={memory.updatedAt}
                      decayFactor={memory.decayFactor}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    );
  }

  // Flat list
  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-3 pr-4">
        {safeMemories.map((memory) => (
          <MemoryCard
            key={memory.id}
            fact={memory.fact}
            aboutName={memory.aboutName}
            confidence={memory.confidence}
            type="semantic"
            reinforcementCount={memory.reinforcementCount}
            factType={memory.factType}
            timestamp={memory.updatedAt}
            decayFactor={memory.decayFactor}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
