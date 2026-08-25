import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OrderApi } from './order-api';
import { API_BASE_URL } from '../config/api.config';

describe('OrderApi', () => {
  let service: OrderApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://test-api' },
      ],
    });
    service = TestBed.inject(OrderApi);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    httpMock.match(() => true).forEach((r) => r.flush([]));
    expect(service).toBeTruthy();
  });

  it('requests only REASSIGNMENT_PENDING orders for the pending view', () => {
    const req = httpMock.expectOne(
      (r) => r.url === 'http://test-api/orders' && r.params.get('status') === 'REASSIGNMENT_PENDING',
    );
    req.flush([]);
    // The unfiltered all-orders resource also fires on construction.
    httpMock.expectOne((r) => r.url === 'http://test-api/orders' && !r.params.has('status')).flush([]);

    expect(service.pendingOrders()).toEqual([]);
  });

  it('requests every order, unfiltered, for the all-orders view', async () => {
    httpMock.expectOne((r) => r.url === 'http://test-api/orders' && r.params.get('status') === 'REASSIGNMENT_PENDING').flush([]);
    const req = httpMock.expectOne((r) => r.url === 'http://test-api/orders' && !r.params.has('status'));
    req.flush([{ id: 'ORD-001', description: 'test', assignedAgentId: 'AGT-001', status: 'ASSIGNED', createdAt: new Date().toISOString(), pickupZone: null, dropoffZone: null, weightClass: null, slaDeadline: null }]);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(service.allOrders()).toHaveLength(1);
  });
});
