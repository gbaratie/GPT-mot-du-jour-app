import type { Metadata } from "next";
import Link from "next/link";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { Box, Container, Stack, Typography } from "@mui/material";
import Providers from "@/components/Providers";
import { collections } from "@/collections/catalog";

export const metadata: Metadata = {
  title: { default: "Chaque jour · Mot du jour", template: "%s · Chaque jour" },
  description: "Un mot, une citation, une nouvelle découverte chaque jour.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AppRouterCacheProvider>
          <Providers>
            <Box
              component="header"
              sx={{ borderBottom: "1px solid", borderColor: "divider", py: 3 }}
            >
              <Container maxWidth="md">
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  sx={{ gap: 2, justifyContent: "space-between", alignItems: { sm: "center" } }}
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
                    aria-label="Navigation principale"
                    direction="row"
                    sx={{ gap: 3, flexWrap: "wrap" }}
                  >
                    {collections.map((collection) => (
                      <Link
                        key={collection.slug}
                        href={`/${collection.slug}/`}
                        style={{ color: "#a8b8e0", textDecoration: "none", fontSize: "0.9rem" }}
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
              maxWidth="md"
              sx={{ py: { xs: 5, md: 9 }, minHeight: "75vh" }}
            >
              {children}
            </Container>
            <Container
              component="footer"
              maxWidth="md"
              sx={{ py: 4, borderTop: "1px solid", borderColor: "divider" }}
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
