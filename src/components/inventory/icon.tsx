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
  receive: ["M4 9h16v11H4z", "M8 4h8", "M12 3v11", "M9 11l3 3 3-3"],
  production: [
    "M9.5 3h5l.8 2.1 2 .8 2.1-.8 2.5 4.3-1.7 1.4.3 2.1 1.7 1.4-2.5 4.3-2.1-.8-2 .8-.8 2.1h-5l-.8-2.1-2-.8-2.1.8-2.5-4.3 1.7-1.4-.3-2.1L3.1 9.4l2.5-4.3 2.1.8 2-.8z",
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  ],
  finance: ["M3 6h18v13H3z", "M3 10h18", "M7 15h4"],
  sale: ["M5 8h14l-1 13H6z", "M8 10V7a4 4 0 0 1 8 0v3"],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  catalog: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
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
