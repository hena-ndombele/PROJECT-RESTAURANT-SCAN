import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ApplicationLayout } from "./application-layout";

describe("ApplicationLayout", () => {
  let component: ApplicationLayout;
  let fixture: ComponentFixture<ApplicationLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicationLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
