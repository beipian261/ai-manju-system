// Button — 按钮组件
// 纯白极简主题
import { type ReactNode, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim()}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          <span>处理中...</span>
        </>
      ) : (
        <>
          {icon && <span className="text-base">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
