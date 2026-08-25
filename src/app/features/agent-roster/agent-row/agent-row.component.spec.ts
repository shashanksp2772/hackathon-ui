import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgentApi } from '../../../core/api/agent-api';
import { API_BASE_URL } from '../../../core/config/api.config';
import { Agent } from '../../../core/models/agent.model';
import { AgentRowComponent } from './agent-row.component';

const AGENT: Agent = {
  id: 'AGT-001',
  name: 'Priya Sharma',
  status: 'AVAILABLE',
  activeOrderCount: 2,
  currentZone: null,
  maxCapacity: null,
};

describe('AgentRowComponent', () => {
  let component: AgentRowComponent;
  let fixture: ComponentFixture<AgentRowComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentRowComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://test-api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentRowComponent);
    fixture.componentRef.setInput('agent', AGENT);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    httpMock.expectOne('http://test-api/agents').flush([]);
    expect(component).toBeTruthy();
  });

  it('offers to set an AVAILABLE agent offline', () => {
    httpMock.expectOne('http://test-api/agents').flush([]);
    expect(component.isOffline()).toBe(false);
  });

  it('PATCHes OFFLINE, then asks AgentApi to refresh once the PATCH succeeds', () => {
    httpMock.expectOne('http://test-api/agents').flush([]);
    const refreshSpy = vi.spyOn(TestBed.inject(AgentApi), 'refresh');

    component.toggleOffline();

    const req = httpMock.expectOne('http://test-api/agents/AGT-001/status');
    expect(req.request.body).toEqual({ status: 'OFFLINE' });
    req.flush({ ...AGENT, status: 'OFFLINE' });

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(component.submitting()).toBe(false);
  });
});
