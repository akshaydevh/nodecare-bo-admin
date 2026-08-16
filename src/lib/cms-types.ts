export type CmsDestination =
  | { type: 'none' }
  | { type: 'screen'; value: 'book_appointment' | 'ambulance' | 'caretaker' | 'diagnostics' | 'pharmacy' }
  | { type: 'doctor'; id: string }
  | { type: 'speciality'; id: string }
  | { type: 'lab_package'; id: string }
  | { type: 'pharmacy_category'; id: string }
  | { type: 'external_url'; url: string };

export type CarouselSlide = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  imageKey?: string | null;
  altText?: string | null;
  destination: CmsDestination;
  linkUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  publishAt?: string | null;
  unpublishAt?: string | null;
  updatedAt?: string;
};

export type FeaturedCard = {
  id: string;
  headline: string;
  caption?: string | null;
  imageUrl: string;
  imageKey?: string | null;
  altText?: string | null;
  destination: CmsDestination;
  backgroundStart?: string | null;
  backgroundEnd?: string | null;
  sortOrder: number;
  isActive: boolean;
  publishAt?: string | null;
  unpublishAt?: string | null;
  updatedAt?: string;
};

export type ServiceShortcut = {
  id: string;
  serviceKey: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  imageKey?: string | null;
  destination: CmsDestination;
  availability: 'available' | 'coming_soon' | 'hidden';
  unavailableLabel?: string | null;
  displayVariant: 'half' | 'wide';
  sortOrder: number;
  isActive: boolean;
  updatedAt?: string;
};

export function publicationStatus(item: {
  isActive: boolean;
  publishAt?: string | null;
  unpublishAt?: string | null;
}): 'Disabled' | 'Scheduled' | 'Live' | 'Expired' | 'Draft' {
  if (!item.isActive) return 'Disabled';
  const now = Date.now();
  if (item.publishAt && new Date(item.publishAt).getTime() > now) return 'Scheduled';
  if (item.unpublishAt && new Date(item.unpublishAt).getTime() <= now) return 'Expired';
  return 'Live';
}

export function destinationLabel(d?: CmsDestination | null): string {
  if (!d) return 'None';
  switch (d.type) {
    case 'none':
      return 'None';
    case 'screen':
      return `Screen: ${d.value}`;
    case 'doctor':
      return `Doctor: ${d.id.slice(-6)}`;
    case 'speciality':
      return `Speciality: ${d.id.slice(-6)}`;
    case 'lab_package':
      return `Package: ${d.id.slice(-6)}`;
    case 'pharmacy_category':
      return `Category: ${d.id.slice(-6)}`;
    case 'external_url':
      return d.url;
    default:
      return 'Unknown';
  }
}
