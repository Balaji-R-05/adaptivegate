import type { Event, EventStats, EventType } from '@adaptivegate/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export function useEventStats() {
  return useQuery({
    queryKey: ['events', 'stats'],
    queryFn: () => apiClient.get<EventStats>('/api/events/stats'),
  });
}

interface EventFilters {
  type?: EventType;
  before?: string;
  refetchInterval?: number | false;
}

export function useEvents({ refetchInterval, ...filters }: EventFilters) {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.before) params.set('before', filters.before);

  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => apiClient.get<Event[]>(`/api/events?${params.toString()}`),
    refetchInterval,
  });
}

export interface VerifyChainResponse {
  valid: boolean;
  eventCount: number;
  // How many individual events have a hash mismatch, and where the first
  // one is — lets the UI say "36/40 verified, 4 broken since <date>"
  // instead of a flat pass/fail that can't distinguish a few old
  // pre-fix events from total corruption.
  brokenCount: number;
  firstBrokenEventId: string | null;
  firstBrokenEventAt: string | null;
}

export function useVerifyChain() {
  return useMutation({
    mutationFn: () => apiClient.get<VerifyChainResponse>('/api/events/verify'),
  });
}
