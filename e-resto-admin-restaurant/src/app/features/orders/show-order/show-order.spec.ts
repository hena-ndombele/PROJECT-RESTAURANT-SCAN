import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ShowOrder } from "./show-order";

describe("ShowOrder", () => {
  let component: ShowOrder;
  let fixture: ComponentFixture<ShowOrder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowOrder],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowOrder);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
