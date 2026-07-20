/**
 * Simulation Dashboard
 *
 * Live simulation of test users interacting with the AI agent.
 * Shows real-time conversation, scoring, and performance metrics.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Square,
  Trash2,
  RefreshCw,
  Bot,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  DollarSign,
  Brain,
  Heart,
  Target,
  MessageCircle,
  Home,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  simulationService,
  SimulationScenario,
  SimulationResult,
  ConversationTurn,
  SimulationSummary,
  SimulationState,
} from '@/services/simulation.service';

export default function SimulationDashboard() {
  // State
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [state, setState] = useState<SimulationState | null>(null);
  const [summary, setSummary] = useState<SimulationSummary | null>(null);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ConversationTurn[]>([]);
  const [currentScenarioName, setCurrentScenarioName] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Connect to SSE and handle events
  useEffect(() => {
    simulationService.connect();
    setIsConnected(true);

    const unsubConnected = simulationService.on('connected', () => {
      setIsConnected(true);
    });

    const unsubState = simulationService.on('state', (data) => {
      setState(data);
    });

    const unsubTurn = simulationService.on('turn', (data) => {
      const { turn, scenarioName } = data;
      setCurrentScenarioName(scenarioName);
      setCurrentConversation(prev => [...prev, turn]);
      scrollToBottom();
    });

    const unsubScenarioComplete = simulationService.on('scenario:complete', (data) => {
      const { result } = data;
      setResults(prev => {
        const existing = prev.findIndex(r => r.id === result.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = result;
          return updated;
        }
        return [...prev, result];
      });
      setCurrentConversation([]);
    });

    const unsubSimulationComplete = simulationService.on('simulation:complete', (data) => {
      setSummary(data.summary);
      setResults(data.results);
      setCurrentConversation([]);
      setCurrentScenarioName('');
      setState(prev => prev ? { ...prev, isRunning: false, isStopping: false } : null);
      setIsLoading(false);
    });

    const unsubSimulationStopped = simulationService.on('simulation:stopped', (data) => {
      setSummary(data.summary);
      setResults(data.results);
      setCurrentConversation([]);
      setCurrentScenarioName('');
      setState(prev => prev ? { ...prev, isRunning: false, isStopping: false } : null);
      setIsLoading(false);
    });

    const unsubStopRequested = simulationService.on('simulation:stop-requested', () => {
      setState(prev => prev ? { ...prev, isStopping: true } : null);
    });

    const unsubCleared = simulationService.on('cleared', () => {
      setResults([]);
      setSummary(null);
      setCurrentConversation([]);
      setCurrentScenarioName('');
    });

    const unsubError = simulationService.on('error', (data) => {
      setError(data.error || 'Connection error');
      setIsConnected(false);
    });

    return () => {
      unsubConnected();
      unsubState();
      unsubTurn();
      unsubScenarioComplete();
      unsubSimulationComplete();
      unsubSimulationStopped();
      unsubStopRequested();
      unsubCleared();
      unsubError();
      simulationService.disconnect();
    };
  }, [scrollToBottom]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [scenariosData, stateData, resultsData] = await Promise.all([
        simulationService.getScenarios(),
        simulationService.getState(),
        simulationService.getResults(),
      ]);
      setScenarios(scenariosData);
      setState(stateData);
      setResults(resultsData.results);
      setSummary(resultsData.summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setCurrentConversation([]);
      setCurrentScenarioName('');
      setSummary(null);
      setResults([]);
      await simulationService.runAll();
      setState(prev => prev ? { ...prev, isRunning: true } : null);
    } catch (err: any) {
      setError(err.message || 'Failed to start simulation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunScenario = async (scenarioId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setCurrentConversation([]);
      setCurrentScenarioName('');
      setSummary(null);
      await simulationService.runScenario(scenarioId);
      setState(prev => prev ? { ...prev, isRunning: true } : null);
    } catch (err: any) {
      setError(err.message || 'Failed to start scenario');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSimulation = async () => {
    try {
      setError(null);
      setState(prev => prev ? { ...prev, isStopping: true } : null);
      await simulationService.stop();
    } catch (err: any) {
      setError(err.message || 'Failed to stop simulation');
      setState(prev => prev ? { ...prev, isStopping: false } : null);
    }
  };

  const handleClearData = async () => {
    try {
      await simulationService.clearAll();
      setResults([]);
      setSummary(null);
      setCurrentConversation([]);
      setCurrentScenarioName('');
    } catch (err: any) {
      setError(err.message || 'Failed to clear data');
    }
  };

  const isRunning = state?.isRunning || false;
  const isStopping = state?.isStopping || false;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Simulation Dashboard</h1>
          <p className="text-muted-foreground">
            Run automated tests with simulated users to evaluate agent performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isRunning || results.length === 0}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All Simulation Data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all simulation results, scores, and conversation history.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearData} className="bg-destructive text-destructive-foreground">
                  Clear All Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button onClick={loadInitialData} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {isRunning || isStopping ? (
            <Button
              onClick={handleStopSimulation}
              disabled={isStopping}
              size="lg"
              variant="destructive"
            >
              <Square className="w-4 h-4 mr-2" />
              {isStopping ? 'Stopping...' : 'Stop Simulation'}
            </Button>
          ) : (
            <Button
              onClick={handleRunSimulation}
              disabled={isLoading}
              size="lg"
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Run Simulation
            </Button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <span className="text-destructive">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-auto"
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{summary.totalScenarios}</div>
                <Target className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Total Scenarios</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-amber-600">{summary.stopped}</div>
                <Square className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-sm text-muted-foreground">Stopped</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-blue-600">{summary.avgScore.toFixed(1)}</div>
                <Brain className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-sm text-muted-foreground">Avg Score</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{summary.totalTokens.toLocaleString()}</div>
                <Zap className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-sm text-muted-foreground">Total Tokens</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">${summary.totalCost.toFixed(4)}</div>
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">Total Cost</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{summary.avgLatency.toFixed(2)}s</div>
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Avg Latency</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Chat Display */}
        <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Live Simulation
                {isRunning && (
                  <Badge variant="default" className="ml-2 animate-pulse">
                    Running
                  </Badge>
                )}
                {isStopping && (
                  <Badge variant="secondary" className="ml-2">
                    Stopping
                  </Badge>
                )}
              </CardTitle>
            <CardDescription>
              {currentScenarioName || 'Waiting for simulation to start...'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-4">
              {currentConversation.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Bot className="w-16 h-16 mb-4 opacity-50" />
                  <p>No active conversation</p>
                  <p className="text-sm">Click "Run Simulation" to start</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentConversation.map((turn) => (
                    <div
                      key={turn.id}
                      className={`flex gap-3 ${
                        turn.role === 'user' ? 'justify-start' : 'justify-end'
                      }`}
                    >
                      {turn.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          turn.role === 'user'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-green-100 text-green-900'
                        }`}
                      >
                        <p className="text-sm">{turn.content}</p>
                        {turn.latencyMs && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {turn.latencyMs}ms | {turn.tokensUsed} tokens
                          </p>
                        )}
                      </div>
                      {turn.role === 'agent' && (
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Scenarios & Results */}
        <Tabs defaultValue="scenarios" className="h-[600px] flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="results">Results ({results.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[520px]">
              <div className="space-y-4 pr-4">
                {scenarios.map((scenario) => {
                  // All scenarios are family-focused
                  const RelIcon = Home;
                  const relColor = 'text-blue-600 bg-blue-100';

                  return (
                    <Card key={scenario.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${relColor}`}>
                              <RelIcon className="w-4 h-4" />
                            </div>
                            <CardTitle className="text-lg">{scenario.name}</CardTitle>
                          </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRunScenario(scenario.id)}
                          disabled={isRunning || isStopping}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Run
                        </Button>
                        </div>
                        <CardDescription>{scenario.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{scenario.userPersona.name}</span>
                          <Badge variant="secondary" className="ml-auto">
                            {scenario.conversationTurns} turns
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {scenario.userPersona.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge
                            variant="outline"
                            className="text-xs border-blue-300 text-blue-700"
                          >
                            Family
                          </Badge>
                          {scenario.evaluationCriteria.slice(0, 1).map((criteria, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {criteria}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="results" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[520px]">
              <div className="space-y-4 pr-4">
                {results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Target className="w-12 h-12 mb-4 opacity-50" />
                    <p>No results yet</p>
                    <p className="text-sm">Run a simulation to see results</p>
                  </div>
                ) : (
                  results.map((result) => (
                    <Card key={result.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{result.scenarioName}</CardTitle>
                          <Badge
                            variant={
                              result.status === 'completed'
                                ? 'default'
                                : result.status === 'stopped'
                                ? 'secondary'
                                : result.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {result.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {result.scores && (
                          <div className="space-y-2">
                            <ScoreBar
                              label="Memory Recall"
                              value={result.scores.memoryRecall}
                              icon={<Brain className="w-4 h-4" />}
                            />
                            <ScoreBar
                              label="Context Relevance"
                              value={result.scores.contextRelevance}
                              icon={<Target className="w-4 h-4" />}
                            />
                            <ScoreBar
                              label="Entity Extraction"
                              value={result.scores.entityExtraction}
                              icon={<Zap className="w-4 h-4" />}
                            />
                            <ScoreBar
                              label="Emotional Tone"
                              value={result.scores.emotionalTone}
                              icon={<Heart className="w-4 h-4" />}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {(result.totalLatencyMs / 1000).toFixed(2)}s
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {result.totalTokens} tokens
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${result.totalCost.toFixed(4)}
                          </span>
                        </div>
                        {result.error && (
                          <p className="text-sm text-destructive mt-2">{result.error}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Score Bar Component
function ScoreBar({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  const color =
    value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-medium">{value.toFixed(0)}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
