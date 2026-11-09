import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { Box, Container, Stack, Typography } from "@mui/material";
import Providers from "@/components/Providers";
import { collections } from "@/collections/catalog";

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
                    }}
                  >
                    Chaque jour<span style={{ color: "#7c9ce0" }}>.</span>
                  </Link>
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
            <Container
              component="footer"
              maxWidth="lg"
              sx={{ py: 2, borderTop: "1px solid", borderColor: "divider" }}
            >
              <Typography variant="body2" color="text.secondary">
                Une petite découverte, chaque jour. Les dates suivent le calendrier de Paris.
              </Typography>
            </Container>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
