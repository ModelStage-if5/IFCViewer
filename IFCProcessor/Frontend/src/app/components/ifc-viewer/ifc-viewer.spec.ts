import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IfcViewer } from './ifc-viewer';

describe('IfcViewer', () => {
  let component: IfcViewer;
  let fixture: ComponentFixture<IfcViewer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IfcViewer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IfcViewer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
