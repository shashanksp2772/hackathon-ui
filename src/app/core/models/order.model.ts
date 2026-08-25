export type OrderStatus = 'ASSIGNED' | 'REASSIGNMENT_PENDING' | 'REASSIGNED' | 'DELIVERED';

export interface Order {
  id: string;
  description: string;
  assignedAgentId: string;
  status: OrderStatus;
  createdAt: string;
  pickupZone: string | null;
  dropoffZone: string | null;
  weightClass: string | null;
  slaDeadline: string | null;
}
