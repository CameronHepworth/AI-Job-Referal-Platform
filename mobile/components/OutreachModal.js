import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { outreachService } from '../services/api';
import { usePurchase } from '../context/PurchaseContext';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';

const TYPES = [
  { key: 'linkedin', label: 'LinkedIn Request', icon: 'people-outline', description: 'Short connection message' },
  { key: 'cold_email', label: 'Cold Email', icon: 'mail-outline', description: 'Full email with subject line' },
  { key: 'followup', label: 'Follow-up', icon: 'arrow-redo-outline', description: 'After no reply' },
];

export default function OutreachModal({ visible, onClose, companyId, companyName, hasResume }) {
  const [selectedType, setSelectedType] = useState('linkedin');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [personalized, setPersonalized] = useState(false);
  const [useCount, setUseCount] = useState(null);
  const { isPro } = usePurchase();
  const { colors } = useTheme();
  const router = useRouter();

  const FREE_MONTHLY_LIMIT = 3;
  const hitLimit = !isPro && useCount !== null && useCount >= FREE_MONTHLY_LIMIT;

  useEffect(() => {
    if (visible) {
      outreachService.getUsage().then((res) => {
        setUseCount(res.data.count);
      }).catch(() => setUseCount(0));
    }
  }, [visible]);

  const handleGenerate = async () => {
    if (hitLimit) { onClose(); router.push('/paywall'); return; }
    setLoading(true);
    setGenerated(false);
    try {
      const res = await outreachService.generate(companyId, selectedType);
      setMessage(res.data.message);
      setGenerated(true);
      setPersonalized(!!res.data.personalized);
      if (res.data.usage) setUseCount(res.data.usage.count);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Generation failed';
      if (err?.response?.data?.limitReached) { onClose(); router.push('/paywall'); return; }
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    Clipboard.setString(message);
    Alert.alert('Copied', 'Message copied to clipboard');
  };

  const handleClose = () => { setMessage(''); setGenerated(false); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Generate Outreach</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{companyName}</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Type selector */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Message Type</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeCard, { backgroundColor: colors.surface, borderColor: colors.borderStrong }, selectedType === t.key && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                onPress={() => { setSelectedType(t.key); setGenerated(false); setMessage(''); }}
              >
                <Ionicons name={t.icon} size={20} color={selectedType === t.key ? colors.primary : colors.textMuted} />
                <Text style={[styles.typeLabel, { color: colors.text }, selectedType === t.key && { color: colors.primary }]}>
                  {t.label}
                </Text>
                <Text style={[styles.typeDesc, { color: colors.textMuted }]}>{t.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Resume hint */}
          <View style={[styles.resumeBadge, { backgroundColor: hasResume ? colors.primaryLight : colors.surfaceSecondary }]}>
            <Ionicons name={hasResume ? 'document-text-outline' : 'information-circle-outline'} size={13} color={hasResume ? colors.primary : colors.textMuted} />
            <Text style={[styles.resumeBadgeText, { color: hasResume ? colors.primary : colors.textMuted }]}>
              {hasResume ? 'Personalised with your resume' : 'Upload a resume in Profile to personalise messages'}
            </Text>
          </View>

          {/* Usage */}
          {!isPro && (
            <Text style={[styles.usageText, { color: colors.textSecondary }]}>
              {hitLimit
                ? '⚡ Free limit reached — upgrade to Pro for unlimited'
                : `${FREE_MONTHLY_LIMIT - useCount} free generation${FREE_MONTHLY_LIMIT - useCount === 1 ? '' : 's'} remaining`}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.generateBtn, loading && styles.generateBtnDisabled, hitLimit && styles.generateBtnLocked]}
            onPress={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={hitLimit ? 'lock-closed-outline' : 'sparkles-outline'} size={18} color="#fff" />
                <Text style={styles.generateBtnText}>
                  {hitLimit ? 'Upgrade to Pro' : generated ? 'Regenerate' : 'Generate Message'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Generated message */}
          {generated && message ? (
            <View style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
              <View style={styles.messageHeader}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Your Message</Text>
                <TouchableOpacity style={[styles.copyBtn, { backgroundColor: colors.primaryLight }]} onPress={handleCopy}>
                  <Ionicons name="copy-outline" size={16} color={colors.primary} />
                  <Text style={[styles.copyBtnText, { color: colors.primary }]}>Copy</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.messageText, { color: colors.text }]}>{message}</Text>
              <View style={[styles.aiNotice, { borderTopColor: colors.border }]}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.aiNoticeText, { color: colors.textMuted }]}>
                  {personalized ? 'Personalised with your resume · review before sending' : 'AI-generated — personalise before sending'}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingTop: 24, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  closeBtn: { padding: 4 },
  content: { padding: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  typeRow: { gap: 10, marginBottom: 24 },
  typeCard: { borderRadius: 12, padding: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  typeDesc: { fontSize: 12 },
  generateBtn: { backgroundColor: '#4f46e5', paddingVertical: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 },
  generateBtnDisabled: { opacity: 0.7 },
  generateBtnLocked: { backgroundColor: '#7c3aed' },
  resumeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 12, alignSelf: 'center' },
  resumeBadgeText: { fontSize: 12, fontWeight: '500' },
  usageText: { fontSize: 12, textAlign: 'center', marginBottom: 10 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  messageCard: { borderRadius: 14, padding: 16, borderWidth: 1 },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  copyBtnText: { fontSize: 13, fontWeight: '600' },
  messageText: { fontSize: 14, lineHeight: 22 },
  aiNotice: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  aiNoticeText: { fontSize: 11 },
});
