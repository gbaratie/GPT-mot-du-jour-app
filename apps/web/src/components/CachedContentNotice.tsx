import { Alert, Button } from "@mui/material";

export default function CachedContentNotice({
  refreshing,
  onRetry,
}: {
  refreshing: boolean;
  onRetry: () => void;
}) {
  return (
    <Alert severity="info" action={!refreshing && <Button onClick={onRetry}>Réessayer</Button>}>
      {refreshing
        ? "Cartes enregistrées sur cet appareil. Actualisation en cours…"
        : "Connexion indisponible. Vous pouvez continuer à lire les cartes enregistrées sur cet appareil."}
    </Alert>
  );
}
