const paths = {
  overview: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  inventory: [
    "M3 7l9-4 9 4-9 4z",
    "M3 7v10l9 4 9-4V7",
    "M12 11v10",
    "M7 5l10 4",
  ],
  movements: ["M3 7h17l-4-4", "M21 17H4l4 4", "M20 7l-4 4", "M4 17l4-4"],
  product: [
    "M20 13l-7 7a2 2 0 0 1-3 0l-7-7V3h10l7 7a2 2 0 0 1 0 3z",
    "M7 7h.01",
  ],
  variant: ["M4 8h16v13H4z", "M3 4h18v4H3z", "M9 12h6"],
  supplier: [
    "M3 6h12v12H3z",
    "M15 10h4l3 4v4h-7",
    "M5 18a2 2 0 1 0 4 0",
    "M16 18a2 2 0 1 0 4 0",
  ],
  location: [
    "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z",
    "M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  ],
  category: [
    "M8 5h13",
    "M8 12h13",
    "M8 19h13",
    "M3 5h.01",
    "M3 12h.01",
    "M3 19h.01",
  ],
  history: ["M3 11a9 9 0 1 1 3 8", "M3 3v8h8", "M12 7v5l3 2"],
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name].map((path, index) => (
        <path key={index} d={path} />
      ))}
    </svg>
  );
}
