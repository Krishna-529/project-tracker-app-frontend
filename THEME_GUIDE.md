# Deep Flow Color System

## Overview
Professional, fluid, and soothing design system with off-blacks instead of pure black to prevent eye strain, warm grays, and Electric Indigo accent for energetic yet calm interface.

## Philosophy: "Signal vs. Noise"
- **Noise (Backgrounds)**: Invisible low-saturation "Zinc" tones that absorb light
- **Signal (Content)**: High contrast text, softened (off-white instead of pure white)
- **Action (Accent)**: Electric Indigo (#6366f1) that implies movement and speed

---

## Light Mode: "Crisp Paper Theme"
*Best for daytime clarity - clean architectural paper aesthetic*

| UI Element | Color Name | Hex Code | Usage |
|------------|-----------|----------|-------|
| App Background | Paper White | `#ffffff` | Clean, infinite canvas |
| Active Card/Row | Vapor Grey | `#f8fafa` | Subtle cool tint to separate active task |
| Hover State | Wash Grey | `#f1f5f9` | Row highlighting on mouse over |
| Primary Text | Ink Black | `#0f172a` | Deep blue-black, sharper than grey text |
| Secondary Text | Slate Grey | `#64748b` | Professional and calming |
| Borders/Lines | Faint Trace | `#e2e8f0` | Barely visible structure |

---

## Dark Mode: "Deep Focus Theme"
*Best for coding and long work sessions - high-end IDE aesthetic*

| UI Element | Color Name | Hex Code | Usage |
|------------|-----------|----------|-------|
| App Background | Void Grey | `#09090b` | Rich, warm black. Darker than GitHub, softer than OLED |
| Active Card/Row | Surface Grey | `#18181b` | Slight lift for expanded card state |
| Hover State | Ghost Grey | `#27272a` | 50% opacity - subtle highlighting for phantom insert |
| Primary Text | Mist White | `#f4f4f5` | Bright but cuts harsh glare of pure white |
| Secondary Text | Metal Grey | `#a1a1aa` | Descriptions, dates, folder lines |
| Borders/Lines | Edge Grey | `#27272a` | Very faint indentation guide lines |

---

## Accent Colors: "Electric & Fluid"
*Use sparingly for maximum impact*

### Primary Accent
**Electric Indigo** `#6366f1` - HSL: `239 84% 67%`
- **Use for**: Active cursor, Save button, checked checkboxes, Scale Up focus ring
- **Why**: Between Blue (Professional) and Purple (Creative). Vibrates against dark backgrounds for "fast" feel

### Status Colors (Muted for Calmness)
- **Success (Done)**: Emerald `#10b981` - Completed checkboxes
- **Warning (Due Soon)**: Amber `#f59e0b` - Deadline badges
- **Tag Badge Background**: 
  - Light: Light Indigo `#e0e7ff`
  - Dark: Dark Indigo `#312e81`

---

## Implementation Notes

### CSS Variables (HSL Format)
All colors are defined in `src/index.css` using HSL values for easy manipulation.

### Tailwind Integration
Colors are mapped in `tailwind.config.ts` using `hsl(var(--variable-name))` pattern.

### Theme Toggle
`ThemeToggle` component provides one-click switching with:
- System preference detection
- LocalStorage persistence
- Smooth icon transitions

### Motion Tokens
- `--transition-fast`: 80ms - Quick micro-interactions
- `--transition-base`: 120ms - Standard transitions
- `--transition-smooth`: 150ms - Deliberate state changes

---

## Usage Examples

```tsx
// Primary action button
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Save
</button>

// Success indicator
<div className="bg-success text-success-foreground">
  Task completed
</div>

// Tag badge
<span className="bg-tag-bg text-tag-fg px-2 py-1 rounded">
  Important
</span>

// Hover surface
<div className="hover:bg-hover-surface transition-colors">
  Interactive row
</div>
```

---

## Accessibility

- **Contrast Ratios**: All text meets WCAG AA standards
- **Focus Rings**: Electric Indigo with 2px offset for keyboard navigation
- **Reduced Motion**: Transitions respect `prefers-reduced-motion`
- **Color Blind Safe**: Primary accent distinguishable in all modes

---

## Dark Mode Toggle

Press the sun/moon icon in the top-right header to switch themes. Preference is saved automatically.
