import { ComponentFixture, TestBed } from "@angular/core/testing";

import { UpdateAgent } from "./update-agent";

describe("UpdateAgent", () => {
  let component: UpdateAgent;
  let fixture: ComponentFixture<UpdateAgent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateAgent],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateAgent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
