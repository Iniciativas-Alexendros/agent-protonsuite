export interface CalendarInfo {
  url: string;
  displayName?: string;
  color?: string;
}

export interface CalEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
}
