import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ListTable } from "./list-table";

describe("ListTable", () => {
  let component: ListTable;
  let fixture: ComponentFixture<ListTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListTable],
    }).compileComponents();

    fixture = TestBed.createComponent(ListTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
