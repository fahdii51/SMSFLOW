export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  password_hash: string;
  is_verified: boolean;
  otp_code?: string;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number; // in PKR
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number; // in PKR
  type: 'credit' | 'debit';
  description: string;
  payment_method?: string;
  txn_id?: string;
  created_at: string;
  updated_at: string;
  created_by_id?: string;
}

export type ActivationStatus = 'waiting' | 'code_received' | 'completed' | 'cancelled';

export interface Activation {
  id: string;
  service: string;
  service_name: string;
  activation_id: string;
  phone_number: string;
  cost_usd: number;
  selling_price: number; // in PKR
  status: ActivationStatus;
  otp_code?: string;
  otp_received?: boolean;
  provider: 'smsbower' | 'vsimpro';
  token: string;
  short_url?: string;
  created_at: string;
  updated_at: string;
  created_by_id: string;
}

export interface MailActivation {
  id: string;
  service: string;
  service_name: string;
  mail_id: string;
  mail_address: string;
  domain: string;
  cost_usd: number;
  selling_price: number; // in PKR
  status: ActivationStatus;
  code?: string;
  otp_received?: boolean;
  token: string;
  created_at: string;
  updated_at: string;
  created_by_id: string;
}

export interface FacebookId {
  id: string;
  uid: string;
  password: string;
  status: 'available' | 'sold';
  sold_to_id?: string;
  sold_date?: string;
  price: number; // default 32 PKR
  created_at: string;
  updated_at: string;
  created_by_id: string;
}

export interface DepositRequest {
  id: string;
  user_id: string;
  amount: number; // min 50 PKR
  method: string;
  txn_id: string;
  screenshot_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  created_by_id: string;
}

export interface Service {
  id: string;
  service_code: string;
  service_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface CountryConfig {
  name: string;
  provider: 'smsbower' | 'vsimpro';
  countryId: number;
  providerId?: number; // for SMSBOWER e.g. 3228
  maxPrice: number; // SMSBOWER is USD, VSIMPro is PKR
  sell: number; // selling price in PKR
}

export interface DashboardStats {
  totalClients: number;
  totalActivations: number;
  revenue: number;
  providerBalanceUsd?: number;
  providerBalancePkr?: number;
  recentActivations: (Activation & { clientName: string })[];
}
