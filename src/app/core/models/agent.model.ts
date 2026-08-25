export type AgentStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  activeOrderCount: number;
  currentZone: string | null;
  maxCapacity: number | null;
}
