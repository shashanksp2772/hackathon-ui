import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/config/api.config';
import { ReassignmentQueueComponent } from './reassignment-queue.component';

describe('ReassignmentQueueComponent', () => {
  let component: ReassignmentQueueComponent;
  let fixture: ComponentFixture<ReassignmentQueueComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReassignmentQueueComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://test-api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReassignmentQueueComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    httpMock.match(() => true).forEach((r) => r.flush([]));
    expect(component).toBeTruthy();
  });

  it('joins a pending suggestion with its order description and recommended agent name', async () => {
    httpMock
      .expectOne((r) => r.url === 'http://test-api/suggestions')
      .flush([
        {
          id: 'sugg-1',
          orderId: 'ORD-001',
          recommendedAgentId: 'AGT-002',
          confidence: 0.9,
          reasoning: 'test reasoning',
          status: 'PENDING',
          triggerReason: 'AGENT_OFFLINE',
          createdAt: new Date().toISOString(),
        },
      ]);
    httpMock
      .expectOne((r) => r.url === 'http://test-api/orders' && r.params.get('status') === 'REASSIGNMENT_PENDING')
      .flush([
        {
          id: 'ORD-001',
          description: 'Electronics delivery',
          assignedAgentId: 'AGT-001',
          status: 'REASSIGNMENT_PENDING',
          createdAt: new Date().toISOString(),
          pickupZone: null,
          dropoffZone: null,
          weightClass: null,
          slaDeadline: null,
        },
      ]);
    // OrderApi also polls the unfiltered all-orders view; irrelevant here but must be drained.
    httpMock.expectOne((r) => r.url === 'http://test-api/orders' && !r.params.has('status')).flush([]);
    httpMock
      .expectOne('http://test-api/agents')
      .flush([{ id: 'AGT-002', name: 'Rahul Verma', status: 'AVAILABLE', activeOrderCount: 0, currentZone: null, maxCapacity: null }]);

    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Electronics delivery');
    expect(text).toContain('Rahul Verma');
  });
});
