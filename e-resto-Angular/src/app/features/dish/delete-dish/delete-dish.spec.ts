import { ComponentFixture, TestBed } from "@angular/core/testing";

import { DeleteDish } from "./delete-dish";

describe("DeleteDish", () => {
  let component: DeleteDish;
  let fixture: ComponentFixture<DeleteDish>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteDish],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteDish);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
