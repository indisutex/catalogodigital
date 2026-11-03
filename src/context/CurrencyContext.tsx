import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type CurrencyCode = 'COP' | 'USD';

export interface CountryInfo {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
}

export const COUNTRIES_DATABASE: Record<string, CountryInfo> = {
  CO: { code: 'CO', name: 'Colombia', flag: '🇨🇴', dialCode: '+57' },
  PA: { code: 'PA', name: 'Panamá', flag: '🇵🇦', dialCode: '+507' },
  CR: { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', dialCode: '+506' },
  CL: { code: 'CL', name: 'Chile', flag: '🇨🇱', dialCode: '+56' },
  EC: { code: 'EC', name: 'Ecuador', flag: '🇪🇨', dialCode: '+593' },
  PE: { code: 'PE', name: 'Perú', flag: '🇵🇪', dialCode: '+51' },
  MX: { code: 'MX', name: 'México', flag: '🇲🇽', dialCode: '+52' },
  US: { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', dialCode: '+1' },
  ES: { code: 'ES', name: 'España', flag: '🇪🇸', dialCode: '+34' },
  AR: { code: 'AR', name: 'Argentina', flag: '🇦🇷', dialCode: '+54' },
  VE: { code: 'VE', name: 'Venezuela', flag: '🇻🇪', dialCode: '+58' },
  GT: { code: 'GT', name: 'Guatemala', flag: '🇬🇹', dialCode: '+502' },
  HN: { code: 'HN', name: 'Honduras', flag: '🇭🇳', dialCode: '+504' },
  SV: { code: 'SV', name: 'El Salvador', flag: '🇸🇻', dialCode: '+503' },
  NI: { code: 'NI', name: 'Nicaragua', flag: '🇳🇮', dialCode: '+505' },
  DO: { code: 'DO', name: 'Rep. Dominicana', flag: '🇩🇴', dialCode: '+1' },
  PR: { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷', dialCode: '+1' },
  BO: { code: 'BO', name: 'Bolivia', flag: '🇧🇴', dialCode: '+591' },
  UY: { code: 'UY', name: 'Uruguay', flag: '🇺🇾', dialCode: '+598' },
  PY: { code: 'PY', name: 'Paraguay', flag: '🇵🇾', dialCode: '+595' },
  BR: { code: 'BR', name: 'Brasil', flag: '🇧🇷', dialCode: '+55' },
  CA: { code: 'CA', name: 'Canadá', flag: '🇨🇦', dialCode: '+1' },
};

export function getCountryInfo(code: string, fallbackName?: string): CountryInfo {
  const upper = (code || '').toUpperCase().trim();
  if (COUNTRIES_DATABASE[upper]) {
    return COUNTRIES_DATABASE[upper];
  }
  return {
    code: upper || 'INT',
    name: fallbackName || upper || 'Internacional',
    flag: '🌎',
    dialCode: '+1',
  };
}

/**
 * Heurística inicial ultrarrápida usando la zona horaria del navegador
 */
function guessCountryFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Bogota')) return 'CO';
    if (tz.includes('Panama')) return 'PA';
    if (tz.includes('Costa_Rica')) return 'CR';
    if (tz.includes('Santiago')) return 'CL';
    if (tz.includes('Guayaquil') || tz.includes('Galapagos')) return 'EC';
    if (tz.includes('Lima')) return 'PE';
    if (tz.includes('Mexico') || tz.includes('Monterrey') || tz.includes('Cancun') || tz.includes('Tijuana')) return 'MX';
    if (tz.includes('New_York') || tz.includes('Chicago') || tz.includes('Los_Angeles') || tz.includes('Denver')) return 'US';
    if (tz.includes('Madrid')) return 'ES';
    if (tz.includes('Buenos_Aires')) return 'AR';
    if (tz.includes('Caracas')) return 'VE';
    if (tz.includes('Guatemala')) return 'GT';
    if (tz.includes('Santo_Domingo')) return 'DO';
    // Si la zona horaria no es Bogotá, lo más probable es que sea internacional
    if (tz && !tz.includes('Bogota')) return 'NON_CO';
  } catch {}
  return 'CO';
}

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  country: CountryInfo;
  setCountry: (country: CountryInfo) => void;
  isInternational: boolean;
  exchangeRate: number; // COP por 1 USD
  formatPrice: (amountCOP: number, options?: { showCode?: boolean }) => string;
  convertPrice: (amountCOP: number) => number;
  showDetectedBanner: boolean;
  dismissDetectedBanner: () => void;
  isLoadingLocation: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const DEFAULT_EXCHANGE_RATE = 4000; // 1 USD = 4,000 COP fallback

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  // 1. Moneda inicial
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('indisutex_currency');
    if (saved === 'USD' || saved === 'COP') return saved;
    const initialGuess = guessCountryFromTimezone();
    // Si la zona horaria detecta que está fuera de Colombia, dolarizar desde el primer render
    if (initialGuess !== 'CO') return 'USD';
    return 'COP';
  });

  // 2. País detectado inicial
  const [country, setCountryState] = useState<CountryInfo>(() => {
    const savedCode = localStorage.getItem('indisutex_country_code');
    const savedName = localStorage.getItem('indisutex_country_name');
    if (savedCode) {
      return getCountryInfo(savedCode, savedName || undefined);
    }
    const initialGuess = guessCountryFromTimezone();
    if (initialGuess !== 'CO' && initialGuess !== 'NON_CO') {
      return getCountryInfo(initialGuess);
    }
    return getCountryInfo(initialGuess === 'NON_CO' ? 'US' : 'CO');
  });

  // 3. Tasa de cambio (COP por 1 USD)
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const saved = localStorage.getItem('indisutex_usd_rate');
    const savedTime = localStorage.getItem('indisutex_usd_rate_time');
    if (saved && savedTime && Date.now() - Number(savedTime) < 12 * 60 * 60 * 1000) {
      const parsed = Number(saved);
      if (parsed > 1000) return parsed;
    }
    return DEFAULT_EXCHANGE_RATE;
  });

  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [showDetectedBanner, setShowDetectedBanner] = useState(false);

  // Guardar preferencia de moneda manualmente
  const setCurrency = useCallback((newCurrency: CurrencyCode) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('indisutex_currency', newCurrency);
    localStorage.setItem('indisutex_currency_manual', 'true');
  }, []);

  const setCountry = useCallback((newCountry: CountryInfo) => {
    setCountryState(newCountry);
    localStorage.setItem('indisutex_country_code', newCountry.code);
    localStorage.setItem('indisutex_country_name', newCountry.name);
    // Si cambia de país manualmente a uno fuera de Colombia y no ha forzado moneda
    if (newCountry.code !== 'CO') {
      const manual = localStorage.getItem('indisutex_currency_manual') === 'true';
      if (!manual) {
        setCurrencyState('USD');
        localStorage.setItem('indisutex_currency', 'USD');
      }
    }
  }, []);

  const dismissDetectedBanner = useCallback(() => {
    setShowDetectedBanner(false);
    sessionStorage.setItem('indisutex_currency_banner_dismissed', 'true');
  }, []);

  // 4. Detección automática de ubicación por IP
  useEffect(() => {
    let isMounted = true;

    async function detectLocation() {
      const isManual = localStorage.getItem('indisutex_currency_manual') === 'true';
      const isBannerDismissed = sessionStorage.getItem('indisutex_currency_banner_dismissed') === 'true';

      try {
        let detectedCode = '';
        let detectedName = '';

        // Intentar servicio 1: country.is (ultrarrápido y liviano)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const res = await fetch('https://api.country.is/', { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data?.country && typeof data.country === 'string') {
              detectedCode = data.country.toUpperCase();
            }
          }
        } catch {}

        // Fallback servicio 2: ipwho.is si el primero no respondió
        if (!detectedCode) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const res = await fetch('https://ipwho.is/', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              if (data?.country_code) {
                detectedCode = String(data.country_code).toUpperCase();
                detectedName = data.country || '';
              }
            }
          } catch {}
        }

        // Si aún no hay código, usar la zona horaria como último respaldo
        if (!detectedCode) {
          const guess = guessCountryFromTimezone();
          if (guess && guess !== 'NON_CO') {
            detectedCode = guess;
          }
        }

        if (isMounted && detectedCode) {
          const info = getCountryInfo(detectedCode, detectedName);
          setCountryState(info);
          localStorage.setItem('indisutex_country_code', info.code);
          localStorage.setItem('indisutex_country_name', info.name);

          // Si el país detectado NO es Colombia ('CO'), dolarizar en automático
          if (detectedCode !== 'CO') {
            if (!isManual) {
              setCurrencyState('USD');
              localStorage.setItem('indisutex_currency', 'USD');
              if (!isBannerDismissed) {
                setShowDetectedBanner(true);
              }
            }
          } else {
            // Si está en Colombia y no eligió moneda manualmente, mantener COP
            if (!isManual) {
              setCurrencyState('COP');
              localStorage.setItem('indisutex_currency', 'COP');
            }
          }
        }
      } catch (err) {
        console.warn('No se pudo determinar la ubicación del visitante:', err);
      } finally {
        if (isMounted) setIsLoadingLocation(false);
      }
    }

    detectLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  // 5. Cargar tasa de cambio oficial en vivo (TRM)
  useEffect(() => {
    let isMounted = true;

    async function fetchExchangeRate() {
      // Si la tasa guardada tiene menos de 12 horas, no consultar de nuevo
      const savedTime = localStorage.getItem('indisutex_usd_rate_time');
      if (savedTime && Date.now() - Number(savedTime) < 12 * 60 * 60 * 1000) {
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const copRate = Number(data?.rates?.COP);
          if (copRate && copRate > 1000) {
            if (isMounted) {
              setExchangeRate(copRate);
              localStorage.setItem('indisutex_usd_rate', String(copRate));
              localStorage.setItem('indisutex_usd_rate_time', String(Date.now()));
            }
          }
        }
      } catch (e) {
        // En caso de fallo de red, se mantiene el DEFAULT_EXCHANGE_RATE
      }
    }

    fetchExchangeRate();

    return () => {
      isMounted = false;
    };
  }, []);

  // 6. Funciones de conversión y formateo
  const convertPrice = useCallback(
    (amountCOP: number): number => {
      if (!amountCOP || isNaN(amountCOP)) return 0;
      if (currency === 'USD') {
        const usd = amountCOP / exchangeRate;
        return Number(usd.toFixed(2));
      }
      return Math.round(amountCOP);
    },
    [currency, exchangeRate]
  );

  const formatPrice = useCallback(
    (amountCOP: number, options?: { showCode?: boolean }): string => {
      if (amountCOP === undefined || amountCOP === null || isNaN(amountCOP)) {
        return currency === 'USD' ? '$0.00 USD' : '$0';
      }

      const showCode = options?.showCode ?? true;

      if (currency === 'USD') {
        const usdVal = amountCOP / exchangeRate;
        const formatted = usdVal.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return showCode ? `$${formatted} USD` : `$${formatted}`;
      }

      // COP
      const formatted = Math.round(amountCOP).toLocaleString('es-CO');
      return `$${formatted}`;
    },
    [currency, exchangeRate]
  );

  const isInternational = currency === 'USD' || country.code !== 'CO';

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        country,
        setCountry,
        isInternational,
        exchangeRate,
        formatPrice,
        convertPrice,
        showDetectedBanner,
        dismissDetectedBanner,
        isLoadingLocation,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency debe ser utilizado dentro de un CurrencyProvider');
  }
  return context;
}

