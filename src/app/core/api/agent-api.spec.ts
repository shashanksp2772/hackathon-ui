import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AgentApi } from './agent-api';
import { API_BASE_URL } from '../config/api.config';

describe('AgentApi', () => {
  let service: AgentApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://test-api' },
      ],
    });
    service = TestBed.inject(AgentApi);
    httpMock = TestBed.inject(HttpTestingController);
    // rxResource schedules its initial load as a pending effect; tick()
    // flushes that synchronously so the request exists before we assert on it.
    TestBed.tick();
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    httpMock.expectOne('http://test-api/agents').flush([]);
    expect(service).toBeTruthy();
  });

  it('loads the agent roster on creation', async () => {
    const req = httpMock.expectOne('http://test-api/agents');
    req.flush([{ id: 'AGT-001', name: 'Priya', status: 'AVAILABLE', activeOrderCount: 0, currentZone: null, maxCapacity: null }]);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(service.agents()).toHaveLength(1);
    expect(service.agents()[0].id).toBe('AGT-001');
  });

  it('sends a PATCH when updating an agent status', () => {
    httpMock.expectOne('http://test-api/agents').flush([]);

    service.updateStatus('AGT-001', 'OFFLINE').subscribe();

    const req = httpMock.expectOne('http://test-api/agents/AGT-001/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'OFFLINE' });
    req.flush({ id: 'AGT-001', name: 'Priya', status: 'OFFLINE', activeOrderCount: 0, currentZone: null, maxCapacity: null });
  });
});
