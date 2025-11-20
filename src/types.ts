
export type UserRole = 'admin' | 'funcionario' | 'cliente';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  active: boolean;
  avatar_url?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  created_at: string;
  user_id?: string; // To link to a specific user profile if needed
}

export interface Project {
  id: string;
  name: string;
  address: string;
  city: string;
  client_id: string;
  start_date: string;
  end_date_prediction: string;
  status: 'aberta' | 'concluida' | 'pausada';
  description?: string;
  created_at: string;
  client?: Client;
  // Financial fields
  total_value?: number;
  amount_received?: number;
}

export interface ProjectAssignment {
  id: string;
  project_id: string;
  user_id: string;
  assigned_at: string;
}

export interface Expense {
  id: string;
  project_id: string;
  user_id: string;
  type: 'alimentacao' | 'transporte' | 'outros';
  amount: number;
  date: string;
  description: string;
  receipt_url?: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  created_at: string;
  profile?: Profile;
}

export interface Material {
  id: string;
  project_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  name: string;
  url: string;
  type: string;
  created_at: string;
}

// Project specific chat
export interface ChatMessage {
  id: string;
  project_id: string;
  user_id: string;
  message: string;
  attachment_url?: string;
  created_at: string;
  profile?: Profile;
}

// Global App Chat
export interface AppChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string | null; // null means General channel
  message: string;
  read: boolean;
  created_at: string;
  sender?: Profile;
}

export interface Log {
  id: string;
  user_id: string;
  action: string;
  details: string;
  created_at: string;
  profile?: Profile;
}
