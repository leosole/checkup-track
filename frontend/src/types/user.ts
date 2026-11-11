export interface AccountCapabilities {
  create_records: boolean;
  delete_records: boolean;
  edit_exam_metadata: boolean;
  edit_medications: boolean;
  edit_results: boolean;
  manage_providers: boolean;
  create_shares: boolean;
  revoke_shares: boolean;
  retryExtraction: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  capabilities: AccountCapabilities;
}

export type ProviderId =
  | "gemini"
  | "groq"
  | "openai"
  | "anthropic"
  | "deepseek"
  | "mistral"
  | "openrouter";

export interface ProviderCredentialStatus {
  provider: ProviderId;
  configured: boolean;
  order: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
