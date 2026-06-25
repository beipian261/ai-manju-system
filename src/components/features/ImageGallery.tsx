'use client';
// ImageGallery — 全屏图片画廊组件
// 纯白极简主题

import { useState, useEffect, useCallback } from 'react';

interface GalleryImage {
  id: string;
  url: string;
  sceneNum: number;
  title?: string | null;
  description?: string | null;
  qualityScore?: number | null;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  initialIndex?: number;
  onClose: () => void;
}

export default function ImageGallery({ images, initialIndex = 0, onClose }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const current = images[currentIndex];

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) setCurrentIndex(i => i + 1);
  }, [currentIndex, images.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  }, [currentIndex]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goNext, goPrev]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 text-white/80" onClick={e => e.stopPropagation()}>
        <span className="text-sm">
          第 {current.sceneNum} 场 {current.title ? `· ${current.title}` : ''}
          <span className="text-white/40 ml-3">{currentIndex + 1} / {images.length}</span>
        </span>
        <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        <img src={current.url} alt={`场景 ${current.sceneNum}`}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
      </div>

      {/* Bottom info */}
      <div className="flex items-center justify-between px-6 py-4 text-white/60 text-xs" onClick={e => e.stopPropagation()}>
        <div className="flex gap-4">
          <button onClick={goPrev} disabled={currentIndex === 0}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors">
            ← 上一张
          </button>
          <button onClick={goNext} disabled={currentIndex >= images.length - 1}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors">
            下一张 →
          </button>
        </div>
        {current.qualityScore && (
          <span className={current.qualityScore >= 75 ? 'text-emerald-400' : 'text-amber-400'}>
            质量评分: {current.qualityScore}%
          </span>
        )}
      </div>
    </div>
  );
}
