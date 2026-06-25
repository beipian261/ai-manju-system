'use client';
import Link from 'next/link';
import { useState } from 'react';
import { PenTool, Users, Film, Play, Menu, X } from 'lucide-react';

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: PenTool,
      title: '智能剧本',
      description: '输入创意灵感，AI 自动生成结构完整的漫剧剧本，支持多轮修改和风格调整。',
    },
    {
      icon: Users,
      title: '角色一致性',
      description: '创建角色后，AI 在所有场景中保持角色外观和性格的一致性，无需手动逐帧调整。',
    },
    {
      icon: Film,
      title: '一键成片',
      description: '从分镜到配音到合成，AI 自动完成全部后期流程，你只需点击发布。',
    },
  ];

  const stats = [
    { number: '10,000+', label: '创作者' },
    { number: '50,000+', label: '作品生成' },
    { number: '98%', label: '好评率' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', margin: 0, padding: 0, fontFamily: 'var(--font-family)', color: 'var(--color-text)' }}>
      {/* Navigation */}
      <nav
        className="sticky top-0 z-50"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(226,232,240,0.5)',
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6" style={{ padding: '16px 24px' }}>
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: 'var(--gradient-primary)' }}
            >
              <span style={{ color: 'var(--color-hero-text)', fontWeight: 700, fontSize: '16px', lineHeight: 1 }}>A</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-text)' }}>AI 漫剧</span>
          </Link>

          <div className="hidden sm:flex items-center gap-6">
            <a
              href="#features"
              className="whitespace-nowrap no-underline transition-colors duration-200"
              style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
            >
              功能
            </a>
            <Link
              href="/dashboard"
              className="whitespace-nowrap no-underline transition-colors duration-200"
              style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
            >
              工作台
            </Link>
            <a
              href="#"
              className="whitespace-nowrap no-underline transition-colors duration-200"
              style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-text)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
            >
              定价
            </a>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center whitespace-nowrap no-underline border-none cursor-pointer transition-all duration-200"
              style={{
                background: 'var(--gradient-primary)',
                color: 'var(--color-hero-text)',
                borderRadius: 'var(--radius-button)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                padding: '8px 16px',
                boxShadow: 'var(--shadow-button)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-button-lg)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-button)';
              }}
            >
              开始使用
            </Link>
          </div>

          <button
            className="sm:hidden p-2 rounded-lg transition-colors"
            style={{ background: mobileMenuOpen ? 'var(--color-bg-subtle)' : 'transparent' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
            ) : (
              <Menu className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div
            className="sm:hidden border-t animate-fade-in"
            style={{ background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', borderColor: 'var(--color-border)' }}
          >
            <div className="px-6 py-3 flex flex-col gap-1">
              <a
                href="#features"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm no-underline"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                功能
              </a>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm no-underline"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                工作台
              </Link>
              <a
                href="#"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm no-underline"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                定价
              </a>
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-white no-underline mt-1"
                style={{ background: 'var(--gradient-primary)' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                开始使用
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main>
        {/* Hero Section */}
        <section
          className="relative flex items-center justify-center"
          style={{ minHeight: '80vh', background: 'var(--gradient-hero)', overflow: 'hidden' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-glow)' }} />
          <div className="relative z-10 text-center max-w-3xl mx-auto" style={{ padding: '0 24px' }}>
            <div
              className="inline-flex items-center justify-center whitespace-nowrap animate-slide-up"
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '6px 16px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 500,
                background: 'var(--color-hero-badge-bg)',
                color: 'var(--color-hero-badge-text)',
                border: '1px solid var(--color-hero-badge-border)',
              }}
            >
              AI 驱动的新一代创作工具
            </div>
            <h1
              className="animate-slide-up stagger-1 text-balance"
              style={{
                marginTop: '24px',
                fontSize: 'clamp(36px, 5vw, 60px)',
                fontWeight: 700,
                color: 'var(--color-hero-text)',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
              }}
            >
              把你的故事变成
              <span
                style={{
                  background: 'linear-gradient(135deg, var(--brand-primary-light), #06B6D4)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                漫剧
              </span>
            </h1>
            <p
              className="animate-slide-up stagger-2"
              style={{
                marginTop: '24px',
                fontSize: '18px',
                color: 'var(--color-hero-text-secondary)',
                maxWidth: '560px',
                marginLeft: 'auto',
                marginRight: 'auto',
                lineHeight: 1.6,
              }}
            >
              从创意到成片，AI 全程辅助。写剧本、创角色、画分镜、合成配音，一站式完成你的漫剧创作。
            </p>
            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up stagger-3"
              style={{ marginTop: '32px' }}
            >
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center whitespace-nowrap border-none cursor-pointer w-full sm:w-auto transition-all duration-200"
                style={{
                  background: 'var(--gradient-primary)',
                  color: 'var(--color-hero-text)',
                  borderRadius: 'var(--radius-button)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 600,
                  padding: '12px 24px',
                  boxShadow: 'var(--shadow-button-lg)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-button-lg)';
                }}
              >
                免费开始创作
              </Link>
              <button
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer w-full sm:w-auto transition-all duration-200"
                style={{
                  background: 'transparent',
                  color: 'var(--color-hero-text-secondary)',
                  border: '1px solid var(--color-hero-outline-border)',
                  borderRadius: 'var(--radius-button)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  padding: '12px 24px',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-hero-outline-hover-border)';
                  e.currentTarget.style.background = 'var(--color-hero-outline-hover-bg)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-hero-outline-border)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Play style={{ width: '16px', height: '16px' }} fill="currentColor" />
                观看演示
              </button>
            </div>
          </div>
        </section>

        <div style={{ height: '80px', background: 'linear-gradient(to bottom, #1E293B 0%, var(--color-bg) 100%)' }} />

        {/* Features Section */}
        <section id="features" style={{ background: 'var(--color-bg)', padding: '96px 24px' }}>
          <div className="max-w-5xl mx-auto">
            <h2
              className="text-center text-balance animate-slide-up"
              style={{
                fontSize: 'clamp(22px, 2.4vw, 32px)',
                fontWeight: 700,
                color: 'var(--color-text)',
                marginBottom: '64px',
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
              }}
            >
              核心能力
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group cursor-default animate-slide-up"
                    style={{
                      background: '#fff',
                      borderRadius: '14px',
                      border: '1px solid var(--color-border)',
                      padding: '32px',
                      boxShadow: 'var(--shadow-card)',
                      transition: 'transform 300ms ease, box-shadow 300ms ease',
                      animationDelay: `${index * 0.1}s`,
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                    }}
                  >
                    <div
                      className="flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--gradient-primary-soft)',
                      }}
                    >
                      <Icon style={{ width: '22px', height: '22px', color: 'var(--brand-primary)' }} />
                    </div>
                    <h3 style={{ marginTop: '20px', marginBottom: '8px', fontSize: '18px', fontWeight: 600, color: 'var(--color-text)' }}>
                      {feature.title}
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.625 }}>
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section style={{ background: 'var(--color-bg-subtle)', padding: '64px 24px' }}>
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10 text-center">
            {stats.map((stat, index) => (
              <div key={stat.label} className="animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                <div
                  style={{
                    fontSize: 'clamp(28px, 3vw, 36px)',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, var(--brand-primary-light), #06B6D4)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {stat.number}
                </div>
                <p style={{ marginTop: '4px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section style={{ padding: '80px 24px', textAlign: 'center' }}>
          <h2
            className="text-balance animate-slide-up"
            style={{
              fontSize: 'clamp(22px, 2.4vw, 32px)',
              fontWeight: 700,
              color: 'var(--color-text)',
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
            }}
          >
            开始你的创作之旅
          </h2>
          <p className="animate-slide-up stagger-1" style={{ marginTop: '8px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            加入万千创作者，用 AI 释放你的创意
          </p>
          <div className="animate-slide-up stagger-2" style={{ marginTop: '24px' }}>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center whitespace-nowrap border-none cursor-pointer transition-all duration-200"
              style={{
                background: 'var(--gradient-primary)',
                color: 'var(--color-hero-text)',
                borderRadius: 'var(--radius-button)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                padding: '12px 24px',
                boxShadow: 'var(--shadow-button-lg)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-button-lg)';
              }}
            >
              免费开始
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--color-border)', padding: '32px 24px' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>&copy; 2026 AI 漫剧系统</span>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="no-underline transition-colors"
              style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
            >
              隐私政策
            </a>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>&middot;</span>
            <a
              href="#"
              className="no-underline transition-colors"
              style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
            >
              服务条款
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
