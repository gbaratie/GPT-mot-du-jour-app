"use client";

import NetworkNotice from "./NetworkNotice";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#7c9ce0" },
    secondary: { main: "#a8b8e0" },
    background: { default: "#0f1116", paper: "#161a22" },
    text: { primary: "#e8eaef", secondary: "#a0a8b8" },
    divider: "rgba(255,255,255,0.08)",
  },
  shape: { borderRadius: 20 },
  typography: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontFamily: "Georgia, serif",
      fontSize: "clamp(2rem, 4vw, 3.6rem)",
      fontWeight: 400,
      letterSpacing: "-0.04em",
    },
    h2: { fontSize: "1.5rem", fontWeight: 500 },
    body1: { lineHeight: 1.7 },
    button: { textTransform: "none" },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { border: "1px solid rgba(255,255,255,0.08)", backgroundImage: "none" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 44, borderRadius: 12 } },
    },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
      <NetworkNotice />
    </ThemeProvider>
  );
}
