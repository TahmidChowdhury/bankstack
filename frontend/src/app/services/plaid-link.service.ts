import { Injectable } from '@angular/core';

interface PlaidInstitution {
  name: string;
}

interface PlaidOnSuccessMetadata {
  institution: PlaidInstitution | null;
}

interface PlaidExitError {
  error_code: string;
  error_message: string;
  error_type: string;
}

interface PlaidOnExitMetadata {
  institution?: PlaidInstitution | null;
  link_session_id?: string | null;
  request_id?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

interface PlaidEventMetadata {
  error_code?: string | null;
  error_message?: string | null;
  error_type?: string | null;
  institution_name?: string | null;
  institution_id?: string | null;
  link_session_id?: string | null;
  request_id?: string | null;
  view_name?: string | null;
  mfa_type?: string | null;
  timestamp?: string | null;
  [key: string]: unknown;
}

interface PlaidHandler {
  open: () => void;
}

interface PlaidFactory {
  create: (options: {
    token: string;
    onSuccess: (publicToken: string, metadata: PlaidOnSuccessMetadata) => void;
    onExit: (error: PlaidExitError | null, metadata: PlaidOnExitMetadata) => void;
    onEvent?: (eventName: string, metadata: PlaidEventMetadata) => void;
  }) => PlaidHandler;
}

declare global {
  interface Window {
    Plaid?: PlaidFactory;
  }
}

@Injectable({
  providedIn: 'root',
})
export class PlaidLinkService {
  private sdkLoadPromise: Promise<void> | null = null;

  async createHandler(options: {
    linkToken: string;
    onSuccess: (result: { publicToken: string; institutionName: string }) => void;
    onExit: (result: {
      error: PlaidExitError | null;
      metadata: PlaidOnExitMetadata | null;
    }) => void;
    onEvent?: (event: { eventName: string; metadata: PlaidEventMetadata }) => void;
  }): Promise<PlaidHandler> {
    await this.loadSdk();

    const handler = window.Plaid?.create({
      token: options.linkToken,
      onSuccess: (publicToken, metadata) => {
        options.onSuccess({
          publicToken,
          institutionName: metadata.institution?.name ?? 'Unknown',
        });
      },
      onExit: (error, metadata) => {
        options.onExit({
          error,
          metadata: metadata ?? null,
        });
      },
      onEvent: (eventName, metadata) => {
        options.onEvent?.({
          eventName,
          metadata,
        });
      },
    });

    if (!handler) {
      throw new Error('Plaid SDK was loaded but could not initialize Link.');
    }

    return handler;
  }

  private loadSdk(): Promise<void> {
    if (window.Plaid) {
      return Promise.resolve();
    }

    if (this.sdkLoadPromise) {
      return this.sdkLoadPromise;
    }

    const loadPromise: Promise<void> = new Promise<void>((resolve, reject) => {
      const timeoutMs = 10000;
      const timeoutId = window.setTimeout(() => {
        reject(new Error('Timed out while loading Plaid Link SDK.'));
      }, timeoutMs);

      const done = (callback: () => void) => {
        window.clearTimeout(timeoutId);
        callback();
      };

      const onLoaded = () => {
        if (!window.Plaid) {
          done(() => reject(new Error('Plaid SDK loaded but window.Plaid is unavailable.')));
          return;
        }
        done(() => resolve(undefined));
      };

      const onError = () => {
        done(() => reject(new Error('Failed to load Plaid Link SDK.')));
      };

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-plaid-sdk="true"]',
      );

      if (existingScript) {
        if (window.Plaid) {
          done(() => resolve(undefined));
          return;
        }

        existingScript.addEventListener('load', onLoaded, { once: true });
        existingScript.addEventListener('error', onError, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
      script.async = true;
      script.dataset['plaidSdk'] = 'true';
      script.onload = onLoaded;
      script.onerror = onError;
      document.body.appendChild(script);
    }).catch((error) => {
      this.sdkLoadPromise = null;
      throw error;
    });

    this.sdkLoadPromise = loadPromise;
    return loadPromise;
  }
}
