import { SvgIcon } from "@mui/material";

export default function CardIcon({ name }: { name: "back" | "next" | "archive" }) {
  const paths = {
    back: "m14 6-6 6 6 6",
    next: "m10 6 6 6-6 6",
    archive: "M4 8h16v12H4z M3 4h18v4H3z M9 12h6",
  };
  return (
    <SvgIcon sx={{ fontSize: 20 }}>
      <path
        d={paths[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}
