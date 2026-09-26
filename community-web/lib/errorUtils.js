import { CommunityApiError } from './communityClient';

// i18n-Hinweis: Fallbacks bleiben bewusst deutsch (DE-Default). Aufrufer
// übergeben locale-abhängige Fallback-Texte als 2. Argument (siehe
// Komponenten mit useLocale()); diese Datei nimmt KEINEN locale-Parameter.
export function toUserErrorMessage(error, fallback = 'Anfrage fehlgeschlagen.') {
  if (!error) return fallback;

  if (error instanceof CommunityApiError) {
    if (error.details && typeof error.details === 'object' && typeof error.details.error === 'string') {
      return error.details.error;
    }
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
    return fallback;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
