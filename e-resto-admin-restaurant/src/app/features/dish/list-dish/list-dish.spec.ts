import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ListDish } from "./list-dish";

describe("ListDish", () => {
  let component: ListDish;
  let fixture: ComponentFixture<ListDish>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListDish],
    }).compileComponents();

    fixture = TestBed.createComponent(ListDish);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
