import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { Box, Container, Stack } from "@mui/material";
import Providers from "@/components/Providers";
import { collections } from "@/collections/catalog";
import CardIcon from "@/components/CardIcon";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1116",
};

export const metadata: Metadata = {
  title: { default: "Chaque jour · Mot du jour", template: "%s · Chaque jour" },
  description: "Un mot, une citation, une nouvelle découverte chaque jour.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a className="skip-link" href="#main-content">
          Aller au contenu
        </a>
        <AppRouterCacheProvider>
          <Providers>
            <Box
              component="header"
              sx={{ borderBottom: "1px solid", borderColor: "divider", py: { xs: 1.5, sm: 2 } }}
            >
              <Container maxWidth="lg">
                <Stack
                  direction="row"
                  sx={{
                    gap: 2,
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Link
                    href="/"
                    style={{
                      color: "inherit",
                      textDecoration: "none",
                      fontWeight: 750,
                      fontSize: "1.25rem",
                      display: "inline-flex",
                      alignItems: "center",
                      minHeight: 44,
                    }}
                  >
                    Chaque jour<span style={{ color: "#7c9ce0" }}>.</span>
                  </Link>
                  <Stack
                    className="site-header-actions"
                    direction="row"
                    sx={{ gap: 3, alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Stack
                      component="nav"
                      className="site-nav"
                      aria-label="Navigation principale"
                      direction="row"
                      sx={{ gap: { xs: 1, sm: 3 }, flexWrap: "wrap" }}
                    >
                      {collections.map((collection) => (
                        <Link
                          key={collection.slug}
                          href={`/${collection.slug}/`}
                          style={{ color: "#a0a8b8", textDecoration: "none", fontSize: "0.9rem" }}
                        >
                          {collection.name}
                        </Link>
                      ))}
                    </Stack>
                    <Link
                      href="/favorites/"
                      aria-label="Mes favoris"
                      title="Mes favoris"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#a0a8b8",
                        minWidth: 44,
                        minHeight: 44,
                      }}
                    >
                      <CardIcon name="heart" />
                    </Link>
                  </Stack>
                </Stack>
              </Container>
            </Box>
            <Container
              component="main"
              id="main-content"
              maxWidth="lg"
              sx={{ py: { xs: 3, md: 5 }, flex: 1, width: "100%" }}
            >
              {children}
            </Container>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
