import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PlaidService } from './plaid.service';

@Controller()
export class PlaidController {
  constructor(private readonly plaidService: PlaidService) {}

  @Post('plaid/link-token')
  async createLinkToken(@Body('userId') userId: string) {
    const linkToken = await this.plaidService.createLinkToken(userId || 'default-user');
    return { link_token: linkToken };
  }

  @Post('plaid/exchange-token')
  async exchangeToken(
    @Body('public_token') publicToken: string,
    @Body('institution_name') institutionName: string,
  ) {
    await this.plaidService.exchangePublicToken(publicToken, institutionName || 'Unknown');
    return { success: true };
  }

  @Post('plaid/sync')
  async sync() {
    return this.plaidService.syncAll();
  }

  @Post('plaid/sandbox/refresh/:plaidItemId')
  async sandboxRefresh(@Param('plaidItemId') plaidItemId: string) {
    return this.plaidService.sandboxRefresh(plaidItemId);
  }

  @Post('plaid/sandbox/create-transaction/:plaidItemId')
  async sandboxCreateTransactions(@Param('plaidItemId') plaidItemId: string) {
    return this.plaidService.sandboxCreateTransactions(plaidItemId);
  }

  @Get('plaid/items')
  async getItems() {
    return this.plaidService.getItems();
  }

  @Delete('plaid/items/:id')
  async deleteItem(@Param('id') id: string) {
    await this.plaidService.deleteItem(id);
    return { success: true };
  }

  @Get('accounts')
  async getAccounts() {
    return this.plaidService.getAccounts();
  }

  @Get('transactions')
  async getTransactions(@Query('accountId') accountId?: string) {
    return this.plaidService.getTransactions(accountId);
  }

  @Patch('accounts/:id')
  async updateAccount(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      currentBalance?: number;
      availableBalance?: number | null;
      apr?: number | null;
      minimumPayment?: number | null;
      dueDayOfMonth?: number | null;
    },
  ) {
    return this.plaidService.updateAccount(id, body);
  }
}
