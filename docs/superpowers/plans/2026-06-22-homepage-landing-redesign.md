# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the homepage from a mixed hero+form page into a pure marketing landing page that showcases product value and drives users to Dashboard.

**Architecture:** Single-file change to `src/app/page.tsx`. Remove creation form and genre/style data, replace with 5 sections: Nav, Hero, 4-step Pipeline, 2×2 Feature Grid, Bottom CTA + Footer. Reuses existing CSS utility classes from `globals.css`.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS, TypeScript, existing CSS component classes.

---

### Task 1: Rewrite `src/app/page.tsx` — Full Landing Page

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)

- [ ] **Step 1: Remove old imports and data, write new component**

Replace the entire file content. Remove: `genreOptions`, `styleOptions`, `useState`, `createProject` handler, form JSX.

Write new layout with 5 sections:

```tsx
'use client';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ===== Nav ===== */}
      <nav className="flex items-center justify-between max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600" />
          <span className="font-bold text-ink text-base">AI 漫剧</span>
        </div>
        <Link href="/dashboard" className="btn-primary text-sm py-2 px-5">
          🎬 开始创作
        </Link>
      </nav>

      {/* ===== Hero ===== */}
      <section className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 text-center overflow-hidden">
        {/* Decorative circle */}
        <div className="absolute -top-20 right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-emerald-500/8 to-emerald-500/3 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-gradient-to-tr from-emerald-400/6 to-emerald-500/3 blur-3xl pointer-events-none" />

        <div className="relative">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ink leading-tight mb-4 animate-slide-up">
            用 AI，把你的<br className="md:hidden" />
            <span className="text-gradient">故事变成漫剧</span>
          </h1>
          <p className="text-base md:text-lg text-ink-secondary max-w-lg mx-auto mb-10 animate-slide-up stagger-1">
            从创意到成片，一站式 AI 创作平台
          </p>
          <Link
            href="/dashboard"
            className="btn-primary btn-lg inline-flex animate-slide-up stagger-2"
          >
            🎬 免费开始创作 →
          </Link>
        </div>
      </section>

      {/* ===== 4-Step Pipeline ===== */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-center text-2xl font-bold text-ink mb-2 animate-slide-up">
          从灵感到成片，只需四步
        </h2>
        <p className="text-center text-sm text-ink-secondary mb-10 animate-slide-up stagger-1">
          AI 帮你完成从创意到发布的全部流程
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { num: '01', emoji: '🖊️', title: '写故事', desc: '输入创意灵感，AI 自动生成完整剧本' },
            { num: '02', emoji: '🎭', title: '创角色', desc: '设计角色形象，AI 保持跨场景一致性' },
            { num: '03', emoji: '🎬', title: '画分镜', desc: '智能拆解场景，自动生成画面分镜' },
            { num: '04', emoji: '🎞️', title: '生成作品', desc: '合成视频配音，一键发布多平台' },
          ].map((step, i) => (
            <div
              key={step.num}
              className="card p-6 text-center hover:border-emerald-100 hover:shadow-card-hover transition-all duration-300 group animate-slide-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm mx-auto mb-4 group-hover:scale-110 transition-transform">
                {step.num}
              </div>
              <div className="text-3xl mb-3">{step.emoji}</div>
              <h3 className="font-bold text-ink mb-1.5">{step.title}</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Feature Grid ===== */}
      <section className="bg-[#FAFAFA] py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-center text-2xl font-bold text-ink mb-2 animate-slide-up">
            ✨ 核心功能
          </h2>
          <p className="text-center text-sm text-ink-secondary mb-10 animate-slide-up stagger-1">
            让你的创作流程更轻松
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                emoji: '🤖',
                title: 'AI 剧本工坊',
                desc: '输入创意灵感，AI 自动生成结构完整的剧本，支持多轮修改和风格定制。',
              },
              {
                emoji: '🎯',
                title: '角色一致性',
                desc: 'AI 自动保持角色外貌、服装、气质在不同场景中的统一，告别角色「变脸」。',
              },
              {
                emoji: '🎬',
                title: 'AI 导演模式',
                desc: '智能分析每个场景，给出构图、镜头角度、色调建议，提升画面表现力。',
              },
              {
                emoji: '📤',
                title: '多平台发布',
                desc: '一键导出适配抖音、Bilibili 等主流平台的视频格式，省去手动调整的麻烦。',
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="card p-6 hover:border-emerald-100 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 group animate-slide-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex-shrink-0 mt-1 group-hover:scale-110 transition-transform" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{feature.emoji}</span>
                      <h3 className="font-bold text-ink text-base">{feature.title}</h3>
                    </div>
                    <p className="text-sm text-ink-secondary leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Bottom CTA ===== */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-12 border border-emerald-100 animate-slide-up">
          <div className="text-4xl mb-4">💪</div>
          <h2 className="text-2xl font-bold text-ink mb-2">准备好了吗？</h2>
          <p className="text-base text-ink-secondary mb-8">开始创作你的第一部 AI 漫剧</p>
          <Link href="/dashboard" className="btn-primary btn-lg inline-flex">
            ✨ 立即开始创作 →
          </Link>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border py-6 text-center">
        <p className="text-xs text-ink-muted">© 2026 AI 漫剧系统</p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npx next build` (or `npm run build`)
Expected: No TypeScript or build errors. Page compiles successfully.

- [ ] **Step 3: Visual check — reload the homepage**

Run the dev server (`npm run dev`), open `http://localhost:3000`
Check:
- Hero section: title has gradient on second line, decorative circles visible (very subtle), CTA button works
- 4-step pipeline: 4 cards in a row on desktop, stacked on mobile, hover effects work
- Feature grid: 2×2 layout, emerald dot on left of each card, hover lift effect
- Bottom CTA: gradient background box, button clickable
- Footer: copyright text visible
- Overall: white clean design, animations smooth

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: redesign homepage as marketing landing page"
```
