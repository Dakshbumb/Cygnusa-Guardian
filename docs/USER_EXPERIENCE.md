# 🎨 Cygnusa Guardian - User Experience (15%)

## Overview

Cygnusa Guardian delivers a **premium, modern, and intuitive** user experience for both candidates and recruiters. Key UX principles:

- ✨ **Visual Excellence** - Modern design with animations and micro-interactions
- ⚡ **Performance** - Fast loading with skeleton states and lazy loading
- 📱 **Responsive** - Works on desktop, tablet, and mobile
- ♿ **Accessible** - ARIA labels, keyboard navigation, screen reader support
- 🎯 **Clear Feedback** - Progress indicators, status updates, error handling

---

## 🎯 Design System

### Color Palette

```css
/* Primary Colors - Teal/Cyan */
--primary-400: #2dd4bf;
--primary-500: #14b8a6;
--primary-600: #0d9488;
--primary-700: #0f766e;
--primary-900: #134e4a;

/* Surface Colors - Dark Theme */
--surface-base: #0a0a0a;
--surface-elevated: #171717;
--surface-overlay: #262626;

/* Semantic Colors */
--success-500: #22c55e;
--warning-500: #f59e0b;
--error-500: #ef4444;

/* Text Colors */
--text-primary: #ffffff;
--text-secondary: #a3a3a3;
--text-muted: #525252;
```

### Typography

```css
/* Font Families */
--font-display: 'Plus Jakarta Sans', 'Inter', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Scale */
--text-xs: 0.625rem;   /* 10px */
--text-sm: 0.75rem;    /* 12px */
--text-base: 0.875rem; /* 14px */
--text-lg: 1rem;       /* 16px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
```

---

## 🖼️ UI Components

### 1. Progress Stepper

```
┌─────────────────────────────────────────────────────────────────┐
│                 ENHANCED PROGRESS STEPPER                       │
│                                                                 │
│  ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐          │
│  │  ✓  │────│  ✓  │────│ 3  │────│  4  │────│  5  │          │
│  │     │    │     │    │ 🔵 │    │     │    │     │          │
│  └─────┘    └─────┘    └─────┘    └─────┘    └─────┘          │
│   CODING     MCQ       TEXT      VERIFY    PROFILE           │
│   ✅ Done    ✅ Done   🔵 Active  ○ Next    ○ Next            │
│                                                                 │
│  Features:                                                      │
│  • Numbered steps with visual icons                             │
│  • Connecting lines between steps                               │
│  • Green checkmark for completed steps                          │
│  • Animated pulse effect on active step                         │
│  • Color-coded status (completed/active/pending)               │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Skeleton Loaders

```jsx
// Card Skeleton - Dashboard candidate cards
export function CardSkeleton() {
    return (
        <div className="bg-surface-elevated rounded-xl p-5 space-y-4">
            {/* Avatar + Title */}
            <div className="flex items-center gap-4">
                <Skeleton variant="circle" width={48} height={48} />
                <div className="space-y-2">
                    <Skeleton variant="title" width="60%" />
                    <Skeleton variant="text" width="40%" />
                </div>
            </div>
            
            {/* Content lines */}
            <div className="space-y-2">
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="90%" />
                <Skeleton variant="text" width="70%" />
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-3">
                <Skeleton width={80} height={32} />
                <Skeleton width={80} height={32} />
            </div>
        </div>
    );
}
```

### Available Skeleton Components

| Component | Use Case |
|-----------|----------|
| `Skeleton` | Base shimmer component |
| `CardSkeleton` | Dashboard candidate cards |
| `TableRowSkeleton` | List/table rows |
| `StatsSkeleton` | Dashboard statistics |
| `CandidateRosterSkeleton` | Candidate list loading |
| `DecisionCardSkeleton` | Decision panel loading |
| `CodeEditorSkeleton` | Code editor loading |
| `AssessmentSkeleton` | Full-page assessment loading |

### 3. Animated Decision Cards

```
┌─────────────────────────────────────────────────────────────────┐
│                    DECISION CARD UI                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  👤 John Doe                           ┌────────────┐   │   │
│  │  Software Engineer                      │   HIRE    │   │   │
│  │  Applied 2 days ago                     │  ✅ 85%   │   │   │
│  │                                         └────────────┘   │   │
│  │                                                          │   │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                 │   │
│  │  │ 📄   │  │ 💻   │  │ 📝   │  │ 🔐   │                 │   │
│  │  │ 78%  │  │ 92%  │  │ 70%  │  │ 98%  │                 │   │
│  │  │Resume│  │ Code │  │ MCQ  │  │Integ │                 │   │
│  │  └──────┘  └──────┘  └──────┘  └──────┘                 │   │
│  │                                                          │   │
│  │  📊 Evidence Mapping                                     │   │
│  │  ├── Coding: PRIMARY_DRIVER 🟢                          │   │
│  │  ├── Resume: SUPPORTING 🟡                              │   │
│  │  └── Integrity: NEUTRAL ⚪                              │   │
│  │                                                          │   │
│  │  🔄 Counterfactuals                                      │   │
│  │  "If coding score dropped below 60%, outcome would be    │   │
│  │   CONDITIONAL"                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎬 Animations & Micro-interactions

### Framer Motion Integration

