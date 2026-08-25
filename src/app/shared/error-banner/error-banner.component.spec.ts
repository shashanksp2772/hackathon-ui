import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorBannerComponent } from './error-banner.component';

describe('ErrorBannerComponent', () => {
  let component: ErrorBannerComponent;
  let fixture: ComponentFixture<ErrorBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorBannerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorBannerComponent);
    fixture.componentRef.setInput('message', 'Something went wrong');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits retry when the button is clicked', () => {
    let emitted = false;
    component.retry.subscribe(() => (emitted = true));

    (fixture.nativeElement as HTMLElement).querySelector('button')?.dispatchEvent(new Event('click'));

    expect(emitted).toBe(true);
  });
});
