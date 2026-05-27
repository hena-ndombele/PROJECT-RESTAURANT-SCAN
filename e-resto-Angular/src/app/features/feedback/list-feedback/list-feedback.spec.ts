import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ListFeedback } from "./list-feedback";

describe("ListFeedback", () => {
  let component: ListFeedback;
  let fixture: ComponentFixture<ListFeedback>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListFeedback],
    }).compileComponents();

    fixture = TestBed.createComponent(ListFeedback);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
