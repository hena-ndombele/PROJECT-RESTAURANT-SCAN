import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CreateTable } from "./create-table";

describe("CreateTable", () => {
  let component: CreateTable;
  let fixture: ComponentFixture<CreateTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateTable],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
