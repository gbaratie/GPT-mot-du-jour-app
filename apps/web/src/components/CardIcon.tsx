import { SvgIcon } from "@mui/material";

export default function CardIcon({
  name,
}: {
  name: "back" | "next" | "archive" | "like" | "dislike" | "heart";
}) {
  const paths = {
    back: "m14 6-6 6 6 6",
    next: "m10 6 6 6-6 6",
    archive: "M4 8h16v12H4z M3 4h18v4H3z M9 12h6",
    like: "M7 10H3v11h4z M7 20h11l3-9V8h-7l1-5-2-2-6 9z",
    dislike: "M7 14H3V3h4z M7 4h11l3 9v3h-7l1 5-2 2-6-9z",
    heart:
      "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
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
