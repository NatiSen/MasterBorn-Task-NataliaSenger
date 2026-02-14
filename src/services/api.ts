// Mock API Service
// Simulates backend calls with artificial delays
// Marcus: "In production these hit our real pricing engine"

// Fix CFG-142 (Race Conditions) and CFG-151 (Validation)

import type {
  Configuration,
  PriceResponse,
  ValidationResult,
  PreviewResponse,
  Draft,
  Product,
} from '../components/ProductConfigurator/types';
import { calculatePriceBreakdown } from '../utils/pricing';

/**
 * Helper to simulate network latency with AbortSignal support
 */

const randomDelay = (min: number, max: number, signal?: AbortSignal): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, delay);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('AbortError'));
      });
    }
  });
};

let requestCounter = 0;

/**
 * Calculate price for a configuration
 */
export async function calculatePrice(
  config: Configuration,
  product: Product,
  options?: { signal?: AbortSignal }
): Promise<PriceResponse> {
  const requestId = ++requestCounter;

  try {
    await randomDelay(100, 600, options?.signal);
    const breakdown = calculatePriceBreakdown(config, product);
    return {
      breakdown,
      formattedTotal: formatCurrency(breakdown.total, product.currency),
      timestamp: requestId,
    };
  } catch (err) {
    if (options?.signal?.aborted) throw new Error('AbortError');
    throw err;
  }
}
  /**
   * Validate a configuration for conflicts and issues
   */
  export async function validateConfiguration(
    config: Configuration,
    product: Product,
    options?: { signal?: AbortSignal }
  ): Promise<ValidationResult> {
    try {
    await randomDelay(50, 150, options?.signal);

    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    for (const option of product.options) {
      if (option.dependsOn) {
        const dependencyValue = config.selections[option.dependsOn.optionId];
        const currentValue = config.selections[option.id];

        if (currentValue && dependencyValue !== option.dependsOn.requiredValue) {
          errors.push({
            code: 'VALIDATION_CONFLICT_47',
            message: `${option.name} requires ${option.dependsOn.optionId} to be ${option.dependsOn.requiredValue}`,
            optionId: option.id,
          });
        }
      }
    }

    // Check add-on dependencies
    for (const addOnId of config.addOns) {
      const addOn = product.addOns.find(a => a.id === addOnId);
      if (addOn?.dependsOn) {
        const dependencyValue = config.selections[addOn.dependsOn.optionId];
        if (dependencyValue !== addOn.dependsOn.requiredValue) {
          errors.push({
            code: 'ERR_DEP_MISSING_47',
            message: `${addOn.name} requires ${addOn.dependsOn.optionId}`,
            optionId: addOnId,
          });
        }
      }
    }

    // Check quantity limits
    if (config.quantity < 1) {
      errors.push({
        code: 'ERR_INVALID_QTY',
        message: 'Quantity must be at least 1',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (err) {
    if (options?.signal?.aborted) throw new Error('AbortError');
    throw err;
  }
}

/**
 * Generate a preview image URL for the current configuration
 */
export async function generatePreview(
  config: Configuration,
  product: Product,
  options?: { signal?: AbortSignal }
): Promise<PreviewResponse> {
  try {
    await randomDelay(100, 300, options?.signal);
    const timestamp = Date.now();
    const joinChar = product.imageUrl.includes('?') ? '&' : '?';
    return {
      imageUrl: `${product.imageUrl}${joinChar}config=${config.id}&t=${timestamp}`,
      generatedAt: timestamp,
    };
  } catch (err) {
    if (options?.signal?.aborted) throw new Error('AbortError');
    throw err;
  }
}

/**
 * Save a draft configuration to localStorage
 */
export async function saveDraft(
  config: Configuration,
  name: string
): Promise<Draft> {
  const draft: Draft = {
    id: `draft_${Date.now()}`,
    configuration: { ...config },
    savedAt: new Date().toISOString(),
    name: name || `Draft ${new Date().toLocaleTimeString()}`,
  };

  const existingDrafts = getDraftsFromStorage();
  const updatedDrafts = [draft, ...existingDrafts].slice(0, 10);
  localStorage.setItem('configureflow_drafts', JSON.stringify(updatedDrafts));

  return draft;
}

/**
 * Load a draft by ID
 */

export async function loadDraft(draftId: string): Promise<Draft | null> {
 const drafts = getDraftsFromStorage();
 return drafts.find(d => d.id === draftId) || null;
}

/**
 * Get all saved drafts
 */

export async function getAllDrafts(): Promise<Draft[]> {
 return getDraftsFromStorage();
}


/**
 * Delete a draft by ID
 */

export async function deleteDraft(draftId: string): Promise<boolean> {
  const drafts = getDraftsFromStorage();
  const filtered = drafts.filter(d => d.id !== draftId);

  if (filtered.length !== drafts.length) {
    localStorage.setItem('configureflow_drafts', JSON.stringify(filtered));
    return true;
  }
  return false;
}

// --- HELPER FUNCTIONS ---

function getDraftsFromStorage(): Draft[] {
  try {
    const stored = localStorage.getItem('configureflow_drafts');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function encodeConfigurationToUrl(config: Configuration): string {
  const data = JSON.stringify({
    s: config.selections,
    a: config.addOns,
    q: config.quantity,
  });
  return btoa(data);
}

export function decodeConfigurationFromUrl(encoded: string): Partial<Configuration> | null {
  try {
    const data = JSON.parse(atob(encoded));
    return {
      selections: data.s || {},
      addOns: data.a || [],
      quantity: data.q || 1,
    };
  } catch (e) {
    return null;
  }
}