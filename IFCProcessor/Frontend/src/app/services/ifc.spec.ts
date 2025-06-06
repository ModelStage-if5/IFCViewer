import { TestBed } from '@angular/core/testing';

import { Ifc } from './ifc';

describe('Ifc', () => {
  let service: Ifc;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Ifc);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
