import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePurchase } from '../context/PurchaseContext';

const FEATURES = [
  { icon: 'bookmark-outline', label: 'Unlimited watched companies', free: '5 max', pro: 'Unlimited' },
  { icon: 'sparkles-outline', label: 'AI outreach messages', free: '3/month', pro: 'Unlimited' },
  { icon: 'notifications-outline', label: 'Hiring alerts', free: 'Weekly', pro: 'Daily' },
  { icon: 'time-outline', label: 'Signal history', free: '7 days', pro: '90 days' },
  { icon: 'refresh-outline', label: 'Manual scans', free: '3/day', pro: 'Unlimited' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { offerings, purchasePackage, restorePurchases } = usePurchase();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  const packages = offerings?.availablePackages ?? [];

  // Auto-select monthly if nothing selected
  const activePackage = selectedPackage ?? packages.find((p) => p.packageType === 'MONTHLY') ?? packages[0];

  const handlePurchase = async () => {
    if (!activePackage) {
      Alert.alert('Not available', 'No subscription packages found. Make sure products are set up in App Store Connect / Google Play.');
      return;
    }
    setPurchasing(true);
    const success = await purchasePackage(activePackage);
    setPurchasing(false);
    if (success) {
      Alert.alert('Welcome to Pro!', "You're now on the Pro plan.", [
        { text: 'Let\'s go', onPress: () => router.back() },
      ]);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    const wasPro = await restorePurchases();
    setRestoring(false);
    if (wasPro) {
      Alert.alert('Restored', 'Your Pro subscription has been restored.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('No purchases found', 'No active Pro subscription found for this account.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.proBadge}>
          <Ionicons name="sparkles" size={14} color="#fff" />
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
        <Text style={styles.title}>Unlock Ghost Job Intelligence</Text>
        <Text style={styles.subtitle}>
          Get daily alerts, unlimited tracking, and AI-powered outreach for every company you watch
        </Text>
      </View>

      {/* Feature comparison */}
      <View style={styles.comparisonCard}>
        <View style={styles.comparisonHeader}>
          <Text style={styles.comparisonTitle}>Features</Text>
          <Text style={styles.colFree}>Free</Text>
          <Text style={styles.colPro}>Pro</Text>
        </View>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.featureRow}>
            <View style={styles.featureLeft}>
              <Ionicons name={f.icon} size={16} color="#6b7280" />
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
            <Text style={styles.colFreeVal}>{f.free}</Text>
            <Text style={styles.colProVal}>{f.pro}</Text>
          </View>
        ))}
      </View>

      {/* Package selector */}
      {packages.length > 0 ? (
        <View style={styles.packages}>
          {packages.map((pkg) => {
            const isSelected = (activePackage?.identifier ?? '') === pkg.identifier;
            const isPopular = pkg.packageType === 'MONTHLY';
            return (
              <TouchableOpacity
                key={pkg.identifier}
                style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                onPress={() => setSelectedPackage(pkg)}
              >
                {isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>Most Popular</Text>
                  </View>
                )}
                <Text style={styles.packageName}>{pkg.product.title}</Text>
                <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
                <Text style={styles.packagePeriod}>
                  {pkg.packageType === 'ANNUAL' ? 'per year · save 40%' : 'per month'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        // Placeholder when not connected to RevenueCat yet
        <View style={styles.packages}>
          <View style={[styles.packageCard, styles.packageCardSelected]}>
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Most Popular</Text>
            </View>
            <Text style={styles.packageName}>Pro Monthly</Text>
            <Text style={styles.packagePrice}>$9.99</Text>
            <Text style={styles.packagePeriod}>per month</Text>
          </View>
          <View style={styles.packageCard}>
            <Text style={styles.packageName}>Pro Annual</Text>
            <Text style={styles.packagePrice}>$59.99</Text>
            <Text style={styles.packagePeriod}>per year · save 50%</Text>
          </View>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={[styles.ctaBtn, purchasing && styles.ctaBtnDisabled]}
        onPress={handlePurchase}
        disabled={purchasing}
      >
        {purchasing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaBtnText}>
            Start Pro {activePackage ? `· ${activePackage.product.priceString}` : ''}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.legal}>
        Subscription auto-renews. Cancel anytime in your App Store / Play Store settings.
      </Text>

      <TouchableOpacity onPress={handleRestore} disabled={restoring} style={styles.restoreBtn}>
        {restoring ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Text style={styles.restoreText}>Restore purchases</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={styles.skipBtn}>
        <Text style={styles.skipText}>Maybe later</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 28 },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  proBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
  comparisonCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  comparisonHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  comparisonTitle: { flex: 1, fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  colFree: { width: 60, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  colPro: { width: 70, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#7c3aed' },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  featureLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureLabel: { fontSize: 13, color: '#374151', flex: 1 },
  colFreeVal: { width: 60, textAlign: 'center', fontSize: 12, color: '#9ca3af' },
  colProVal: { width: 70, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#7c3aed' },
  packages: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  packageCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  packageCardSelected: { borderColor: '#7c3aed', backgroundColor: '#faf5ff' },
  popularBadge: { backgroundColor: '#7c3aed', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginBottom: 8 },
  popularText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  packageName: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  packagePrice: { fontSize: 22, fontWeight: '800', color: '#111827' },
  packagePeriod: { fontSize: 11, color: '#9ca3af', marginTop: 2, textAlign: 'center' },
  ctaBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  ctaBtnDisabled: { opacity: 0.7 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  legal: { fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 16, marginBottom: 16 },
  restoreBtn: { alignItems: 'center', marginBottom: 12 },
  restoreText: { color: '#6b7280', fontSize: 13 },
  skipBtn: { alignItems: 'center' },
  skipText: { color: '#9ca3af', fontSize: 13 },
});
