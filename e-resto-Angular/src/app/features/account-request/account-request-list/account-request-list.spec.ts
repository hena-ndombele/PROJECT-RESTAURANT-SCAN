import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AccountRequestList } from "./account-request-list";

describe("AccountRequestList", () => {
  let component: AccountRequestList;
  let fixture: ComponentFixture<AccountRequestList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountRequestList],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountRequestList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
