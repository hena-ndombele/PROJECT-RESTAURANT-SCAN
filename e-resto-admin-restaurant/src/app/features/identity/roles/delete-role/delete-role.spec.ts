import { ComponentFixture, TestBed } from "@angular/core/testing";

import { DeleteRole } from "./delete-role";

describe("DeleteRole", () => {
  let component: DeleteRole;
  let fixture: ComponentFixture<DeleteRole>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteRole],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteRole);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
