import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CreateDish } from "./create-dish";

describe("CreateDish", () => {
  let component: CreateDish;
  let fixture: ComponentFixture<CreateDish>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateDish],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateDish);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
