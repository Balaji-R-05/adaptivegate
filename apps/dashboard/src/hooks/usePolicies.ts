import type { CreatePolicyInput, DeletePolicyInput, Policy } from '@adaptivegate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export function usePolicies() {
  return useQuery({
    queryKey: ['policies'],
    queryFn: () => apiClient.get<Policy[]>('/api/policies'),
  });
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePolicyInput) => apiClient.post<Policy>('/api/policies', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policies'] }),
  });
}

export function useDeletePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DeletePolicyInput }) =>
      apiClient.delete<void>(`/api/policies/${id}`, input),
    // Deleting a policy can reassign (or un-pin) identities, so their
    // cached list is stale too, not just the policy list.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
    },
  });
}
