import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { companyService, userService } from '../../services/api';
import { usePurchase } from '../../context/PurchaseContext';

const FREE_LIMIT = 5;

function ScoreBadge({ score }) {
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#6b7280';
  const bg = score >= 70 ? '#dcfce7' : score >= 40 ? '#fef3c7' : '#f3f4f6';
  const label = score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label} · {score}</Text>
    </View>
  );
}

function CompanyCard({ company, onPress, onUnwatch, alertsEnabled, onToggleAlert }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{company.name[0].toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.companyName}>{company.name}</Text>
          <Text style={styles.companyMeta} numberOfLines={1}>
            {company.hiringScoreSummary
              ? company.signals?.[0]?.summary || 'Tap to view signals'
              : 'Not yet scanned'}
          </Text>
          <View style={styles.alertRow}>
            <Ionicons
              name={alertsEnabled ? 'notifications' : 'notifications-off-outline'}
              size={12}
              color={alertsEnabled ? '#4f46e5' : '#9ca3af'}
            />
            <Text style={[styles.alertLabel, !alertsEnabled && styles.alertLabelMuted]}>
              {alertsEnabled ? 'Alerts on' : 'Alerts off'}
            </Text>
            <Switch
              value={alertsEnabled}
              onValueChange={() => onToggleAlert(company._id)}
              trackColor={{ false: '#e5e7eb', true: '#c7d2fe' }}
              thumbColor={alertsEnabled ? '#4f46e5' : '#9ca3af'}
              style={styles.switch}
            />
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        <ScoreBadge score={company.hiringScore || 0} />
        <TouchableOpacity
          onPress={() => onUnwatch(company._id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.removeBtn}
        >
          <Ionicons name="close-circle" size={20} color="#d1d5db" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function WatchlistScreen() {
  const [watchlist, setWatchlist] = useState(null);
  const [mutedCompanies, setMutedCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { isPro } = usePurchase();

  const load = useCallback(async () => {
    try {
      const watchlistRes = await companyService.getWatchlist();
      setWatchlist(watchlistRes.data.watchlist ?? []);
    } catch (err) {
      Alert.alert('Error', 'Could not load watchlist');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Load muted companies separately — don't block watchlist if this fails
    try {
      const userRes = await userService.getMe();
      setMutedCompanies(userRes.data.user.mutedCompanies ?? []);
    } catch (_) {}
  }, []);

  const handleToggleAlert = async (companyId) => {
    // Optimistically toggle in UI
    const isMuted = mutedCompanies.includes(companyId);
    setMutedCompanies((prev) =>
      isMuted ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
    try {
      const res = await userService.toggleMute(companyId);
      setMutedCompanies(res.data.mutedCompanies.map((id) => id.toString()));
    } catch {
      // Revert on failure
      setMutedCompanies((prev) =>
        isMuted ? [...prev, companyId] : prev.filter((id) => id !== companyId)
      );
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleUnwatch = (id) => {
    Alert.alert('Remove company', 'Stop watching this company?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await companyService.unwatch(id);
          setWatchlist((prev) => prev.filter((c) => c._id !== id));
        },
      },
    ]);
  };

  if (loading || watchlist === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={watchlist}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={watchlist.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Watchlist</Text>
              <Text style={styles.subtitle}>{watchlist.length} compan{watchlist.length === 1 ? 'y' : 'ies'} tracked</Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                if (!isPro && (watchlist?.length ?? 0) >= FREE_LIMIT) {
                  router.push('/paywall');
                } else {
                  router.push('/search');
                }
              }}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No companies yet</Text>
            <Text style={styles.emptyText}>Search for companies to track their hiring signals</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/search')}>
              <Text style={styles.emptyBtnText}>Search Companies</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <CompanyCard
            company={item}
            onPress={() => router.push(`/company/${item._id}`)}
            onUnwatch={handleUnwatch}
            alertsEnabled={!mutedCompanies.includes(item._id.toString())}
            onToggleAlert={handleToggleAlert}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  emptyContainer: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  addBtn: {
    backgroundColor: '#4f46e5',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#4f46e5' },
  cardInfo: { flex: 1 },
  companyName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  companyMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  removeBtn: { marginTop: 2 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  alertLabel: { fontSize: 11, color: '#4f46e5', fontWeight: '500' },
  alertLabelMuted: { color: '#9ca3af' },
  switch: { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }], marginLeft: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 6, paddingHorizontal: 32 },
  emptyBtn: {
    marginTop: 24,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
