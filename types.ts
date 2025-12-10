
export type UserRole = 'admin' | 'eletricista' | 'cliente' | 'engenheiro' | 'arquiteto';

export interface User {
  id: string;
  name: string;
  email?: string; // Email optional for internal staff (Technical Managers)
  role: UserRole;
  avatar_url?: string;
}

export type ProjectStatus = 'planejamento' | 'em_andamento' | 'concluido' | 'pausado';

export interface Project {
  id: string;
  nome: string;
  cliente_nome: string;
  endereco: string;
  data_inicio: string;
  data_prevista_fim: string;
  status: ProjectStatus;
  responsavel_id: string;
  equipe_ids: string[]; // List of IDs of electricians assigned
  progresso: number;
  valor_contrato?: number; // Valor total cobrado do cliente
}

export interface ProjectMaterial {
  id: string;
  project_id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  valor_estimado?: number; // Only visible to admin
}

export type DocumentType = 'planta' | 'contrato' | 'art' | 'foto' | 'outro';

export interface ProjectDocument {
  id: string;
  project_id: string;
  nome: string;
  url: string; // Mock url
  tipo: DocumentType;
  uploaded_by: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  tipo_chat: 'global' | 'obra' | 'private';
  obra_id?: string;
  user_id: string;
  recipient_id?: string; // For private messages
  user_name: string;
  mensagem: string;
  created_at: string;
  read_at?: string | null; // Timestamp when message was read
  is_me?: boolean;
}

export type ChecklistFieldType = 'text' | 'number' | 'boolean' | 'options';

export interface ChecklistItemTemplate {
  id: string;
  titulo: string;
  tipo_campo: ChecklistFieldType;
  obrigatorio: boolean;
  opcoes?: string[];
}

export interface ChecklistTemplate {
  id: string;
  nome: string;
  descricao: string;
  itens: ChecklistItemTemplate[];
}

export interface Checklist {
  id: string;
  template_id: string;
  template_nome: string;
  obra_id: string;
  obra_nome: string;
  data_referencia: string;
  responsavel_id: string;
  responsavel_nome: string;
  status: 'pendente' | 'concluido';
  respostas: Record<string, any>;
}

export interface FinanceEntry {
  id: string;
  obra_id: string;
  user_id: string; // Who created the entry
  tipo: 'receita' | 'despesa';
  categoria: string;
  valor: number;
  data: string;
  observacao?: string;
}