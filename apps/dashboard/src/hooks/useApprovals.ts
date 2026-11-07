import type { Approval } from '@adaptivegate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface ApprovalWithExpiry extends Approval {
  isExpired: boolean;
}

// Polled rather than pushed — a simple refetchInterval is enough to make
// the queue feel live without a new SSE transport (see the implementation
// plan's explicit scoping note on this).
export function useApprovals() {
  return useQuery({
    queryKey: ['approvals'],
    queryFn: () => apiClient.get<ApprovalWithExpiry[]>('/api/approvals'),
    refetchInterval: 5000,
  });
}

export function useResolveApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'denied' }) =>
      apiClient.patch<Approval>(`/api/approvals/${id}`, { decision }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals'] }),
  });
}
