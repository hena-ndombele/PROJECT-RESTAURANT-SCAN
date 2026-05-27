import { ComponentFixture, TestBed } from "@angular/core/testing";

import { UpdateDish } from "./update-dish";

describe("UpdateDish", () => {
  let component: UpdateDish;
  let fixture: ComponentFixture<UpdateDish>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateDish],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateDish);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
