import { ComponentFixture, TestBed } from "@angular/core/testing";

import { DeleteCategory } from "./delete-category";

describe("DeleteCategory", () => {
  let component: DeleteCategory;
  let fixture: ComponentFixture<DeleteCategory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteCategory],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteCategory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
