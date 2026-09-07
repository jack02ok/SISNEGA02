## 2025-09-07 - Improved Sidebar Keyboard & Screen Reader Accessibility
**Learning:** Dynamic sidebars often lack ARIA attributes and focus styles indicating their structure or which item is active, leading to poor keyboard and screen reader experiences.
**Action:** Always add `aria-label` to `<nav>` elements, `aria-current="page"` on active navigation items, `aria-hidden="true"` on purely decorative icons, and explicit `focus-visible` utility classes for clear keyboard navigation cues.
