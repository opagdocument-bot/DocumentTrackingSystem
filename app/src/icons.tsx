import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function S({ size = 18, children, ...rest }: P) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...rest}
    >
      {children}
    </svg>
  )
}

export const IconGrid = (p: P) => (
  <S {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></S>
)
export const IconFilePlus = (p: P) => (
  <S {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 12v6M9 15h6" /></S>
)
export const IconCheckSquare = (p: P) => (
  <S {...p}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></S>
)
export const IconTruck = (p: P) => (
  <S {...p}><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></S>
)
export const IconFolder = (p: P) => (
  <S {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></S>
)
export const IconSearch = (p: P) => (
  <S {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></S>
)
export const IconBell = (p: P) => (
  <S {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></S>
)
export const IconChevronDown = (p: P) => (<S {...p}><path d="M6 9l6 6 6-6" /></S>)
export const IconChevronRight = (p: P) => (<S {...p}><path d="M9 18l6-6-6-6" /></S>)
export const IconArrowRight = (p: P) => (<S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>)
export const IconDownload = (p: P) => (
  <S {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></S>
)
export const IconRefresh = (p: P) => (
  <S {...p}><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></S>
)
export const IconFileText = (p: P) => (
  <S {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6" /></S>
)
export const IconClock = (p: P) => (<S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>)
export const IconAlert = (p: P) => (
  <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></S>
)
export const IconTrendUp = (p: P) => (<S {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></S>)
export const IconTrendDown = (p: P) => (<S {...p}><path d="M3 7l6 6 4-4 8 8" /><path d="M14 17h7v-7" /></S>)
export const IconSend = (p: P) => (<S {...p}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></S>)
export const IconMapPin = (p: P) => (
  <S {...p}><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></S>
)
export const IconUser = (p: P) => (
  <S {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></S>
)
export const IconCheck = (p: P) => (<S {...p}><path d="M20 6L9 17l-5-5" /></S>)
export const IconX = (p: P) => (<S {...p}><path d="M18 6L6 18M6 6l12 12" /></S>)
export const IconCamera = (p: P) => (
  <S {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></S>
)
export const IconInbox = (p: P) => (
  <S {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.4 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1z" /></S>
)
export const IconLayers = (p: P) => (
  <S {...p}><path d="M12 2L2 7l10 5 10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></S>
)

export const IconPaperclip = (p: P) => (
  <S {...p}><path d="M21.4 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.34 3.34 0 0 1 4.71 4.71l-9.2 9.19a1.67 1.67 0 0 1-2.36-2.36l8.49-8.48" /></S>
)
export const IconFilter = (p: P) => (
  <S {...p}><path d="M22 3H2l8 9.46V19l4 2v-8.54z" /></S>
)

export const IconEye = (p: P) => (
  <S {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></S>
)

export const IconBarChart = (p: P) => (
  <S {...p}><path d="M4 20V10M12 20V4M20 20v-7" /></S>
)

export const IconLogOut = (p: P) => (<S {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></S>)
