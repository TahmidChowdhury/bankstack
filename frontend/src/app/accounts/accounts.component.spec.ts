import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AccountsComponent } from './accounts.component';
import { ApiService, Account } from '../services/api.service';

describe('AccountsComponent', () => {
  let component: AccountsComponent;
  let apiServiceSpy: jasmine.SpyObj<ApiService>;

  const baseCreditAccount: Account = {
    id: 'acc-1',
    plaidAccountId: 'plaid-acc-1',
    name: 'Test Card',
    type: 'credit',
    subtype: 'credit card',
    institution: 'Test Bank',
    currentBalance: 500,
    availableBalance: 1500,
    creditLimit: 2000,
    minimumPayment: 25,
    dueDayOfMonth: 15,
    apr: 18.99,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    apiServiceSpy = jasmine.createSpyObj<ApiService>('ApiService', ['getAccounts', 'updateAccount']);
    apiServiceSpy.getAccounts.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [AccountsComponent],
      providers: [{ provide: ApiService, useValue: apiServiceSpy }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AccountsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('derives available credit from credit limit and current balance', () => {
    component.editForm.currentBalance = 640.55;
    component.editForm.creditLimit = 2000;

    expect(component.getDerivedAvailableCredit()).toBe(1359.45);
  });

  it('saves credit accounts with derived availableBalance', () => {
    component.accounts = [baseCreditAccount];
    component.editForm = {
      name: baseCreditAccount.name,
      currentBalance: 900,
      availableBalance: 9999,
      creditLimit: 2500,
      apr: baseCreditAccount.apr,
      minimumPayment: baseCreditAccount.minimumPayment,
      dueDayOfMonth: baseCreditAccount.dueDayOfMonth,
    };

    const returnedAccount: Account = {
      ...baseCreditAccount,
      currentBalance: 900,
      creditLimit: 2500,
      availableBalance: 1600,
    };

    apiServiceSpy.updateAccount.and.returnValue(of(returnedAccount));

    component.saveEdit(baseCreditAccount);

    expect(apiServiceSpy.updateAccount).toHaveBeenCalled();
    const [, payload] = apiServiceSpy.updateAccount.calls.mostRecent().args;
    expect(payload.availableBalance).toBe(1600);
  });
});
