"use client";

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
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontSize: "clamp(2rem, 5vw, 3.8rem)", fontWeight: 700, letterSpacing: "-0.04em" },
    h2: { fontSize: "1.8rem", fontWeight: 600 },
    body1: { lineHeight: 1.7 },
    button: { textTransform: "none" },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { border: "1px solid rgba(255,255,255,0.08)", backgroundImage: "none" },
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
