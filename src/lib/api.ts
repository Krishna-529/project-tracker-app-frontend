import type { NodeStatus } from '@/types/node';

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  ?? DEFAULT_API_BASE_URL;

export interface ApiNode {
  id: number;
  name: string;
  parentId: number | null;
  isTask: boolean;
  status: NodeStatus;
  path: string;
  sortOrder: number;
  deadline?: string | null;
}

interface TreeResponse {
  data: ApiNode[];
  meta: {
    count: number;
    lastUpdated: string | null;
  };
}

export const fetchNodeTree = async (etag?: string): Promise<{ nodes: ApiNode[]; etag?: string | null }> => {
  const response = await fetch(`${API_BASE_URL}/nodes/tree`, {
    headers: etag ? { 'If-None-Match': etag } : undefined,
    credentials: 'include',
  });

  if (response.status === 304) {
    return { nodes: [], etag: response.headers.get('etag') };
  }

  if (!response.ok) {
    throw new Error(`Failed to load node tree: ${response.statusText}`);
  }

  const payload = (await response.json()) as TreeResponse;
  const newEtag = response.headers.get('etag');

  return { nodes: payload.data, etag: newEtag };
};

interface NodeDetailResponse {
  data: {
    id: number;
    name: string;
    isTask: boolean;
    parentId: number | null;
    path: string;
    status: NodeStatus;
    metaDescription?: string | null;
    deadline?: string | null;
    notes?: string | null;
    partsCompleted?: number | null;
    data?: Record<string, unknown> | null;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  };
}

export const fetchNodeById = async (id: number) => {
  const response = await fetch(`${API_BASE_URL}/nodes/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to load node ${id}: ${response.statusText}`);
  }

  return (await response.json()) as NodeDetailResponse;
};

interface CreateNodeRequest {
  name: string;
  isTask: boolean;
  parentId?: number | null;
  status?: NodeStatus;
  deadline?: string | null;
}

export const createNode = async (payload: CreateNodeRequest) => {
  const response = await fetch(`${API_BASE_URL}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to create node: ${response.statusText}`);
  }

  return response.json();
};

interface UpdateNodeRequest {
  name?: string;
  status?: NodeStatus;
  notes?: string;
  metaDescription?: string | null;
  deadline?: string | null;
}

export const updateNode = async (id: number, payload: UpdateNodeRequest) => {
  const response = await fetch(`${API_BASE_URL}/nodes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to update node ${id}: ${response.statusText}`);
  }

  return response.json();
};

interface MoveNodeRequest {
  nodeId: number;
  newParentId: number | null;
}

export const moveNode = async (payload: MoveNodeRequest) => {
  console.log('[API] moveNode called with:', payload);
  const response = await fetch(`${API_BASE_URL}/nodes/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[API] moveNode failed:', response.status, errorData);
    throw new Error(`Failed to move node: ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  return response.json();
};

interface ReorderNodesRequest {
  parentId?: number | null;
  orderedIds: number[];
}

export const reorderNodes = async (payload: ReorderNodesRequest) => {
  const response = await fetch(`${API_BASE_URL}/nodes/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to reorder nodes: ${response.statusText}`);
  }

  return response.json();
};

export const deleteNode = async (nodeId: number) => {
  const response = await fetch(`${API_BASE_URL}/nodes/${nodeId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete node ${nodeId}: ${response.statusText}`);
  }

  return response.json();
};

export const sendToDailyQuest = async (nodeId: number) => {
  const response = await fetch(`${API_BASE_URL}/integrations/daily-quest/${nodeId}`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to send to Daily Quest: ${response.statusText}`);
  }

  return response.json();
};

export const deleteFromDailyQuest = async (nodeId: number) => {
  const response = await fetch(`${API_BASE_URL}/integrations/daily-quest/${nodeId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    // Swallow 404s gracefully in case item was never synced or already removed
    if (response.status === 404) return { ok: true } as any;
    throw new Error(`Failed to delete from Daily Quest: ${response.statusText}`);
  }

  return response.json();
};

// Some backends may prefer a POST "delete" action route; mirror the working send style
export const deleteFromDailyQuestPost = async (nodeId: number) => {
  const response = await fetch(`${API_BASE_URL}/integrations/daily-quest/${nodeId}/delete`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 404) return { ok: true } as any;
    throw new Error(`Failed to delete from Daily Quest (POST): ${response.statusText}`);
  }

  return response.json();
};

// Direct Supabase delete (no backend), mirroring how posting would use DB URL
// Env vars expected:
// - VITE_SUPABASE_URL: e.g. https://<project>.supabase.co
// - VITE_SUPABASE_ANON_KEY: anon key for auth
// Table and column names may need adjustment to your schema.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const deleteFromDailyQuestSupabase = async (nodeId: number) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase URL or key not configured');
  }
  // Assuming a table `daily_quest_tasks` with a column `source_node_id` storing Project Tracker node id
  const url = `${SUPABASE_URL}/rest/v1/daily_quest_tasks?source_node_id=eq.${nodeId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Supabase delete failed: ${response.status} ${text}`);
  }
  return response.json().catch(() => ({}));
};

export const getGoogleAuthUrl = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/google/url`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to get Google Auth URL');
  return response.json();
};

export const logout = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to logout');
  return response.json();
};

export const getMe = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include',
  });
  if (!response.ok) {
    if (response.status === 401) return null;
    throw new Error('Failed to get user info');
  }
  const data = await response.json();
  return data.data.user;
};

