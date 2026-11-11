import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import type { IconType } from "react-icons";

export type BadgeTone =
  | "gray"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface SpinnerProps {
  className?: string;
}

export interface EmptyStateProps {
  title: string;
  hint?: string;
  icon?: ReactNode;
}

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
}

export interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export type ToastKind = "success" | "error" | "info" | "default";

export interface ToastStyle {
  Icon: IconType;
  wrapper: string;
  icon_class: string;
}

export interface ToastCardProps {
  kind: ToastKind;
  message: string;
  on_close: () => void;
}
