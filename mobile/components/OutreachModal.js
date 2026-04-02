import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { outreachService } from '../services/api';
import { usePurchase } from '../context/PurchaseContext';
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
  const [useCount, setUseCount] = useState(null); // null = not yet loaded
  const { isPro } = usePurchase();
  const router = useRouter();

  const FREE_MONTHLY_LIMIT = 3;
  const hitLimit = !isPro && useCount !== null && useCount >= FREE_MONTHLY_LIMIT;

  // Load current usage from backend when modal opens
  useEffect(() => {
    if (visible) {
      outreachService.getUsage().then((res) => {
        setUseCount(res.data.count);
      }).catch(() => setUseCount(0));
    }
  }, [visible]);

  const handleGenerate = async () => {
    if (hitLimit) {
      onClose();
      router.push('/paywall');
      return;
    }
    setLoading(true);
    setGenerated(false);
    try {
      const res = await outreachService.generate(companyId, selectedType);
      setMessage(res.data.message);
      setGenerated(true);
      setPersonalized(!!res.data.personalized);
      // Update count from backend response
      if (res.data.usage) setUseCount(res.data.usage.count);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Generation failed';
      if (err?.response?.data?.limitReached) {
        onClose();
        router.push('/paywall');
        return;
      }
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    Clipboard.setString(message);
    Alert.alert('Copied', 'Message copied to clipboard');
  };

  const handleClose = () => {
    setMessage('');
    setGenerated(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Generate Outreach</Text>
            <Text style={styles.subtitle}>{companyName}</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Type selector */}
          <Text style={styles.sectionLabel}>Message Type</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeCard, selectedType === t.key && styles.typeCardActive]}
                onPress={() => { setSelectedType(t.key); setGenerated(false); setMessage(''); }}
              >
                <Ionicons
                  name={t.icon}
                  size={20}
                  color={selectedType === t.key ? '#4f46e5' : '#9ca3af'}
                />
                <Text style={[styles.typeLabel, selectedType === t.key && styles.typeLabelActive]}>
                  {t.label}
                </Text>
                <Text style={styles.typeDesc}>{t.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Resume personalisation hint */}
          {hasResume ? (
            <View style={styles.resumeBadge}>
              <Ionicons name="document-text-outline" size={13} color="#4f46e5" />
              <Text style={styles.resumeBadgeText}>Personalised with your resume</Text>
            </View>
          ) : (
            <View style={styles.resumeBadge}>
              <Ionicons name="information-circle-outline" size={13} color="#9ca3af" />
              <Text style={[styles.resumeBadgeText, { color: '#9ca3af' }]}>Upload a resume in Profile to personalise messages</Text>
            </View>
          )}

          {/* Generate button */}
          {!isPro && (
            <Text style={styles.usageText}>
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
            <View style={styles.messageCard}>
              <View style={styles.messageHeader}>
                <Text style={styles.sectionLabel}>Your Message</Text>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                  <Ionicons name="copy-outline" size={16} color="#4f46e5" />
                  <Text style={styles.copyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.messageText}>{message}</Text>
              <View style={styles.aiNotice}>
                <Ionicons name="information-circle-outline" size={14} color="#9ca3af" />
                <Text style={styles.aiNoticeText}>
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  closeBtn: { padding: 4 },
  content: { padding: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  typeRow: { gap: 10, marginBottom: 24 },
  typeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeCardActive: { borderColor: '#4f46e5', backgroundColor: '#faf5ff' },
  typeLabel: { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },
  typeLabelActive: { color: '#4f46e5' },
  typeDesc: { fontSize: 12, color: '#9ca3af' },
  generateBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  generateBtnDisabled: { opacity: 0.7 },
  generateBtnLocked: { backgroundColor: '#7c3aed' },
  resumeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, marginBottom: 12, alignSelf: 'center',
  },
  resumeBadgeText: { fontSize: 12, color: '#4f46e5', fontWeight: '500' },
  usageText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginBottom: 10 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  messageCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  copyBtnText: { color: '#4f46e5', fontSize: 13, fontWeight: '600' },
  messageText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  aiNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  aiNoticeText: { fontSize: 11, color: '#9ca3af' },
});
