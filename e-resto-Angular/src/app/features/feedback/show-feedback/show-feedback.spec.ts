import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ShowFeedback } from "./show-feedback";

describe("ShowFeedback", () => {
  let component: ShowFeedback;
  let fixture: ComponentFixture<ShowFeedback>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowFeedback],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowFeedback);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
