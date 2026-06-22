import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CreateRole } from "./create-role";

describe("CreateRole", () => {
  let component: CreateRole;
  let fixture: ComponentFixture<CreateRole>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateRole],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateRole);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
