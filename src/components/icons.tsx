/** Minimal stroke icon set (currentColor, 1.6 stroke). Keeps the bundle tiny. */
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const S = ({ children, ...p }: P & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    {children}
  </svg>
)

export const IconCursor = (p: P) => (
  <S {...p}>
    <path d="M4 3l7 17 2.5-6.5L20 11z" />
  </S>
)
export const IconHand = (p: P) => (
  <S {...p}>
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1V4.5a1.5 1.5 0 0 1 3 0V12m0-.5V6a1.5 1.5 0 0 1 3 0v6c0 4-2.5 8-7 8s-6-3-7-6l-1.5-3.5a1.6 1.6 0 0 1 2.8-1.5L8 13" />
  </S>
)
export const IconHighlight = (p: P) => (
  <S {...p}>
    <path d="M9 14l-2 5-3 1 1-3 5-2z" />
    <path d="M11 12l6-6 3 3-6 6z" />
    <path d="M4 21h16" />
  </S>
)
export const IconUnderline = (p: P) => (
  <S {...p}>
    <path d="M7 4v6a5 5 0 0 0 10 0V4" />
    <path d="M5 20h14" />
  </S>
)
export const IconStrike = (p: P) => (
  <S {...p}>
    <path d="M5 12h14" />
    <path d="M8 6h8M9 18h6" />
  </S>
)
export const IconPen = (p: P) => (
  <S {...p}>
    <path d="M3 21l3-1 11-11-2-2L4 18z" />
    <path d="M14 6l4 4" />
  </S>
)
export const IconSquare = (p: P) => (
  <S {...p}>
    <rect x="4" y="5" width="16" height="14" rx="1.5" />
  </S>
)
export const IconCircle = (p: P) => (
  <S {...p}>
    <ellipse cx="12" cy="12" rx="8" ry="7" />
  </S>
)
export const IconLine = (p: P) => (
  <S {...p}>
    <path d="M5 19L19 5" />
  </S>
)
export const IconArrow = (p: P) => (
  <S {...p}>
    <path d="M5 19L19 5" />
    <path d="M12 5h7v7" />
  </S>
)
export const IconText = (p: P) => (
  <S {...p}>
    <path d="M5 5h14M12 5v14M9 19h6" />
  </S>
)
export const IconNote = (p: P) => (
  <S {...p}>
    <path d="M5 5h14v10l-4 4H5z" />
    <path d="M15 19v-4h4" />
  </S>
)
export const IconStamp = (p: P) => (
  <S {...p}>
    <path d="M9 3h6l-1 7h3a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3h3z" />
    <path d="M5 21h14M6 17h12v3H6z" />
  </S>
)
export const IconImage = (p: P) => (
  <S {...p}>
    <rect x="4" y="5" width="16" height="14" rx="1.5" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="M4 16l4-3 3 2 4-4 5 5" />
  </S>
)
export const IconRedact = (p: P) => (
  <S {...p}>
    <rect x="4" y="8" width="16" height="8" rx="1" fill="currentColor" />
  </S>
)
export const IconSignature = (p: P) => (
  <S {...p}>
    <path d="M3 17c3 0 3-9 6-9s2 7 4 7 2-4 4-4 1 2 4 2" />
    <path d="M3 21h18" />
  </S>
)
export const IconForm = (p: P) => (
  <S {...p}>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <path d="M8 9h8M8 13h5" />
    <path d="M15.5 15.5l1.5 1.5 3-3.5" />
  </S>
)
export const IconUndo = (p: P) => (
  <S {...p}>
    <path d="M9 7L4 12l5 5" />
    <path d="M4 12h11a5 5 0 0 1 0 10h-3" />
  </S>
)
export const IconRedo = (p: P) => (
  <S {...p}>
    <path d="M15 7l5 5-5 5" />
    <path d="M20 12H9a5 5 0 0 0 0 10h3" />
  </S>
)
export const IconZoomIn = (p: P) => (
  <S {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4M11 8v6M8 11h6" />
  </S>
)
export const IconZoomOut = (p: P) => (
  <S {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4M8 11h6" />
  </S>
)
export const IconSearch = (p: P) => (
  <S {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </S>
)
export const IconPages = (p: P) => (
  <S {...p}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M9 3v18M15 3v18" />
  </S>
)
export const IconOutline = (p: P) => (
  <S {...p}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </S>
)
export const IconSliders = (p: P) => (
  <S {...p}>
    <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
    <circle cx="16" cy="8" r="2" />
    <circle cx="10" cy="16" r="2" />
  </S>
)
export const IconMoon = (p: P) => (
  <S {...p}>
    <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z" />
  </S>
)
export const IconPlus = (p: P) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
)
export const IconX = (p: P) => (
  <S {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </S>
)
export const IconChevronDown = (p: P) => (
  <S {...p}>
    <path d="M6 9l6 6 6-6" />
  </S>
)
export const IconChevronRight = (p: P) => (
  <S {...p}>
    <path d="M9 6l6 6-6 6" />
  </S>
)
export const IconDownload = (p: P) => (
  <S {...p}>
    <path d="M12 3v12M7 10l5 5 5-5" />
    <path d="M4 21h16" />
  </S>
)
export const IconRotate = (p: P) => (
  <S {...p}>
    <path d="M4 9a8 8 0 0 1 14-3l2 2" />
    <path d="M20 4v4h-4" />
  </S>
)
export const IconTrash = (p: P) => (
  <S {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </S>
)
export const IconCopy = (p: P) => (
  <S {...p}>
    <rect x="8" y="8" width="12" height="12" rx="1.5" />
    <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
  </S>
)
export const IconMenu = (p: P) => (
  <S {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </S>
)
export const IconFit = (p: P) => (
  <S {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </S>
)
export const IconOcr = (p: P) => (
  <S {...p}>
    <path d="M4 8V5h4M20 8V5h-4M4 16v3h4M20 16v3h-4" />
    <path d="M8 12h1.5M14.5 12H16M11 15V9M13 15V9" />
  </S>
)
