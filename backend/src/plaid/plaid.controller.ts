import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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

  @Get('accounts')
  async getAccounts() {
    return this.plaidService.getAccounts();
  }

  @Get('transactions')
  async getTransactions(@Query('accountId') accountId?: string) {
    return this.plaidService.getTransactions(accountId);
  }

  @Post('refresh-balances')
  async refreshBalances(@Body('access_token') accessToken: string) {
    await this.plaidService.refreshBalances(accessToken);
    return { success: true };
  }
}
