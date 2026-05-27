import { ComponentFixture, TestBed } from "@angular/core/testing";

import { UpdateRole } from "./update-role";

describe("UpdateRole", () => {
  let component: UpdateRole;
  let fixture: ComponentFixture<UpdateRole>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateRole],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateRole);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
