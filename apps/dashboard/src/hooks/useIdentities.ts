import type { CreateIdentityInput, Identity, UpdateIdentityInput } from '@adaptivegate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface CreatedIdentity extends Identity {
  key: string;
}

// `usedToday` isn't a stored column — it's computed on the server from
// today's events (see apps/server/src/api/identities.ts), not part of the
// shared `Identity` zod schema.
export interface IdentityWithUsage extends Identity {
  usedToday: number;
}

export function useIdentities() {
  return useQuery({
    queryKey: ['identities'],
    queryFn: () => apiClient.get<IdentityWithUsage[]>('/api/identities'),
  });
}

export function useCreateIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIdentityInput) =>
      apiClient.post<CreatedIdentity>('/api/identities', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['identities'] }),
  });
}

export function useUpdateIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateIdentityInput }) =>
      apiClient.patch<Identity>(`/api/identities/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['identities'] }),
  });
}

export function useDeleteIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/api/identities/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['identities'] }),
  });
}
