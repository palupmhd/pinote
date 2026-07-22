// Set ikon garis mungil (stroke = currentColor) untuk chrome UI — tanpa
// dependency, konsisten 24×24, stroke 1.8. Dipakai toolbar bawah, top bar,
// dan kontrol zoom.
type P = { className?: string };

function S({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconPlus = (p: P) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const IconNote = (p: P) => (
  <S {...p}>
    <rect x="5" y="4" width="14" height="16" rx="2" />
    <path d="M8.5 9h7M8.5 13h7M8.5 17h4" />
  </S>
);
export const IconTask = (p: P) => (
  <S {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </S>
);
export const IconImage = (p: P) => (
  <S {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.4" />
    <path d="M5 17l4-4 3 3 3-3 4 4" />
  </S>
);
export const IconLink = (p: P) => (
  <S {...p}>
    <path d="M9.5 14.5l5-5" />
    <path d="M8 12l-1.5 1.5a3 3 0 004.2 4.2L12 16" />
    <path d="M16 12l1.5-1.5a3 3 0 00-4.2-4.2L12 8" />
  </S>
);
export const IconTable = (p: P) => (
  <S {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M4 10h16M4 15h16M10 5v14" />
  </S>
);
export const IconBoard = (p: P) => (
  <S {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </S>
);
export const IconSearch = (p: P) => (
  <S {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-3.5-3.5" />
  </S>
);
export const IconInbox = (p: P) => (
  <S {...p}>
    <path d="M4 13l2.5-7h11L20 13v4a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
    <path d="M4 13h4l1.5 2.5h5L16 13h4" />
  </S>
);
export const IconPresent = (p: P) => (
  <S {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M12 16v4M8 20h8" />
    <path d="M10.5 8.5l3.5 2-3.5 2z" fill="currentColor" />
  </S>
);
export const IconExport = (p: P) => (
  <S {...p}>
    <path d="M12 4v10M8.5 10.5L12 14l3.5-3.5" />
    <path d="M5 16v2a2 2 0 002 2h10a2 2 0 002-2v-2" />
  </S>
);
export const IconAgenda = (p: P) => (
  <S {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 9h16M8 3v4M16 3v4M8 13h3M8 16.5h6" />
  </S>
);
export const IconUndo = (p: P) => (
  <S {...p}>
    <path d="M9 7L5 11l4 4" />
    <path d="M5 11h9a5 5 0 015 5v1" />
  </S>
);
export const IconRedo = (p: P) => (
  <S {...p}>
    <path d="M15 7l4 4-4 4" />
    <path d="M19 11h-9a5 5 0 00-5 5v1" />
  </S>
);
export const IconZoomIn = (p: P) => (
  <S {...p}>
    <path d="M5 12h14" />
  </S>
);
export const IconMinus = (p: P) => (
  <S {...p}>
    <path d="M5 12h14" />
  </S>
);
export const IconFit = (p: P) => (
  <S {...p}>
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
  </S>
);
export const IconHand = (p: P) => (
  <S {...p}>
    <path d="M8 11V6.5a1.5 1.5 0 013 0V11m0-1V5.5a1.5 1.5 0 013 0V11m0-.5V7a1.5 1.5 0 013 0v6a6 6 0 01-6 6h-1.2a5 5 0 01-3.8-1.8L6 15l-1.3-1.6a1.4 1.4 0 012-1.9L8 13" />
  </S>
);
export const IconChevronDown = (p: P) => (
  <S {...p}>
    <path d="M7 10l5 5 5-5" />
  </S>
);
export const IconDots = (p: P) => (
  <S {...p}>
    <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </S>
);
