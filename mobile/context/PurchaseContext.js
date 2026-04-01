import React, { createContext, useContext, useState, useEffect } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Config from '../constants/Config';
import { useAuth } from './AuthContext';
import { userService } from '../services/api';

const PurchaseContext = createContext(null);

export function PurchaseProvider({ children }) {
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [offerings, setOfferings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialise RevenueCat once on app start
  useEffect(() => {
    let removeListener = null;

    (async () => {
      try {
        Purchases.setLogLevel(LOG_LEVEL.ERROR);
        await Purchases.configure({ apiKey: Config.REVENUECAT_API_KEY });
        const customerInfo = await Purchases.getCustomerInfo();
        _syncPlan(customerInfo);
        await _loadOfferings();

        // Listen for purchase updates (e.g. subscription renewed in background)
        removeListener = Purchases.addCustomerInfoUpdateListener((info) => {
          _syncPlan(info);
        });
      } catch (err) {
        // RevenueCat native module not available in Expo Go — defaults to free plan
        console.log('[purchases] RevenueCat unavailable (Expo Go). Defaulting to free plan.');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (typeof removeListener === 'function') removeListener();
    };
  }, []);

  // Identify user in RevenueCat when they log in (links purchases to account)
  useEffect(() => {
    if (!user) return;
    Purchases.logIn(user.id).catch((err) =>
      console.error('[purchases] Login error:', err.message)
    );
  }, [user]);

  const _syncPlan = (customerInfo) => {
    const active = customerInfo?.entitlements?.active ?? {};
    const hasPro = !!active['pro'];
    setIsPro(hasPro);
  };

  const _loadOfferings = async () => {
    try {
      const result = await Purchases.getOfferings();
      if (result.current) setOfferings(result.current);
    } catch (err) {
      console.error('[purchases] Offerings error:', err.message);
    }
  };

  /**
   * Purchase a package from the current offering.
   * Returns true on success, false on cancel/failure.
   */
  const purchasePackage = async (pkg) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      _syncPlan(customerInfo);

      // Sync plan to our backend so JWT-protected routes can check it
      const active = customerInfo?.entitlements?.active ?? {};
      const plan = active['pro'] ? 'pro' : 'free';
      await userService.updatePlan(plan);

      return true;
    } catch (err) {
      if (!err.userCancelled) {
        console.error('[purchases] Purchase error:', err.message);
      }
      return false;
    }
  };

  /**
   * Restore previous purchases (required by App Store guidelines).
   */
  const restorePurchases = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      _syncPlan(customerInfo);
      const active = customerInfo?.entitlements?.active ?? {};
      const plan = active['pro'] ? 'pro' : 'free';
      await userService.updatePlan(plan);
      return !!active['pro'];
    } catch (err) {
      console.error('[purchases] Restore error:', err.message);
      return false;
    }
  };

  return (
    <PurchaseContext.Provider value={{ isPro, offerings, loading, purchasePackage, restorePurchases }}>
      {children}
    </PurchaseContext.Provider>
  );
}

export const usePurchase = () => useContext(PurchaseContext);
