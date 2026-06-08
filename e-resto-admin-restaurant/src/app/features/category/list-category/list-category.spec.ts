import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ListCategory } from "./list-category";

describe("ListCategory", () => {
  let component: ListCategory;
  let fixture: ComponentFixture<ListCategory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListCategory],
    }).compileComponents();

    fixture = TestBed.createComponent(ListCategory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
