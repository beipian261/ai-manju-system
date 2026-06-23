// Skeleton — 加载骨架屏组件
// 现代深色主题风格
import { type CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  style?: CSSProperties;
}

const ROUNDED_CLASSES = {
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  full: 'rounded-full',
};

export function Skeleton({ className = '', width, height, rounded = 'md', style }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${ROUNDED_CLASSES[rounded]} ${className}`}
      style={{ width, height, ...style }}
    />
  );
}
