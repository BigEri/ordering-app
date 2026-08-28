export type StoryousAppCredentials = {
  clientId: string;
  clientSecret: string;
  apiBase: string;
  authUrl: string;
};

export function storyousApiBase(): string {
  return (process.env.STORYOUS_API_BASE?.trim() || "https://api.storyous.com").replace(/\/$/, "");
}

export function storyousAuthUrl(): string {
  return process.env.STORYOUS_AUTH_URL?.trim() || "https://login.storyous.com/api/auth/authorize";
}

/** Partner app (Client ID/Secret) — globální, ne k jedné restauraci. */
export function getStoryousAppCredentials(): StoryousAppCredentials | null {
  const clientId = process.env.STORYOUS_CLIENT_ID?.trim();
  const clientSecret = process.env.STORYOUS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    apiBase: storyousApiBase(),
    authUrl: storyousAuthUrl(),
  };
}

export function storyousEnvMerchantId(): string {
  return process.env.STORYOUS_MERCHANT_ID?.trim() || "";
}

export function storyousEnvPlaceId(): string {
  return process.env.STORYOUS_PLACE_ID?.trim() || "";
}

export function storyousSourceId(merchantId: string, placeId: string): string {
  return `${merchantId.trim()}-${placeId.trim()}`;
}
