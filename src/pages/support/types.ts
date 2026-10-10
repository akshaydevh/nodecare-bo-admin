export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type Priority = 'low' | 'normal' | 'high';
export type Category = 'booking' | 'payment' | 'medical' | 'account' | 'other';

export type TicketReply = {
  from: 'patient' | 'support';
  authorName: string;
  body: string;
  at: string;
};

export type Ticket = {
  id: string;
  ticketId: string;
  userId: string;
  category: Category;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: Priority;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { name: string | null; phone: string | null };
  replies: TicketReply[];
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  booking: 'Booking',
  payment: 'Payment',
  medical: 'Medical',
  account: 'Account',
  other: 'Other',
};
