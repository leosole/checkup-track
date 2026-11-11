import type { ShareCreated, ShareGroup } from "../../types";

export type CopyTarget = "code" | "link";

export interface CreatedCodeProps {
  created: ShareCreated;
  copied: CopyTarget | null;
  on_copy: (value: string, target: CopyTarget) => void;
  on_dismiss: () => void;
}

export interface SelectionItem {
  id: number;
  label: string;
  hint: string;
}

export interface SelectionCardProps {
  title: string;
  /** Singular noun used in the "n of m" selection summary. */
  unit: string;
  items: SelectionItem[];
  selected: Set<number>;
  all_selected: boolean;
  empty_hint: string;
  on_toggle: (id: number) => void;
  on_toggle_all: () => void;
}

export interface GroupListProps {
  groups: ShareGroup[];
  loading: boolean;
  sharing_group_key: string | null;
  revoking_id: number | null;
  can_revoke: boolean;
  on_share_again: (group: ShareGroup) => void;
  on_revoke: (code_id: number) => void;
}
