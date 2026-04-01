import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { companyService } from '../../services/api';
import OutreachModal from '../../components/OutreachModal';

function SignalRow({ signal }) {
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
      style={styles.signalRow}
      onPress={() => signal.source && Linking.openURL(signal.source)}
      activeOpacity={0.7}
    >
      <View style={styles.signalIcon}>
        <Ionicons name={icon} size={16} color="#4f46e5" />
      </View>
      <View style={styles.signalContent}>
        <Text style={styles.signalText}>{signal.summary?.replace(/\b10 open roles\b/, '10+ open roles')}</Text>
        <Text style={styles.signalScore}>Signal strength: {signal.score}/100</Text>
      </View>
      {signal.source && (
        <Ionicons name="open-outline" size={14} color="#d1d5db" />
      )}
    </TouchableOpacity>
  );
}

function ScoreMeter({ score }) {
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#6b7280';
  const label = score >= 70 ? 'High hiring likelihood' : score >= 40 ? 'Moderate signals' : 'Low activity';
  return (
    <View style={styles.scoreWrap}>
      <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.meterBg}>
        <View style={[styles.meterFill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
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
      if (isWatching) {
        await companyService.unwatch(id);
        setIsWatching(false);
      } else {
        await companyService.watch(id);
        setIsWatching(true);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Action failed';
      Alert.alert('Error', msg);
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.companyHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{company.name[0].toUpperCase()}</Text>
        </View>
        <View style={styles.companyMeta}>
          <Text style={styles.companyName}>{company.name}</Text>
          {company.industry && <Text style={styles.industryText}>{company.industry}</Text>}
        </View>
      </View>

      {/* Outreach modal */}
      <OutreachModal
        visible={outreachVisible}
        onClose={() => setOutreachVisible(false)}
        companyId={id}
        companyName={company.name}
      />

      {/* Watch / Scan buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.watchBtn, isWatching && styles.watchBtnActive]}
          onPress={handleToggleWatch}
          disabled={toggling}
        >
          {toggling ? (
            <ActivityIndicator size="small" color={isWatching ? '#4f46e5' : '#fff'} />
          ) : (
            <>
              <Ionicons
                name={isWatching ? 'bookmark' : 'bookmark-outline'}
                size={16}
                color={isWatching ? '#4f46e5' : '#fff'}
              />
              <Text style={[styles.watchBtnText, isWatching && styles.watchBtnTextActive]}>
                {isWatching ? 'Watching' : 'Watch'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.scanBtn} onPress={handleScan} disabled={scanning}>
          {scanning ? (
            <ActivityIndicator size="small" color="#4f46e5" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={16} color="#4f46e5" />
              <Text style={styles.scanBtnText}>Scan Now</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Hiring score */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hiring Score</Text>
        <ScoreMeter score={company.hiringScore || 0} />
        {company.lastScanned && (
          <Text style={styles.lastScanned}>
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
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Signals Detected</Text>
        {company.signals && company.signals.length > 0 ? (
          company.signals.map((signal, i) => <SignalRow key={i} signal={signal} />)
        ) : (
          <Text style={styles.noSignals}>No signals yet — tap Scan Now to check.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  companyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#4f46e5' },
  companyMeta: { flex: 1 },
  companyName: { fontSize: 22, fontWeight: '700', color: '#111827' },
  industryText: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  watchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 12,
  },
  watchBtnActive: { backgroundColor: '#ede9fe', borderWidth: 1.5, borderColor: '#4f46e5' },
  watchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  watchBtnTextActive: { color: '#4f46e5' },
  scanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 12,
  },
  scanBtnText: { color: '#4f46e5', fontWeight: '600', fontSize: 14 },
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
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  scoreWrap: { alignItems: 'center', paddingVertical: 8 },
  scoreNumber: { fontSize: 52, fontWeight: '800' },
  scoreLabel: { fontSize: 14, color: '#6b7280', marginTop: 4, marginBottom: 12 },
  meterBg: { width: '100%', height: 8, backgroundColor: '#f3f4f6', borderRadius: 4 },
  meterFill: { height: 8, borderRadius: 4 },
  lastScanned: { fontSize: 11, color: '#d1d5db', textAlign: 'center', marginTop: 12 },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  signalIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalContent: { flex: 1 },
  signalText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  signalScore: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  noSignals: { color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  outreachBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  outreachBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
