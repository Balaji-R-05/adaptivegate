import type { CreatePolicyInput, Policy } from '@adaptivegate/shared';
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
