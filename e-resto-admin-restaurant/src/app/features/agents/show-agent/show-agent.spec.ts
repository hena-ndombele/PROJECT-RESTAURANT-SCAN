import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ShowAgent } from "./show-agent";

describe("ShowAgent", () => {
  let component: ShowAgent;
  let fixture: ComponentFixture<ShowAgent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowAgent],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowAgent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
