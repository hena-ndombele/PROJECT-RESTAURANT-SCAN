import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ShowDish } from "./show-dish";

describe("ShowDish", () => {
  let component: ShowDish;
  let fixture: ComponentFixture<ShowDish>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowDish],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowDish);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
