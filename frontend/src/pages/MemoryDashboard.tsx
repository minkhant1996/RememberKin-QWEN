import { useEffect, useCallback } from 'react';
import { RefreshCw, Zap, TrendingDown, Loader2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useMemoryStore } from '../store/memoryStore';
import { memoryDashboardService } from '../services/memory-dashboard.service';
import {
  MemoryStats,
  MemoryActivityFeed,
  MemoryLayerTabs,
  WorkingMemoryList,
  EpisodicMemoryList,
  SemanticMemoryList,
  ProceduralMemoryList,
  ConsolidationQueue,
} from '../components/memory';

export default function MemoryDashboard() {
  const {
    stats,
    activity,
    workingMemory,
    episodicMemories,
    semanticMemories,
    proceduralMemories,
    consolidationQueue,
    selectedLayer,
    isLoading,
    isConsolidating,
    isDetectingPatterns,
    error,
    setStats,
    setActivity,
    setWorkingMemory,
    setEpisodicMemories,
    setSemanticMemories,
    setProceduralMemories,
    setConsolidationQueue,
    setSelectedLayer,
    setLoading,
    setConsolidating,
    setDetectingPatterns,
    setError,
  } = useMemoryStore();

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsData, activityData, workingData, queueData] = await Promise.all([
        memoryDashboardService.getStats(),
        memoryDashboardService.getActivity(20),
        memoryDashboardService.getWorking(),
        memoryDashboardService.getConsolidationQueue(),
      ]);

      setStats(statsData);
      setActivity(activityData.activities);
      setWorkingMemory(workingData);
      setConsolidationQueue(queueData.candidates);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [setStats, setActivity, setWorkingMemory, setConsolidationQueue, setLoading, setError]);

  // Fetch layer-specific data
  const fetchLayerData = useCallback(async (layer: typeof selectedLayer) => {
    try {
      switch (layer) {
        case 'working':
          const workingData = await memoryDashboardService.getWorking();
          setWorkingMemory(workingData);
          break;
        case 'episodic':
          const episodicData = await memoryDashboardService.getEpisodic({ limit: 20 });
          setEpisodicMemories(episodicData.memories);
          break;
        case 'semantic':
          const semanticData = await memoryDashboardService.getSemantic({ limit: 50 });
          setSemanticMemories(semanticData.memories);
          break;
        case 'procedural':
          const proceduralData = await memoryDashboardService.getProcedural();
          setProceduralMemories(proceduralData.patterns);
          break;
      }
    } catch (err) {
      console.error('Failed to fetch layer data:', err);
    }
  }, [setWorkingMemory, setEpisodicMemories, setSemanticMemories, setProceduralMemories]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch layer data when layer changes
  useEffect(() => {
    fetchLayerData(selectedLayer);
  }, [selectedLayer, fetchLayerData]);

  // Handle consolidation
  const handleConsolidate = async () => {
    setConsolidating(true);
    try {
      await memoryDashboardService.consolidate();
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConsolidating(false);
    }
  };

  // Handle pattern detection
  const handleDetectPatterns = async () => {
    setDetectingPatterns(true);
    try {
      await memoryDashboardService.detectPatterns();
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDetectingPatterns(false);
    }
  };

  // Handle memory decay
  const handleApplyDecay = async () => {
    try {
      await memoryDashboardService.applyDecay(0.05);
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Render layer content
  const renderLayerContent = () => {
    switch (selectedLayer) {
      case 'working':
        return <WorkingMemoryList workingMemory={workingMemory} />;
      case 'episodic':
        return <EpisodicMemoryList memories={episodicMemories} />;
      case 'semantic':
        return <SemanticMemoryList memories={semanticMemories} groupByPerson={true} />;
      case 'procedural':
        return <ProceduralMemoryList patterns={proceduralMemories} />;
      default:
        return null;
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading memory system...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'hsl(var(--primary) / 0.1)' }}
            >
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Memory Dashboard</h1>
              <p className="text-muted-foreground text-sm">
                4-layer cognitive memory system
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleApplyDecay}
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <TrendingDown className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Decay</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Apply memory decay (reduce old memory confidence)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleDetectPatterns}
                  disabled={isDetectingPatterns}
                  variant="procedural"
                  size="sm"
                >
                  {isDetectingPatterns ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-1" />
                  )}
                  <span className="hidden sm:inline">Patterns</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Detect behavioral patterns from episodes</p>
              </TooltipContent>
            </Tooltip>

            <Button
              onClick={fetchData}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="py-3">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <MemoryStats
          stats={stats}
          selectedLayer={selectedLayer}
          onSelectLayer={setSelectedLayer}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Layer Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Layer Tabs */}
            <MemoryLayerTabs
              selectedLayer={selectedLayer}
              onSelectLayer={setSelectedLayer}
            />

            {/* Layer Content */}
            <Card className="min-h-[500px]">
              <CardContent className="p-6">
                {renderLayerContent()}
              </CardContent>
            </Card>
          </div>

          {/* Right: Activity & Consolidation */}
          <div className="space-y-6">
            {/* Consolidation Queue */}
            <ConsolidationQueue
              candidates={consolidationQueue}
              onConsolidate={handleConsolidate}
              isConsolidating={isConsolidating}
            />

            {/* Activity Feed */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Live Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <MemoryActivityFeed activities={activity} maxItems={10} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
