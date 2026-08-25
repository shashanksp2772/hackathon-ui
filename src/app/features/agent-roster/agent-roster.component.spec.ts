import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/config/api.config';
import { AgentRosterComponent } from './agent-roster.component';

describe('AgentRosterComponent', () => {
  let component: AgentRosterComponent;
  let fixture: ComponentFixture<AgentRosterComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentRosterComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://test-api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentRosterComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    // AgentApi's rxResource schedules its initial GET as a pending effect;
    // tick() flushes that synchronously. Doing this *before* ever awaiting
    // stability matters — whenStable() would otherwise wait forever on the
    // very request this test needs to flush.
    TestBed.tick();
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    httpMock.expectOne('http://test-api/agents').flush([]);
    expect(component).toBeTruthy();
  });

  it('renders one row per agent once loaded', async () => {
    httpMock.expectOne('http://test-api/agents').flush([
      { id: 'AGT-001', name: 'Priya', status: 'AVAILABLE', activeOrderCount: 0, currentZone: null, maxCapacity: null },
      { id: 'AGT-002', name: 'Rahul', status: 'BUSY', activeOrderCount: 1, currentZone: null, maxCapacity: null },
    ]);
    await fixture.whenStable();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('app-agent-row');
    expect(rows).toHaveLength(2);
  });
});
