import { ComponentFixture, TestBed } from "@angular/core/testing";

import { DeleteTable } from "./delete-table";

describe("DeleteTable", () => {
  let component: DeleteTable;
  let fixture: ComponentFixture<DeleteTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteTable],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
