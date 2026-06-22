import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ListRole } from "./list-role";

describe("ListRole", () => {
  let component: ListRole;
  let fixture: ComponentFixture<ListRole>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListRole],
    }).compileComponents();

    fixture = TestBed.createComponent(ListRole);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
