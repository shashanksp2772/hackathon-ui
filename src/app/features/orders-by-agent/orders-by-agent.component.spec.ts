import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/config/api.config';
import { OrdersByAgentComponent } from './orders-by-agent.component';

describe('OrdersByAgentComponent', () => {
  let component: OrdersByAgentComponent;
  let fixture: ComponentFixture<OrdersByAgentComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersByAgentComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://test-api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersByAgentComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    httpMock.match(() => true).forEach((r) => r.flush([]));
    expect(component).toBeTruthy();
  });

  it('groups orders under the agent they are assigned to', async () => {
    httpMock.expectOne((r) => r.url === 'http://test-api/agents').flush([
      { id: 'AGT-001', name: 'Priya', status: 'BUSY', activeOrderCount: 1, currentZone: null, maxCapacity: null },
      { id: 'AGT-002', name: 'Rahul', status: 'AVAILABLE', activeOrderCount: 0, currentZone: null, maxCapacity: null },
    ]);
    httpMock
      .expectOne((r) => r.url === 'http://test-api/orders' && r.params.get('status') === 'REASSIGNMENT_PENDING')
      .flush([]);
    httpMock
      .expectOne((r) => r.url === 'http://test-api/orders' && !r.params.has('status'))
      .flush([
        {
          id: 'ORD-001',
          description: 'Electronics delivery',
          assignedAgentId: 'AGT-001',
          status: 'ASSIGNED',
          createdAt: new Date().toISOString(),
          pickupZone: null,
          dropoffZone: null,
          weightClass: null,
          slaDeadline: null,
        },
      ]);
    httpMock.expectOne((r) => r.url === 'http://test-api/suggestions').flush([]);

    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Priya');
    expect(text).toContain('ORD-001');
    expect(text).toContain('Rahul');
    expect(text).toContain('No orders currently assigned');
  });
});
