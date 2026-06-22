import { ComponentFixture, TestBed } from "@angular/core/testing";

import { DeleteOrder } from "./delete-order";

describe("DeleteOrder", () => {
  let component: DeleteOrder;
  let fixture: ComponentFixture<DeleteOrder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteOrder],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteOrder);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
