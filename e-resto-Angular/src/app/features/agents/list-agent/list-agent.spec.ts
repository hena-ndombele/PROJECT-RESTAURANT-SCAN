import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ListAgent } from "./list-agent";

describe("ListAgent", () => {
  let component: ListAgent;
  let fixture: ComponentFixture<ListAgent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListAgent],
    }).compileComponents();

    fixture = TestBed.createComponent(ListAgent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
