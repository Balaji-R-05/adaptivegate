import type { Event, EventStats, EventType } from '@adaptivegate/shared';
import { useQuery } from '@tanstack/react-query';
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
}

export function useEvents(filters: EventFilters) {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.before) params.set('before', filters.before);

  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => apiClient.get<Event[]>(`/api/events?${params.toString()}`),
  });
}
