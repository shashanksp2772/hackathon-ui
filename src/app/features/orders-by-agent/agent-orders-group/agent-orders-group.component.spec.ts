import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Agent } from '../../../core/models/agent.model';
import { Order } from '../../../core/models/order.model';
import { AgentOrdersGroupComponent } from './agent-orders-group.component';

const AGENT: Agent = {
  id: 'AGT-001',
  name: 'Priya Sharma',
  status: 'BUSY',
  activeOrderCount: 1,
  currentZone: null,
  maxCapacity: null,
};

const ORDER: Order = {
  id: 'ORD-001',
  description: 'Electronics - Koramangala to Indiranagar',
  assignedAgentId: 'AGT-001',
  status: 'ASSIGNED',
  createdAt: new Date().toISOString(),
  pickupZone: null,
  dropoffZone: null,
  weightClass: null,
  slaDeadline: null,
};

describe('AgentOrdersGroupComponent', () => {
  let component: AgentOrdersGroupComponent;
  let fixture: ComponentFixture<AgentOrdersGroupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentOrdersGroupComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentOrdersGroupComponent);
    fixture.componentRef.setInput('agent', AGENT);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows an empty state when the agent has no orders', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No orders currently assigned');
  });

  it('renders one row per order once provided', async () => {
    fixture.componentRef.setInput('orders', [ORDER]);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ORD-001');
    expect(text).toContain('Electronics - Koramangala to Indiranagar');
  });

  it('does not flag an ASSIGNED order when its agent is not offline', () => {
    expect(component.needsAttention(ORDER)).toBe(false);
  });

  it('flags an ASSIGNED order whose agent is OFFLINE as needing attention', async () => {
    fixture.componentRef.setInput('agent', { ...AGENT, status: 'OFFLINE' });
    fixture.componentRef.setInput('orders', [ORDER]);
    await fixture.whenStable();

    expect(component.needsAttention(ORDER)).toBe(true);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Needs attention');
  });

  it('does not flag a REASSIGNMENT_PENDING order even if the agent is offline', () => {
    fixture.componentRef.setInput('agent', { ...AGENT, status: 'OFFLINE' });

    expect(component.needsAttention({ ...ORDER, status: 'REASSIGNMENT_PENDING' })).toBe(false);
  });

  it('emits reassign with the order id when the Reassign button is clicked', async () => {
    fixture.componentRef.setInput('agent', { ...AGENT, status: 'OFFLINE' });
    fixture.componentRef.setInput('orders', [ORDER]);
    await fixture.whenStable();

    const emitted: string[] = [];
    component.reassign.subscribe((orderId) => emitted.push(orderId));

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      '.agent-orders-group__reassign',
    ) as HTMLButtonElement;
    button.click();

    expect(emitted).toEqual(['ORD-001']);
  });

  it('disables the Reassign button only for the order currently being reassigned', async () => {
    fixture.componentRef.setInput('agent', { ...AGENT, status: 'OFFLINE' });
    fixture.componentRef.setInput('orders', [ORDER]);
    fixture.componentRef.setInput('reassigningOrderId', 'ORD-001');
    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      '.agent-orders-group__reassign',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Reassigning');
  });
});
