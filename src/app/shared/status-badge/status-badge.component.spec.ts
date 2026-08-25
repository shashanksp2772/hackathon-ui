import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  let component: StatusBadgeComponent;
  let fixture: ComponentFixture<StatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusBadgeComponent);
    fixture.componentRef.setInput('status', 'AVAILABLE');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the status text', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent?.trim();
    expect(text).toBe('AVAILABLE');
  });

  it('applies a css class derived from the status', () => {
    expect(component.cssClass()).toBe('status-badge status-badge--available');
  });

  it('converts underscores to hyphens for multi-word order statuses', async () => {
    fixture.componentRef.setInput('status', 'REASSIGNMENT_PENDING');
    await fixture.whenStable();

    expect(component.cssClass()).toBe('status-badge status-badge--reassignment-pending');
  });
});
