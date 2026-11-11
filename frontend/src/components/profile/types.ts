import type { ProviderCredentialStatus, ProviderId } from "../../types";

export interface ProfileViewProps {
  onBack: () => void;
}

export interface ProviderRowProps {
  item: ProviderCredentialStatus;
  index: number;
  total: number;
  label: string;
  can_manage: boolean;
  busy: boolean;
  ordering: boolean;
  api_key: string;
  on_key_change: (value: string) => void;
  on_save: () => void;
  on_remove: () => void;
  on_move: (direction: -1 | 1) => void;
}

export type ProviderLabels = Record<ProviderId, string>;
