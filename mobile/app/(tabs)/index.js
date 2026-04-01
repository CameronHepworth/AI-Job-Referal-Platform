import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { companyService } from '../../services/api';

function TopCompanyRow({ company, onPress }) {
  const score = company.hiringScore || 0;
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#6b7280';
  return (
    <TouchableOpacity style={styles.companyRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.companyAvatar}>
        <Text style={styles.companyAvatarText}>{company.name[0].toUpperCase()}</Text>
      </View>
      <Text style={styles.companyName} numberOfLines={1}>{company.name}</Text>
      <Text style={[styles.companyScore, { color }]}>{score}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [watchlist, setWatchlist] = useState([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [wlRes, alertRes] = await Promise.all([
        companyService.getWatchlist(),
        companyService.getAlerts(),
      ]);
      setWatchlist(wlRes.data.watchlist ?? []);
      setUnreadAlerts((alertRes.data.alerts ?? []).filter((a) => !a.read).length);
    } catch {
      // fail silently
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const topCompanies = [...(watchlist || [])]
    .sort((a, b) => (b.hiringScore || 0) - (a.hiringScore || 0))
    .slice(0, 3);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>Hey, {user?.name} 👋</Text>
        <Text style={styles.subText}>Here's what's happening today</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{watchlist.length}</Text>
          <Text style={styles.statLabel}>Watching</Text>
        </View>
        <TouchableOpacity style={[styles.statCard, unreadAlerts > 0 && styles.statCardAlert]} onPress={() => router.push('/(tabs)/alerts')}>
          <Text style={[styles.statValue, unreadAlerts > 0 && { color: '#4f46e5' }]}>{unreadAlerts}</Text>
          <Text style={styles.statLabel}>New Alerts</Text>
        </TouchableOpacity>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {watchlist.filter((c) => (c.hiringScore || 0) >= 70).length}
          </Text>
          <Text style={styles.statLabel}>Hot</Text>
        </View>
      </View>

      {/* Top opportunities */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Top Opportunities</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {topCompanies.length > 0 ? (
          topCompanies.map((c) => (
            <TopCompanyRow
              key={c._id}
              company={c}
              onPress={() => router.push(`/company/${c._id}`)}
            />
          ))
        ) : (
          <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/search')}>
            <Ionicons name="add-circle-outline" size={24} color="#4f46e5" />
            <Text style={styles.emptyCardText}>Add companies to your watchlist</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/search')}>
          <View style={styles.actionIcon}>
            <Ionicons name="search-outline" size={18} color="#4f46e5" />
          </View>
          <Text style={styles.actionText}>Search & watch a company</Text>
          <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(tabs)/alerts')}>
          <View style={styles.actionIcon}>
            <Ionicons name="notifications-outline" size={18} color="#4f46e5" />
          </View>
          <Text style={styles.actionText}>View hiring alerts</Text>
          <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20 },
  greeting: { marginBottom: 20 },
  greetingText: { fontSize: 26, fontWeight: '700', color: '#111827' },
  subText: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  statCardAlert: { borderWidth: 1.5, borderColor: '#4f46e5' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  seeAll: { fontSize: 13, color: '#4f46e5', fontWeight: '600' },
  companyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  companyAvatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  companyAvatarText: { fontSize: 14, fontWeight: '700', color: '#4f46e5' },
  companyName: { flex: 1, fontSize: 14, fontWeight: '500', color: '#111827' },
  companyScore: { fontSize: 16, fontWeight: '700' },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#f9fafb', borderRadius: 12 },
  emptyCardText: { color: '#4f46e5', fontWeight: '600', fontSize: 14 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  actionIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontSize: 14, color: '#374151' },
});
