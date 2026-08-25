import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { SuggestionApi } from './suggestion-api';
import { API_BASE_URL } from '../config/api.config';

describe('SuggestionApi', () => {
  let service: SuggestionApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://test-api' },
      ],
    });
    service = TestBed.inject(SuggestionApi);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    httpMock.expectOne(() => true).flush([]);
    expect(service).toBeTruthy();
  });

  it('requests only PENDING suggestions', () => {
    const req = httpMock.expectOne(
      (r) => r.url === 'http://test-api/suggestions' && r.params.get('status') === 'PENDING',
    );
    req.flush([]);

    expect(service.pendingSuggestions()).toEqual([]);
  });

  it('sends a PATCH with the decided status when accepting', () => {
    httpMock.expectOne((r) => r.url === 'http://test-api/suggestions').flush([]);

    service.updateStatus('sugg-1', 'ACCEPTED').subscribe();

    const req = httpMock.expectOne('http://test-api/suggestions/sugg-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'ACCEPTED' });
    req.flush({
      id: 'sugg-1',
      orderId: 'ORD-001',
      recommendedAgentId: 'AGT-002',
      confidence: 1,
      reasoning: 'test',
      status: 'ACCEPTED',
      triggerReason: 'INITIAL',
      createdAt: new Date().toISOString(),
    });
  });
});
