import type { ApiNode } from './api';
import type { Node } from '@/types/node';

interface BuildResult {
  roots: Node[];
  map: Map<number, Node>;
}

const sortChildren = (nodes: Node[]) => {
  nodes.sort((a, b) => {
    const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (sortDiff !== 0) {
      return sortDiff;
    }
    return a.id - b.id;
  });

  nodes.forEach(node => {
    if (!node.is_task && node.children) {
      sortChildren(node.children);
    }
  });
};

export const buildNodeTree = (flatNodes: ApiNode[]): BuildResult => {
  const map = new Map<number, Node>();

  flatNodes.forEach(raw => {
    const node: Node = {
      id: raw.id,
      name: raw.name,
      is_task: raw.isTask,
      parent_id: raw.parentId,
      path: raw.path,
      status: raw.status,
      sort_order: raw.sortOrder ?? 0,
      children: raw.isTask ? undefined : [],
    };

    map.set(node.id, node);
  });

  const roots: Node[] = [];

  map.forEach(node => {
    if (node.parent_id != null) {
      const parent = map.get(node.parent_id);
      if (parent && !parent.is_task) {
        parent.children = parent.children ?? [];
        parent.children.push(node);
        return;
      }
    }

    roots.push(node);
  });

  sortChildren(roots);

  return { roots, map };
};
