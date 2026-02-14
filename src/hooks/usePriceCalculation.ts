// usePriceCalculation Hook
// Marcus: "This hook handles async price fetching. A bit janky but works."

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Configuration, Product, PriceBreakdown, PriceResponse } from '../components/ProductConfigurator/types';
import { calculatePrice } from '../services/api';
/**
 * Interface for the hook's return value to ensure type safety
 * across the component tree.
 */
interface UsePriceCalculationResult {
  price: PriceBreakdown | null;
  formattedTotal: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for handling real-time price calculations with race-condition protection.
 * Optimized for the TechStyle demo to ensure UI Stability
 */
export function usePriceCalculation(
  config: Configuration | null,
  product: Product
): UsePriceCalculationResult {
  const [price, setPrice] = useState<PriceBreakdown | null>(null);
  const [formattedTotal, setFormattedTotal] = useState<string>('$0.00 ${product.currency}');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

    // Use a ref for the product object to avoid unnecessary fetchPrice re-creations
   // when the parent component re-renders with a new product object reference.

   const productRef = useRef(product);
   useEffect(() => {
    productRef.current = product;
   },[product]);


   /**
    * Core function to fetch pricing from the API.
    * Includes AbortSignal handling to fix RACE CONDITIONS (CFG-142).
    */

   const fetchPrice = useCallback(async (signal?:AbortSignal) => {
    if (!config) {
      setPrice(null);
      return;
    }
    setIsLoading(true);
    setError(null); // CFG-151: Reset error state before a new attempt

    try {
      const response: PriceResponse = await calculatePrice(config, productRef.current, { signal });


      if (!signal?.aborted) {
        setPrice(response.breakdown);
        setFormattedTotal(response.formattedTotal);
      }

    } catch (err: unknown) {

      if (err instanceof Error && err.name === 'AbortError') {
        return; 
      }

     // CFG-151: User-friendly error message for the UI
     setError('We encountered a problem updating the price. Please check your connection and try again.');
     setPrice(null);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
   },[config]);

   /**
   * Effect to trigger price calculation on configuration changes.
   * Implements debouncing to prevent API throttling and UI flickering.
   */

   useEffect(() => {
    const controller = new AbortController();

   // CFG-142: 150ms debounce ensures smooth experience during rapid user selections

    const timeoutId = setTimeout(() =>{
      fetchPrice(controller.signal);
    }, 150);

    return () => {
      clearTimeout(timeoutId); 
      controller.abort();    // Crucial: Fixes Race Conditions by cancelling stale requests  
    };

    // Deep-watch relevant config changes to trigger recalculation

   }, [
    JSON.stringify(config?.selections),
    JSON.stringify(config?.addOns),
    config?.quantity,
    fetchPrice
   ]);

  return {
    price,
    formattedTotal,
    isLoading,
    error,
    refetch: () => fetchPrice(),
  };
}

