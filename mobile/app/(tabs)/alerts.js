import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { companyService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

function AlertCard({ alert, onPress, colors }) {
  const isUnread = !alert.read;
  const score = alert.score || 0;
  const color = score >= 70 ? '#16a34a' : '#d97706';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }, isUnread && { borderLeftWidth: 3, borderLeftColor: colors.primary }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.dot, { backgroundColor: isUnread ? colors.primary : 'transparent' }]} />
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="trending-up" size={18} color={color} />
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{alert.title}</Text>
        <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={2}>{alert.body}</Text>
        <Text style={[styles.cardTime, { color: colors.textMuted }]}>
          {new Date(alert.createdAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      </View>
      <View style={[styles.scoreBadge, { backgroundColor: score >= 70 ? '#dcfce7' : '#fef3c7' }]}>
        <Text style={[styles.scoreText, { color }]}>{score}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { colors } = useTheme();

  const load = useCallback(async () => {
    try {
      const res = await companyService.getAlerts();
      setAlerts(res.data.alerts);
    } catch {
      // fail silently on refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePress = async (alert) => {
    if (!alert.read) {
      await companyService.markAlertRead(alert._id);
      setAlerts((prev) => prev.map((a) => a._id === alert._id ? { ...a, read: true } : a));
    }
    if (alert.company?._id) router.push(`/company/${alert.company._id}`);
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        contentContainerStyle={alerts.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Alerts</Text>
            {unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadText}>{unreadCount} new</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={48} color={colors.borderStrong} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No alerts yet</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Add companies to your watchlist and we'll alert you when hiring signals appear
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AlertCard alert={item} onPress={() => handlePress(item)} colors={colors} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  emptyContainer: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  unreadBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  card: {
    borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  cardBody: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  cardTime: { fontSize: 11, marginTop: 4 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: 'center' },
  scoreText: { fontSize: 13, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 6, paddingHorizontal: 32 },
});
