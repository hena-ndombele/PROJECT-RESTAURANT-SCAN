import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ShowTable } from "./show-table";

describe("ShowTable", () => {
  let component: ShowTable;
  let fixture: ComponentFixture<ShowTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowTable],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
