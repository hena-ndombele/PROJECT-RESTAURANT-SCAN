import { ComponentFixture, TestBed } from "@angular/core/testing";

import { DeleteFeedback } from "./delete-feedback";

describe("DeleteFeedback", () => {
  let component: DeleteFeedback;
  let fixture: ComponentFixture<DeleteFeedback>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteFeedback],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteFeedback);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
