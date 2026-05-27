import { ComponentFixture, TestBed } from "@angular/core/testing";

import { UpdateTable } from "./update-table";

describe("UpdateTable", () => {
  let component: UpdateTable;
  let fixture: ComponentFixture<UpdateTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateTable],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
