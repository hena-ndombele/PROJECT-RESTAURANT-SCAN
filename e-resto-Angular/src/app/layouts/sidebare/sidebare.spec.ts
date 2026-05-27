import { ComponentFixture, TestBed } from "@angular/core/testing";

import { Sidebare } from "./sidebare";

describe("Sidebare", () => {
  let component: Sidebare;
  let fixture: ComponentFixture<Sidebare>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sidebare],
    }).compileComponents();

    fixture = TestBed.createComponent(Sidebare);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
