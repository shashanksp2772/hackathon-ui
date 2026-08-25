import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TriggerBadgeComponent } from './trigger-badge.component';

describe('TriggerBadgeComponent', () => {
  let component: TriggerBadgeComponent;
  let fixture: ComponentFixture<TriggerBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TriggerBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TriggerBadgeComponent);
    component = fixture.componentInstance;
  });

  it('labels an AGENT_OFFLINE suggestion as an auto re-plan', async () => {
    fixture.componentRef.setInput('triggerReason', 'AGENT_OFFLINE');
    await fixture.whenStable();

    expect(component.isAutoReplan()).toBe(true);
    expect(component.label()).toBe('Auto re-plan');
  });

  it('labels an INITIAL suggestion as manual', async () => {
    fixture.componentRef.setInput('triggerReason', 'INITIAL');
    await fixture.whenStable();

    expect(component.isAutoReplan()).toBe(false);
    expect(component.label()).toBe('Manual');
  });
});
