import type { CreateApiKeyInput } from '@adaptivegate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

// The gateway's /api/keys never returns the hash or a raw key except once,
// right after creation — see CreatedApiKey below. createdAt/revokedAt are
// real Date objects at runtime (apiClient's reviveDates JSON reviver) — this
// used to declare them `string` as a workaround for the apiClient not
// actually coercing dates; now that it does, the type matches reality.
export interface ApiKeyListItem {
  id: string;
  label: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface CreatedApiKey extends ApiKeyListItem {
  key: string;
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => apiClient.get<ApiKeyListItem[]>('/api/keys'),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiKeyInput) => apiClient.post<CreatedApiKey>('/api/keys', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apiKeys'] }),
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<void>(`/api/keys/${id}/revoke`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apiKeys'] }),
  });
}
