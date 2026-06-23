// Card — 卡片容器组件
// 纯白极简主题
import { type ReactNode } from 'react';

export type CardVariant = 'default' | 'subtle' | 'emerald' | 'flat';

interface CardProps {
  variant?: CardVariant;
  title?: string;
  subtitle?: string;
  icon?: string | ReactNode;
  children?: ReactNode;
  className?: string;
  padding?: boolean;
  hover?: boolean;
  style?: React.CSSProperties;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'card',
  subtle: 'card-subtle',
  emerald: 'card-emerald',
  flat: 'card-flat',
};

export function Card({
  variant = 'default',
  title,
  subtitle,
  icon,
  children,
  className = '',
  padding = true,
  hover = true,
  style,
}: CardProps) {
  return (
    <div
      className={`${VARIANT_CLASSES[variant]} ${hover ? 'hover:shadow-card-hover' : ''} ${padding ? 'p-5' : ''} ${className}`}
      style={style}
    >
      {(title || subtitle || icon) && (
        <div className="flex items-center gap-3 mb-4">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg text-emerald-600 flex-shrink-0">
              {typeof icon === 'string' ? icon : icon}
            </div>
          )}
          <div className="min-w-0">
            {title && <h3 className="font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="text-ink">{children}</div>
    </div>
  );
}

Card.Header = function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
};

Card.Body = function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
};

Card.Footer = function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-4 pt-4 border-t border-border flex items-center justify-between gap-4 ${className}`}>
      {children}
    </div>
  );
};
