import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { companyService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import OutreachModal from '../../components/OutreachModal';

function SignalRow({ signal, colors }) {
  const iconMap = {
    job_posting_spike: 'briefcase-outline',
    news: 'newspaper-outline',
    funding_round: 'cash-outline',
    exec_hire: 'person-add-outline',
    expansion: 'globe-outline',
    hn_hiring: 'logo-hackernews',
    headcount_growth: 'people-outline',
  };
  const icon = iconMap[signal.type] || 'alert-circle-outline';

  return (
    <TouchableOpacity
      style={[styles.signalRow, { borderBottomColor: colors.border }]}
      onPress={() => signal.source && Linking.openURL(signal.source)}
      activeOpacity={0.7}
    >
      <View style={[styles.signalIcon, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.signalContent}>
        <Text style={[styles.signalText, { color: colors.text }]}>{signal.summary?.replace(/\b10 open roles\b/, '10+ open roles')}</Text>
        <Text style={[styles.signalScore, { color: colors.textMuted }]}>Signal strength: {signal.score}/100</Text>
      </View>
      {signal.source && <Ionicons name="open-outline" size={14} color={colors.borderStrong} />}
    </TouchableOpacity>
  );
}

function ScoreMeter({ score, colors }) {
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : colors.textMuted;
  const label = score >= 70 ? 'High hiring likelihood' : score >= 40 ? 'Moderate signals' : 'Low activity';
  return (
    <View style={styles.scoreWrap}>
      <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
      <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.meterBg, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={[styles.meterFill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [company, setCompany] = useState(null);
  const [isWatching, setIsWatching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [outreachVisible, setOutreachVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await companyService.getById(id);
        setCompany(res.data.company);
        setIsWatching(res.data.isWatching);
      } catch {
        Alert.alert('Error', 'Could not load company');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleToggleWatch = async () => {
    setToggling(true);
    try {
      if (isWatching) { await companyService.unwatch(id); setIsWatching(false); }
      else { await companyService.watch(id); setIsWatching(true); }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Action failed');
    } finally {
      setToggling(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await companyService.scan(id);
      setCompany(res.data.company);
      Alert.alert('Scan complete', `Hiring score: ${res.data.hiringScore}`);
    } catch {
      Alert.alert('Error', 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.companyHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{company.name[0].toUpperCase()}</Text>
        </View>
        <View style={styles.companyMeta}>
          <Text style={[styles.companyName, { color: colors.text }]}>{company.name}</Text>
          {company.industry && <Text style={[styles.industryText, { color: colors.textSecondary }]}>{company.industry}</Text>}
        </View>
      </View>

      <OutreachModal
        visible={outreachVisible}
        onClose={() => setOutreachVisible(false)}
        companyId={id}
        companyName={company.name}
        hasResume={!!user?.resumeData?.uploadedAt}
      />

      {/* Watch / Scan buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.watchBtn, { backgroundColor: colors.primary }, isWatching && { backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary }]}
          onPress={handleToggleWatch}
          disabled={toggling}
        >
          {toggling ? (
            <ActivityIndicator size="small" color={isWatching ? colors.primary : '#fff'} />
          ) : (
            <>
              <Ionicons name={isWatching ? 'bookmark' : 'bookmark-outline'} size={16} color={isWatching ? colors.primary : '#fff'} />
              <Text style={[styles.watchBtnText, { color: isWatching ? colors.primary : '#fff' }]}>
                {isWatching ? 'Watching' : 'Watch'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.scanBtn, { borderColor: colors.primary }]} onPress={handleScan} disabled={scanning}>
          {scanning ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={16} color={colors.primary} />
              <Text style={[styles.scanBtnText, { color: colors.primary }]}>Scan Now</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Hiring score */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Hiring Score</Text>
        <ScoreMeter score={company.hiringScore || 0} colors={colors} />
        {company.lastScanned && (
          <Text style={[styles.lastScanned, { color: colors.textMuted }]}>
            Last scanned: {new Date(company.lastScanned).toLocaleDateString()}
          </Text>
        )}
      </View>

      {/* Outreach button */}
      <TouchableOpacity style={styles.outreachBtn} onPress={() => setOutreachVisible(true)}>
        <Ionicons name="sparkles-outline" size={18} color="#fff" />
        <Text style={styles.outreachBtnText}>Generate Outreach Message</Text>
      </TouchableOpacity>

      {/* Signals */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Signals Detected</Text>
        {company.signals && company.signals.length > 0 ? (
          company.signals.map((signal, i) => <SignalRow key={i} signal={signal} colors={colors} />)
        ) : (
          <Text style={[styles.noSignals, { color: colors.textMuted }]}>No signals yet — tap Scan Now to check.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  companyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700' },
  companyMeta: { flex: 1 },
  companyName: { fontSize: 22, fontWeight: '700' },
  industryText: { fontSize: 13, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  watchBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  watchBtnText: { fontWeight: '600', fontSize: 14 },
  scanBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, paddingVertical: 12, borderRadius: 12 },
  scanBtnText: { fontWeight: '600', fontSize: 14 },
  card: {
    borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  scoreWrap: { alignItems: 'center', paddingVertical: 8 },
  scoreNumber: { fontSize: 52, fontWeight: '800' },
  scoreLabel: { fontSize: 14, marginTop: 4, marginBottom: 12 },
  meterBg: { width: '100%', height: 8, borderRadius: 4 },
  meterFill: { height: 8, borderRadius: 4 },
  lastScanned: { fontSize: 11, textAlign: 'center', marginTop: 12 },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  signalIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  signalContent: { flex: 1 },
  signalText: { fontSize: 13, lineHeight: 18 },
  signalScore: { fontSize: 11, marginTop: 2 },
  noSignals: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  outreachBtn: { backgroundColor: '#7c3aed', paddingVertical: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  outreachBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
