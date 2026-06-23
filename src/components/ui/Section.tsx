// Section — 页面区块组件
// 纯白极简主题
import { type ReactNode } from 'react';

interface SectionProps {
  title?: string;
  subtitle?: string;
  icon?: string | ReactNode;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Section({
  title,
  subtitle,
  icon,
  description,
  actions,
  children,
  className = '',
  noPadding = false,
}: SectionProps) {
  return (
    <section className={`${className}`}>
      {(title || subtitle || icon || actions || description) && (
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xl text-emerald-600 flex-shrink-0">
                {typeof icon === 'string' ? icon : icon}
              </div>
            )}
            <div>
              {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
              {(subtitle || description) && (
                <p className="text-sm text-ink-muted mt-0.5">{subtitle || description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