```jsx
import { motion, AnimatePresence } from 'framer-motion';

// Page transitions
<motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
>
    {children}
</motion.div>

// Staggered list animations
<motion.ul
    initial="hidden"
    animate="visible"
    variants={{
        visible: {
            transition: { staggerChildren: 0.1 }
        }
    }}
>
    {items.map(item => (
        <motion.li
            variants={{
                hidden: { opacity: 0, x: -20 },
                visible: { opacity: 1, x: 0 }
            }}
        />
    ))}
</motion.ul>

// Pulse effect for active step
<motion.div
    animate={{ scale: [1, 1.1, 1] }}
    transition={{ duration: 2, repeat: Infinity }}
/>
```

### CSS Animations

```css
/* Shimmer effect for skeletons */
@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

.skeleton {
    background: linear-gradient(
        90deg,
        var(--surface-overlay) 25%,
        var(--surface-elevated) 50%,
        var(--surface-overlay) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}

/* Glow effect for premium cards */
.card-glow {
    box-shadow: 
        0 0 20px rgba(20, 184, 166, 0.1),
        0 0 40px rgba(20, 184, 166, 0.05);
}

/* Text shadow for headers */
.text-shadow-glow {
    text-shadow: 0 0 20px rgba(20, 184, 166, 0.5);
}
```

---

## 📱 Responsive Design

### Breakpoint System

```css
/* Mobile First */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

### Responsive Grid

```jsx
// Dashboard grid - adapts to screen size
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {candidates.map(c => <CandidateCard key={c.id} {...c} />)}
</div>

// Code editor layout - stacks on mobile
<div className="flex flex-col lg:flex-row">
    <div className="w-full lg:w-1/3">Problem Panel</div>
    <div className="w-full lg:w-2/3">Code Editor</div>
</div>
```

---

## 🔔 Feedback & Notifications

### Status Indicators

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATUS INDICATORS                            │
│                                                                 │
│  Webcam Status:                                                 │
│  ┌────────────────────────────────────────────┐                │
│  │ 🟢 ACTIVE  │ 🔴 ERROR │ 🟡 SCANNING │      │                │
│  └────────────────────────────────────────────┘                │
│                                                                 │
│  Face Detection:                                                │
│  ┌────────────────────────────────────────────┐                │
│  │ ✅ MATCH  │ ⚠️ NO_FACE │ 🔴 MULTIPLE │      │                │
│  └────────────────────────────────────────────┘                │
│                                                                 │
│  Submission Status:                                             │
│  ┌────────────────────────────────────────────┐                │
│  │ ⏳ SUBMITTING... │ ✅ SUCCESS │ ❌ ERROR │ │                │
│  └────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### Error Handling

```jsx
// Error display component
function ErrorDisplay({ message, onRetry }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-error-500/20 border border-error-500/50 rounded-lg p-4"
        >
            <div className="flex items-center gap-3">
                <AlertCircle className="text-error-500" />
                <span className="text-error-300">{message}</span>
                {onRetry && (
                    <button onClick={onRetry} className="ml-auto">
                        Retry
                    </button>
                )}
            </div>
        </motion.div>
    );
}
```

---

## 🌙 Dark Theme Design

### Premium Dark Aesthetic

```
┌─────────────────────────────────────────────────────────────────┐
│                    DARK THEME PALETTE                           │
│                                                                 │
│  Background Layers:                                             │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ ██████████ Base (#0a0a0a)                               │    │
│  │ ████████░░ Elevated (#171717)                           │    │
│  │ ██████░░░░ Overlay (#262626)                            │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Accent Colors:                                                │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 🟦 Primary (Teal) - Actions, links, highlights          │    │
│  │ 🟩 Success (Green) - Positive outcomes, confirmations   │    │
│  │ 🟨 Warning (Amber) - Caution, pending states            │    │
│  │ 🟥 Error (Red) - Errors, critical warnings              │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Glassmorphism Effects:                                        │
│  • backdrop-blur-md for overlays                               │
│  • Semi-transparent backgrounds (bg-black/80)                  │
│  • Subtle border glow effects                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⌨️ Keyboard Navigation

### Supported Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Enter` | Submit answer | Assessment |
| `Tab` | Navigate fields | Forms |
| `Escape` | Close modal | Overlays |
| `Ctrl+S` | Save code (blocked) | Code editor |
| `Arrow keys` | Navigate options | MCQ |

---

## 📊 Loading States

### State Progression

```
Initial Load → Skeleton → Data Fetch → Content → Interactive

┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Spinner  │→ │ Skeleton │→ │ Content  │→ │ Active   │
│ (brief)  │  │ (shaped) │  │ (static) │  │ (ready)  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
   <100ms       100-1000ms     Render       User
```

---

## ✅ Evaluation Criteria Alignment (15%)

| Requirement | Implementation | Evidence |
|-------------|---------------|----------|
| Modern design | ✅ Dark theme, glassmorphism | CSS variables |
| Animations | ✅ Framer Motion + CSS | Page transitions |
| Skeleton loaders | ✅ 8 skeleton components | `Skeleton.jsx` |
| Progress indicators | ✅ Enhanced stepper | `CandidateFlow.jsx` |
| Responsive layout | ✅ Mobile-first grid | Tailwind breakpoints |
| Error handling | ✅ Visual feedback | ErrorDisplay component |
| Accessibility | ✅ ARIA labels, keyboard nav | Semantic HTML |
| Premium aesthetics | ✅ Glow effects, gradients | Design system |
