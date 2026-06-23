// Badge — 徽章组件
// 纯白极简主题
import { type ReactNode } from 'react';

export type BadgeVariant = 'emerald' | 'zinc' | 'amber' | 'blue' | 'purple' | 'red' | 'pink' | 'green' | 'sky';

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  emerald: 'badge-emerald',
  zinc: 'badge-zinc',
  amber: 'badge-amber',
  blue: 'badge-blue',
  purple: 'badge-purple',
  red: 'badge-red',
  pink: 'badge-pink',
  green: 'badge-green',
  sky: 'badge-blue',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ variant = 'zinc', children, className = '', dot = false }: BadgeProps) {
  return (
    <span className={`badge ${VARIANT_STYLES[variant]} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
      {children}
    </span>
  );
}
