import type { CreateServerConfigInput, ServerConfig } from '@adaptivegate/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: () => apiClient.get<ServerConfig[]>('/api/servers'),
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateServerConfigInput) =>
      apiClient.post<ServerConfig>('/api/servers', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servers'] }),
  });
}

export function useDeleteServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/api/servers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servers'] }),
  });
}
