import { useQuery } from '@tanstack/react-query'

import { apiGet } from './client'

export interface HealthStatus {
  status: 'ok' | 'error'
  database: 'ok' | 'error'
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet<HealthStatus>('/health'),
    refetchInterval: 30_000,
  })
}
