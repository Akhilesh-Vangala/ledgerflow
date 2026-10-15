// Mirrors the API contracts in LedgerFlow.Application. Dates arrive as ISO strings.

export type Role = 'Clerk' | 'Approver' | 'Controller';
export type InvoiceStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Scheduled' | 'Paid';
export type PaymentRunStatus = 'Draft' | 'Released' | 'Cancelled';

export interface Me {
  email: string;
  displayName: string;
  roles: Role[];
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Vendor {
  id: number;
  name: string;
  taxId: string;
  email: string;
  category: string;
  paymentTermsDays: number;
  isActive: boolean;
  openBalance: number;
  openInvoices: number;
  rowVersion: string;
}

export interface SaveVendor {
  name: string;
  taxId: string;
  email: string;
  category: string;
  paymentTermsDays: number;
  rowVersion?: string | null;
}

export interface InvoiceSummary {
  id: number;
  invoiceNumber: string;
  vendorId: number;
  vendorName: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  outstanding: number;
  status: InvoiceStatus;
  isOverdue: boolean;
  createdBy: string | null;
  paymentRunId: number | null;
}

export interface InvoiceLine {
  id?: number;
  description: string;
  glAccount: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
}

export interface InvoiceEvent {
  type: string;
  actor: string;
  comment: string | null;
  occurredAt: string;
}

export interface InvoiceDetail {
  summary: InvoiceSummary;
  subtotal: number;
  taxAmount: number;
  notes: string | null;
  lines: InvoiceLine[];
  events: InvoiceEvent[];
  allowedActions: string[];
  rowVersion: string;
}

export interface SaveInvoice {
  vendorId: number;
  invoiceNumber: string;
  invoiceDate: string;
  taxAmount: number;
  notes: string | null;
  lines: InvoiceLine[];
  rowVersion?: string | null;
}

export interface InvoiceQuery {
  status?: InvoiceStatus | '';
  vendorId?: number | null;
  overdue?: boolean | null;
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface PaymentRunSummary {
  id: number;
  name: string;
  paymentDate: string;
  status: PaymentRunStatus;
  total: number;
  paymentCount: number;
  createdBy: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
}

export interface Payment {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  vendorName: string;
  dueDate: string;
  amount: number;
  reference: string | null;
}

export interface PaymentRunDetail {
  summary: PaymentRunSummary;
  payments: Payment[];
}

export interface Dashboard {
  kpis: {
    openPayables: number;
    openInvoices: number;
    overdueAmount: number;
    overdueInvoices: number;
    pendingApprovals: number;
    readyToPay: number;
    paidLast30Days: number;
    averageApprovalHours: number | null;
  };
  aging: { bucket: string; order: number; invoiceCount: number; amount: number }[];
  topVendors: { vendorId: number; vendorName: string; openBalance: number; openInvoices: number }[];
  monthlySpend: { month: string; amount: number; invoiceCount: number }[];
  agingTrend: { date: string; current: number; overdue: number }[];
  statusCounts: { status: InvoiceStatus; count: number }[];
}

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationFeed {
  unreadCount: number;
  items: NotificationItem[];
}

export interface RecurringJob {
  id: string;
  description: string;
  cron: string;
  lastExecution: string | null;
  lastJobState: string | null;
  nextExecution: string | null;
}

export interface ReportDefinition {
  name: string;
  title: string;
  description: string;
  parameters: string[];
}

export interface ReportCapabilities {
  engine: string;
  supportsPdf: boolean;
  interactiveViewer: boolean;
  reports: ReportDefinition[];
}

export interface ReportArchive {
  id: number;
  reportName: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  generatedBy: string;
  generatedAt: string;
}

/** RFC 9457 problem details as produced by the API's exception handler. */
export interface Problem {
  status: number;
  title: string;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
}
