"use client";
import { useEffect, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

export default function NetworkNotice() {
  const [slow, setSlow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const network = (event: Event) => {
      const active = (event as CustomEvent<number>).detail > 0;
      setSlow(active);
      if (!active) setDismissed(false);
    };
    const fallback = () => setOffline(true);
    window.addEventListener("daily-network", network);
    window.addEventListener("daily-offline-cache", fallback);
    return () => {
      window.removeEventListener("daily-network", network);
      window.removeEventListener("daily-offline-cache", fallback);
    };
  }, []);
  return (
    <>
      <Snackbar
        open={slow && !dismissed}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="info" onClose={() => setDismissed(true)} sx={{ maxWidth: 440 }}>
          Le service met un peu de temps à répondre. Il peut être en train de redémarrer après une
          pause : cela peut prendre quelques instants.
        </Alert>
      </Snackbar>
      <Snackbar open={offline && !slow} autoHideDuration={8000} onClose={() => setOffline(false)}>
        <Alert severity="info" onClose={() => setOffline(false)}>
          Connexion indisponible : affichage du contenu enregistré sur cet appareil.
        </Alert>
      </Snackbar>
    </>
  );
}
