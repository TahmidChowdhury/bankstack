import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type PlannedPayment = {
  id: string;
  accountId: string;
  internalAccountId: string;
  accountName: string;
  amount: number;
  date: string;
  type: string;
  source: string | null;
  strategy: string | null;
  status: string;
  createdAt: string;
};

export type CreatePlannedPaymentPayload = {
  accountId: string;
  amount: number;
  date: string;
  type?: string;
  source?: string;
  strategy?: string;
};

@Injectable({
  providedIn: 'root',
})
export class PlannedPaymentsService {
  private readonly baseUrl = 'http://localhost:3000/planned-payments';

  constructor(private http: HttpClient) {}

  create(payload: CreatePlannedPaymentPayload): Observable<PlannedPayment> {
    return this.http.post<PlannedPayment>(this.baseUrl, payload);
  }

  list(): Observable<PlannedPayment[]> {
    return this.http.get<PlannedPayment[]>(this.baseUrl);
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/${id}`);
  }
}
