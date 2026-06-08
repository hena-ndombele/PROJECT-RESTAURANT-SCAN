import { ComponentFixture, TestBed } from "@angular/core/testing";

import { DeleteAgent } from "./delete-agent";

describe("DeleteAgent", () => {
  let component: DeleteAgent;
  let fixture: ComponentFixture<DeleteAgent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteAgent],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteAgent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
