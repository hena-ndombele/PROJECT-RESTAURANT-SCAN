import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CreateAgent } from "./create-agent";

describe("CreateAgent", () => {
  let component: CreateAgent;
  let fixture: ComponentFixture<CreateAgent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateAgent],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateAgent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
