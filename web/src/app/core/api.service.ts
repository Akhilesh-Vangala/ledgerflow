import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Dashboard, InvoiceDetail, InvoiceQuery, InvoiceSummary, NotificationFeed, Paged, PaymentRunDetail,
  PaymentRunSummary, RecurringJob, ReportArchive, ReportCapabilities, SaveInvoice, SaveVendor, Vendor,
} from './models';

function params(source: object): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && value !== undefined && value !== '') {
      p = p.set(key, String(value));
    }
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  dashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>('/api/dashboard');
  }

  vendors(query: { search?: string; includeInactive?: boolean; page?: number; pageSize?: number }): Observable<Paged<Vendor>> {
    return this.http.get<Paged<Vendor>>('/api/vendors', { params: params(query) });
  }

  vendorCategories(): Observable<string[]> {
    return this.http.get<string[]>('/api/vendors/categories');
  }

  createVendor(body: SaveVendor): Observable<Vendor> {
    return this.http.post<Vendor>('/api/vendors', body);
  }

  updateVendor(id: number, body: SaveVendor): Observable<Vendor> {
    return this.http.put<Vendor>(`/api/vendors/${id}`, body);
  }

  setVendorActive(id: number, active: boolean): Observable<Vendor> {
    return this.http.post<Vendor>(`/api/vendors/${id}/${active ? 'activate' : 'deactivate'}`, {});
  }

  invoices(query: InvoiceQuery): Observable<Paged<InvoiceSummary>> {
    return this.http.get<Paged<InvoiceSummary>>('/api/invoices', { params: params(query) });
  }

  approvalQueue(): Observable<InvoiceSummary[]> {
    return this.http.get<InvoiceSummary[]>('/api/invoices/approval-queue');
  }

  invoice(id: number): Observable<InvoiceDetail> {
    return this.http.get<InvoiceDetail>(`/api/invoices/${id}`);
  }

  createInvoice(body: SaveInvoice): Observable<InvoiceDetail> {
    return this.http.post<InvoiceDetail>('/api/invoices', body);
  }

  updateInvoice(id: number, body: SaveInvoice): Observable<InvoiceDetail> {
    return this.http.put<InvoiceDetail>(`/api/invoices/${id}`, body);
  }

  invoiceAction(id: number, action: 'submit' | 'approve' | 'reject', comment?: string): Observable<InvoiceDetail> {
    return this.http.post<InvoiceDetail>(`/api/invoices/${id}/${action}`, action === 'submit' ? {} : { comment: comment ?? null });
  }

  paymentRuns(): Observable<PaymentRunSummary[]> {
    return this.http.get<PaymentRunSummary[]>('/api/payment-runs');
  }

  paymentRun(id: number): Observable<PaymentRunDetail> {
    return this.http.get<PaymentRunDetail>(`/api/payment-runs/${id}`);
  }

  eligibleInvoices(): Observable<InvoiceSummary[]> {
    return this.http.get<InvoiceSummary[]>('/api/payment-runs/eligible-invoices');
  }

  createPaymentRun(body: { name: string; paymentDate: string; invoiceIds: number[] }): Observable<PaymentRunDetail> {
    return this.http.post<PaymentRunDetail>('/api/payment-runs', body);
  }

  paymentRunAction(id: number, action: 'release' | 'cancel'): Observable<PaymentRunDetail> {
    return this.http.post<PaymentRunDetail>(`/api/payment-runs/${id}/${action}`, {});
  }

  notifications(): Observable<NotificationFeed> {
    return this.http.get<NotificationFeed>('/api/notifications');
  }

  markNotificationRead(id: number): Observable<void> {
    return this.http.post<void>(`/api/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(): Observable<void> {
    return this.http.post<void>('/api/notifications/read-all', {});
  }

  jobs(): Observable<RecurringJob[]> {
    return this.http.get<RecurringJob[]>('/api/jobs');
  }

  triggerJob(id: string): Observable<{ recurringJobId: string; backgroundJobId: string }> {
    return this.http.post<{ recurringJobId: string; backgroundJobId: string }>(`/api/jobs/${id}/trigger`, {});
  }

  reportCapabilities(): Observable<ReportCapabilities> {
    return this.http.get<ReportCapabilities>('/api/reports/capabilities');
  }

  reportArchive(): Observable<ReportArchive[]> {
    return this.http.get<ReportArchive[]>('/api/reports/archive');
  }

  /** Builds a same-origin download URL; the auth cookie authorizes the request. */
  reportUrl(name: string, format: 'csv' | 'pdf', query: Record<string, string | number | null | undefined> = {}): string {
    const qs = params(query).toString();
    return `/api/reports/${name}.${format}${qs ? `?${qs}` : ''}`;
  }

  archiveUrl(id: number): string {
    return `/api/reports/archive/${id}`;
  }
}
