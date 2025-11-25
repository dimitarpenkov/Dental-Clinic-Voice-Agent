export interface Reservation {
  id: string;
  customerName: string;
  date: string;
  time: string;
  procedure: string;
  phone: string;
  status: 'confirmed' | 'cancelled' | 'pending';
  createdAt: number;
}

export enum ViewState {
  AGENT = 'AGENT',
  DASHBOARD = 'DASHBOARD'
}

export interface AudioVisualizerData {
  volume: number;
}