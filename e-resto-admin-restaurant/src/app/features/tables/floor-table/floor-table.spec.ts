import { ComponentFixture, TestBed } from "@angular/core/testing";

import { FloorTable } from "./floor-table";

describe("FloorTable", () => {
  let component: FloorTable;
  let fixture: ComponentFixture<FloorTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloorTable],
    }).compileComponents();

    fixture = TestBed.createComponent(FloorTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
