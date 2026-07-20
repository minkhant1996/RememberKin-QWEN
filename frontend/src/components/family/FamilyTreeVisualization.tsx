import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserX, X, Cake, Mail } from 'lucide-react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FamilyTree, FamilyTreeNode } from '../../types';
import { useAuthStore } from '../../store/authStore';

interface FamilyTreeVisualizationProps {
  tree: FamilyTree;
}

const nodeWidth = 150;
const nodeHeight = 110;

const relationshipColors: Record<string, string> = {
  PARENT_OF: '#10b981',
  SPOUSE_OF: '#ef4444',
  SIBLING_OF: '#3b82f6',
};

const generationAvatars = [
  'bg-amber-100 text-amber-700',    // grandparents
  'bg-primary-100 text-primary-700', // parents
  'bg-sky-100 text-sky-700',         // children
  'bg-rose-100 text-rose-700',       // great-grandchildren
];

export default function FamilyTreeVisualization({ tree }: FamilyTreeVisualizationProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);

  const initialNodes: Node[] = useMemo(() => {
    const { positions, levels } = calculateLayout(tree);

    return tree.nodes.map((node, index) => {
      const avatarClass = generationAvatars[(levels[node.id] ?? 0) % generationAvatars.length];
      const isMe = node.id === currentUserId;
      return {
        id: node.id,
        position: positions[node.id] || { x: (index % 4) * 210, y: Math.floor(index / 4) * 190 },
        data: {
          member: node,
          label: (
            <div className="text-center relative">
              {isMe && (
                <div className="absolute top-0 left-0 px-1.5 py-0.5 bg-primary-500 text-white text-[10px] font-semibold rounded-full shadow-sm">
                  You
                </div>
              )}
              <div className={`w-11 h-11 ${isMe ? 'bg-primary-500 text-white ring-2 ring-primary-200' : avatarClass} rounded-full flex items-center justify-center mx-auto mb-1.5 shadow-sm`}>
                <span className="font-semibold text-base">
                  {node.name.charAt(0)}
                </span>
              </div>
              {node.isRegistered === false && (
                <div
                  className="absolute top-0 right-0 w-4 h-4 bg-white rounded-full flex items-center justify-center border border-gray-200"
                  title="Invited — not registered yet"
                >
                  <UserX className="w-2.5 h-2.5 text-gray-400" />
                </div>
              )}
              <div className="font-medium text-gray-900 text-sm truncate max-w-[130px]">
                {node.name}
              </div>
              {node.nickname && (
                <div className="text-xs text-gray-500 truncate">"{node.nickname}"</div>
              )}
              <div className="text-xs text-gray-400">
                {node.birthDate ? new Date(node.birthDate).getFullYear() : ' '}
                {node.isDeceased ? ' 🕊' : ''}
              </div>
            </div>
          ),
        },
        style: {
          width: nodeWidth,
          height: nodeHeight,
          backgroundColor: isMe ? 'hsl(var(--primary) / 0.06)' : 'white',
          border: isMe ? '2px solid hsl(var(--primary))' : '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '8px',
          boxShadow: isMe ? '0 2px 8px hsl(var(--primary) / 0.3)' : '0 1px 3px rgba(0,0,0,0.06)',
          cursor: 'pointer',
        },
      };
    });
  }, [tree.nodes, tree.edges, currentUserId]);

  const initialEdges: Edge[] = useMemo(() => {
    // Hide sibling edges when the pair already shares a parent — the shared
    // parent connector conveys it, and the extra lines just add clutter.
    const parentsOf = new Map<string, Set<string>>();
    tree.edges
      .filter((e) => e.relationship === 'PARENT_OF')
      .forEach((e) => {
        if (!parentsOf.has(e.to)) parentsOf.set(e.to, new Set());
        parentsOf.get(e.to)!.add(e.from);
      });
    const shareParent = (a: string, b: string) => {
      const pa = parentsOf.get(a);
      const pb = parentsOf.get(b);
      if (!pa || !pb) return false;
      return [...pa].some((p) => pb.has(p));
    };

    return tree.edges
      .filter((e) => !(e.relationship === 'SIBLING_OF' && shareParent(e.from, e.to)))
      .map((edge, index) => ({
        id: `e${index}`,
        source: edge.from,
        target: edge.to,
        type: edge.relationship === 'SPOUSE_OF' ? 'straight' : 'smoothstep',
        animated: false,
        style: {
          stroke: relationshipColors[edge.relationship] || '#9ca3af',
          strokeWidth: 2,
          ...(edge.relationship === 'SPOUSE_OF' ? { strokeDasharray: '6 4' } : {}),
        },
        markerEnd: edge.relationship === 'PARENT_OF' ? {
          type: MarkerType.ArrowClosed,
          color: relationshipColors[edge.relationship],
        } : undefined,
      }));
  }, [tree.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedMember, setSelectedMember] = useState<FamilyTreeNode | null>(null);

  // Resync when members/relationships change (e.g. after adding a member)
  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);
  useEffect(() => { setEdges(initialEdges); }, [initialEdges, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedMember(node.data.member ?? null);
  }, []);

  if (tree.nodes.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">No family members to display</p>
      </div>
    );
  }

  return (
    <div className="relative h-[500px] bg-gray-50 rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background color="#d1d5db" gap={16} />
        <Controls />
        <MiniMap
          nodeColor="#7c3aed"
          maskColor="rgb(255, 255, 255, 0.8)"
          style={{ border: '1px solid #e5e7eb' }}
        />
      </ReactFlow>

      {selectedMember && (
        <div className="absolute top-4 right-4 w-64 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-10">
          <button
            onClick={() => setSelectedMember(null)}
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Close member details"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 text-lg font-semibold">
                {selectedMember.name.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{selectedMember.name}</p>
              {selectedMember.nickname && (
                <p className="text-sm text-gray-500 truncate">"{selectedMember.nickname}"</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5 text-sm text-gray-600">
            {selectedMember.birthDate && (
              <div className="flex items-center gap-2">
                <Cake className="w-4 h-4 text-gray-400" />
                <span>
                  {new Date(selectedMember.birthDate).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </span>
              </div>
            )}
            {selectedMember.isRegistered === false && (
              <div className="flex items-center gap-2 text-amber-600">
                <Mail className="w-4 h-4" />
                <span>Invited — not registered yet</span>
              </div>
            )}
            {selectedMember.isDeceased && (
              <p className="text-gray-400 italic">In loving memory</p>
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-sm border p-2">
        <div className="text-xs text-gray-500 mb-1">Legend:</div>
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-green-500" />
            <span>Parent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-red-500" style={{ strokeDasharray: '4' }} />
            <span>Spouse</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-500" />
            <span>Sibling</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TreeLayout {
  positions: Record<string, { x: number; y: number }>;
  levels: Record<string, number>;
}

/**
 * Generation-aware layout:
 * - Children sit one row below their deepest parent (longest-path leveling).
 * - Spouses are pulled onto the same row and placed side by side.
 * - Within a row, nodes are ordered under their parents (barycenter heuristic).
 */
function calculateLayout(tree: FamilyTree): TreeLayout {
  const positions: Record<string, { x: number; y: number }> = {};
  const levels: Record<string, number> = {};
  const parentEdges = tree.edges.filter((e) => e.relationship === 'PARENT_OF');
  const spouseEdges = tree.edges.filter((e) => e.relationship === 'SPOUSE_OF');

  tree.nodes.forEach((n) => { levels[n.id] = 0; });

  // Iterate leveling until stable: child below parents, spouses on the same row
  for (let i = 0; i < tree.nodes.length + 2; i++) {
    let changed = false;
    for (const e of parentEdges) {
      if (levels[e.from] === undefined || levels[e.to] === undefined) continue;
      const want = levels[e.from] + 1;
      if (levels[e.to] < want) { levels[e.to] = want; changed = true; }
    }
    for (const e of spouseEdges) {
      if (levels[e.from] === undefined || levels[e.to] === undefined) continue;
      const m = Math.max(levels[e.from], levels[e.to]);
      if (levels[e.from] !== m) { levels[e.from] = m; changed = true; }
      if (levels[e.to] !== m) { levels[e.to] = m; changed = true; }
    }
    if (!changed) break;
  }

  // Members with no relationships at all (e.g. demo/judge accounts) go to a
  // bottom row instead of polluting the grandparents' row as fake roots.
  const connected = new Set<string>();
  tree.edges.forEach((e) => { connected.add(e.from); connected.add(e.to); });
  const connectedMax = Math.max(0, ...tree.nodes.filter((n) => connected.has(n.id)).map((n) => levels[n.id] ?? 0));
  tree.nodes.forEach((n) => {
    if (!connected.has(n.id) && tree.edges.length > 0) {
      levels[n.id] = connectedMax + 1;
    }
  });

  const spouseOf = new Map<string, string[]>();
  for (const e of spouseEdges) {
    spouseOf.set(e.from, [...(spouseOf.get(e.from) || []), e.to]);
    spouseOf.set(e.to, [...(spouseOf.get(e.to) || []), e.from]);
  }
  const parentsOf = new Map<string, string[]>();
  for (const e of parentEdges) {
    parentsOf.set(e.to, [...(parentsOf.get(e.to) || []), e.from]);
  }

  const maxLevel = Math.max(0, ...Object.values(levels));
  let prevOrder: string[] = [];

  for (let level = 0; level <= maxLevel; level++) {
    const ids = tree.nodes.filter((n) => levels[n.id] === level).map((n) => n.id);
    if (ids.length === 0) continue;

    // Sort under parents (average parent index in the row above); spouses inherit
    // their partner's anchor so they land next to each other.
    const key = (id: string): number => {
      const parents = (parentsOf.get(id) || []).filter((p) => prevOrder.includes(p));
      if (parents.length > 0) {
        return parents.reduce((s, p) => s + prevOrder.indexOf(p), 0) / parents.length;
      }
      const partner = (spouseOf.get(id) || []).find((s) => ids.includes(s) && (parentsOf.get(s) || []).length > 0);
      if (partner) {
        const pk = key(partner);
        return pk + 0.01; // sit just beside the partner
      }
      return Number.MAX_SAFE_INTEGER;
    };

    const sorted = [...ids].sort((a, b) => key(a) - key(b) || a.localeCompare(b));

    // Final pass: force spouses adjacent
    const ordered: string[] = [];
    const placed = new Set<string>();
    for (const id of sorted) {
      if (placed.has(id)) continue;
      ordered.push(id);
      placed.add(id);
      for (const partner of spouseOf.get(id) || []) {
        if (ids.includes(partner) && !placed.has(partner)) {
          ordered.push(partner);
          placed.add(partner);
        }
      }
    }

    const hSpacing = 210;
    const vSpacing = 190;
    const startX = -((ordered.length - 1) * hSpacing) / 2;
    ordered.forEach((id, index) => {
      positions[id] = { x: startX + index * hSpacing, y: level * vSpacing };
    });
    prevOrder = ordered;
  }

  return { positions, levels };
}
