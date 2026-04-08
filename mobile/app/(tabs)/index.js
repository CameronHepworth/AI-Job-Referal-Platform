import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { companyService } from '../../services/api';

function TopCompanyRow({ company, onPress, colors }) {
  const score = company.hiringScore || 0;
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : colors.textMuted;
  return (
    <TouchableOpacity style={styles.companyRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.companyAvatar, { backgroundColor: colors.primaryLight }]}>
        <Text style={[styles.companyAvatarText, { color: colors.primary }]}>{company.name[0].toUpperCase()}</Text>
      </View>
      <Text style={[styles.companyName, { color: colors.text }]} numberOfLines={1}>{company.name}</Text>
      <Text style={[styles.companyScore, { color }]}>{score}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
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
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <View style={styles.greeting}>
        <Text style={[styles.greetingText, { color: colors.text }]}>Hey, {user?.name} 👋</Text>
        <Text style={[styles.subText, { color: colors.textSecondary }]}>Here's what's happening today</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{watchlist.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Watching</Text>
        </View>
        <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.surface }, unreadAlerts > 0 && { borderWidth: 1.5, borderColor: colors.primary }]} onPress={() => router.push('/(tabs)/alerts')}>
          <Text style={[styles.statValue, { color: unreadAlerts > 0 ? colors.primary : colors.text }]}>{unreadAlerts}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>New Alerts</Text>
        </TouchableOpacity>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {watchlist.filter((c) => (c.hiringScore || 0) >= 70).length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Hot</Text>
        </View>
      </View>

      {/* Top opportunities */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Top Opportunities</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>
        {topCompanies.length > 0 ? (
          topCompanies.map((c) => (
            <TopCompanyRow key={c._id} company={c} onPress={() => router.push(`/company/${c._id}`)} colors={colors} />
          ))
        ) : (
          <TouchableOpacity style={[styles.emptyCard, { backgroundColor: colors.surfaceSecondary }]} onPress={() => router.push('/search')}>
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            <Text style={[styles.emptyCardText, { color: colors.primary }]}>Add companies to your watchlist</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick actions */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Quick Actions</Text>
        <TouchableOpacity style={[styles.actionRow, { borderBottomColor: colors.surfaceSecondary }]} onPress={() => router.push('/search')}>
          <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="search-outline" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.actionText, { color: colors.text }]}>Search & watch a company</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionRow, { borderBottomColor: colors.surfaceSecondary }]} onPress={() => router.push('/(tabs)/alerts')}>
          <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.actionText, { color: colors.text }]}>View hiring alerts</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  greeting: { marginBottom: 20 },
  greetingText: { fontSize: 26, fontWeight: '700' },
  subText: { fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, borderRadius: 14, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1,
  },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  card: {
    borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  seeAll: { fontSize: 13, fontWeight: '600' },
  companyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  companyAvatar: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  companyAvatarText: { fontSize: 14, fontWeight: '700' },
  companyName: { flex: 1, fontSize: 14, fontWeight: '500' },
  companyScore: { fontSize: 16, fontWeight: '700' },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 12 },
  emptyCardText: { fontWeight: '600', fontSize: 14 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, borderBottomWidth: 1 },
  actionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontSize: 14 },
});
