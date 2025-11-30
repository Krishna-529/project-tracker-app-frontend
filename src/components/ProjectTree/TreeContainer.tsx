import { useState } from 'react';
import { Node } from '@/types/node';
import { NodeRow } from './NodeRow';
import { GhostInsert } from './GhostInsert';
import { BottomAddMenu } from './BottomAddMenu';

interface TreeContainerProps {
  nodes: Node[];
  depth?: number;
}

export const TreeContainer = ({ nodes, depth = 0 }: TreeContainerProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="relative">
      {nodes.map((node, index) => (
        <div key={node.id} className="relative">
          {/* Ghost insert line before each item */}
          {hoveredIndex === index && (
            <GhostInsert
              onInsert={() => {
                console.log('Insert before', node.id);
              }}
              parentId={node.parent_id}
            />
          )}
          
          <div
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <NodeRow node={node} depth={depth} />
          </div>

          {/* Render children recursively */}
          {!node.is_task && node.children && node.children.length > 0 && (
            <TreeContainer nodes={node.children} depth={depth + 1} />
          )}
        </div>
      ))}

      {/* Bottom Add Menu */}
      <BottomAddMenu />
    </div>
  );
};
