import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AccountRequestDelete } from "./account-request-delete";

describe("AccountRequestDelete", () => {
  let component: AccountRequestDelete;
  let fixture: ComponentFixture<AccountRequestDelete>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountRequestDelete],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountRequestDelete);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
