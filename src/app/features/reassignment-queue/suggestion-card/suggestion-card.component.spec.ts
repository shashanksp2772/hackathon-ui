import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../../core/config/api.config';
import { Suggestion } from '../../../core/models/suggestion.model';
import { SuggestionCardComponent } from './suggestion-card.component';

const SUGGESTION: Suggestion = {
  id: 'sugg-1',
  orderId: 'ORD-001',
  recommendedAgentId: 'AGT-002',
  confidence: 0.85,
  reasoning: 'AGT-002 has the fewest active orders.',
  status: 'PENDING',
  triggerReason: 'AGENT_OFFLINE',
  createdAt: new Date().toISOString(),
};

describe('SuggestionCardComponent', () => {
  let component: SuggestionCardComponent;
  let fixture: ComponentFixture<SuggestionCardComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuggestionCardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://test-api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SuggestionCardComponent);
    fixture.componentRef.setInput('suggestion', SUGGESTION);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();
    // SuggestionApi polls PENDING suggestions on construction; drain it so
    // it doesn't interfere with assertions on the accept/reject PATCH below.
    httpMock.expectOne((r) => r.url === 'http://test-api/suggestions').flush([]);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes confidence as a whole percentage', () => {
    expect(component.confidencePercent()).toBe(85);
  });

  it('emits actionCompleted after a successful accept', () => {
    let completed = false;
    component.actionCompleted.subscribe(() => (completed = true));

    component.accept();

    const req = httpMock.expectOne('http://test-api/suggestions/sugg-1');
    expect(req.request.body).toEqual({ status: 'ACCEPTED' });
    req.flush({ ...SUGGESTION, status: 'ACCEPTED' });

    expect(completed).toBe(true);
    expect(component.submitting()).toBe(false);
  });

  it('surfaces an error message when the PATCH fails', () => {
    component.reject();

    const req = httpMock.expectOne('http://test-api/suggestions/sugg-1');
    req.flush('failed', { status: 500, statusText: 'Server Error' });

    expect(component.actionError()).toContain('Could not update');
  });
});
