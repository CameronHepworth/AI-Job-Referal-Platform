import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, TextInput, Modal, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../context/AuthContext';
import { usePurchase } from '../../context/PurchaseContext';
import { useTheme } from '../../context/ThemeContext';
import { authService, userService, resumeService } from '../../services/api';

// ---------------------------------------------------------------------------
// Edit field modal — reused for name and email
// ---------------------------------------------------------------------------
function EditModal({ visible, title, placeholder, value, onClose, onSave, keyboardType, note }) {
  const [text, setText] = useState(value);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(text.trim());
      onClose();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not save changes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={modalStyles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={modalStyles.title}>{title}</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#4f46e5" />
              : <Text style={modalStyles.save}>Save</Text>}
          </TouchableOpacity>
        </View>
        <TextInput
          style={modalStyles.input}
          value={text}
          onChangeText={setText}
          autoFocus
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          keyboardType={keyboardType || 'default'}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        />
        {note && <Text style={modalStyles.note}>{note}</Text>}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Delete account modal — requires password confirmation
// ---------------------------------------------------------------------------
function DeleteModal({ visible, onClose, onConfirm }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }
    setLoading(true);
    try {
      await onConfirm(password);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not delete account');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={modalStyles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={modalStyles.title}>Delete Account</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={modalStyles.deleteWarn}>
          <Ionicons name="warning-outline" size={32} color="#ef4444" />
          <Text style={modalStyles.deleteWarnTitle}>This cannot be undone</Text>
          <Text style={modalStyles.deleteWarnText}>
            All your data, watchlist, and alerts will be permanently deleted.
          </Text>
        </View>
        <Text style={modalStyles.inputLabel}>Enter your password to confirm</Text>
        <TextInput
          style={modalStyles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          autoFocus
        />
        <TouchableOpacity style={modalStyles.deleteBtn} onPress={handleDelete} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={modalStyles.deleteBtnText}>Permanently Delete Account</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main profile screen
// ---------------------------------------------------------------------------
export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const { isPro, purchasePackage, restorePurchases, devTogglePro } = usePurchase();
  const { isDark, toggleDark, colors } = useTheme();
  const router = useRouter();

  const [sendingReset, setSendingReset] = useState(false);
  const [editName, setEditName] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [uploadingResume, setUploadingResume] = useState(false);

  const handleResetOnboarding = async () => {
    await AsyncStorage.removeItem('onboarding_complete');
    router.replace('/onboarding');
  };

  const handleResetPassword = async () => {
    Alert.alert(
      'Reset password',
      `We'll send a reset code to ${user?.email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send code',
          onPress: async () => {
            setSendingReset(true);
            try {
              await authService.forgotPassword(user.email);
              router.push({ pathname: '/reset-password', params: { email: user.email } });
            } catch {
              Alert.alert('Error', 'Could not send reset code. Please try again.');
            } finally {
              setSendingReset(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveName = async (name) => {
    const res = await userService.updateProfile({ name });
    await updateUser({ name: res.data.user.name });
  };

  const handleSaveEmail = async (email) => {
    const res = await userService.updateProfile({ email });
    await updateUser({ email: res.data.user.email });
  };

  const handleDeleteAccount = async (password) => {
    await userService.deleteAccount(password);
    await logout();
  };

  const handleUploadResume = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      setUploadingResume(true);

      const formData = new FormData();
      formData.append('resume', {
        uri: file.uri,
        name: file.name,
        type: 'application/pdf',
      });

      const res = await resumeService.upload(formData);
      await updateUser({ resumeData: res.data.resumeData });
      Alert.alert('Resume uploaded', 'Your resume has been parsed and will be used to personalise outreach messages.');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Upload failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setUploadingResume(false);
    }
  }, [updateUser]);

  const handleRemoveResume = () => {
    Alert.alert('Remove resume', 'Your resume data will be deleted and messages will no longer be personalised.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await resumeService.remove();
            await updateUser({ resumeData: null });
          } catch {
            Alert.alert('Error', 'Could not remove resume. Please try again.');
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={[styles.avatarSection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
        <View style={[styles.badge, isPro ? styles.badgePro : { backgroundColor: colors.borderStrong }]}>
          <Text style={[styles.badgeText, isPro && { color: '#fff' }]}>{isPro ? '✦ Pro' : 'Free Plan'}</Text>
        </View>
      </View>

      {/* Account section */}
      <SectionHeader label="Account" colors={colors} />
      <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MenuRow icon="person-outline" label="Full Name" value={user?.name} onPress={() => setEditName(true)} colors={colors} />
        <MenuRow icon="mail-outline" label="Email Address" value={user?.email} onPress={() => setEditEmail(true)} colors={colors} />
        <MenuRow
          icon="key-outline"
          label="Reset Password"
          onPress={handleResetPassword}
          right={sendingReset ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          colors={colors}
        />
      </View>

      {/* Resume section */}
      <SectionHeader label="Resume" colors={colors} />
      <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {user?.resumeData?.uploadedAt ? (
          <>
            <View style={styles.menuItem}>
              <Ionicons name="document-text" size={20} color="#4f46e5" />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Resume uploaded</Text>
                <Text style={styles.menuSub}>
                  {user.resumeData.skills?.slice(0, 3).join(', ')}
                  {user.resumeData.skills?.length > 3 ? ` +${user.resumeData.skills.length - 3} more` : ''}
                </Text>
              </View>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>Active</Text>
              </View>
            </View>
            <MenuRow
              icon="cloud-upload-outline"
              label="Replace Resume"
              onPress={handleUploadResume}
              right={uploadingResume ? <ActivityIndicator size="small" color="#4f46e5" /> : undefined}
            />
            <MenuRow icon="trash-outline" label="Remove Resume" onPress={handleRemoveResume} />
          </>
        ) : (
          <TouchableOpacity style={styles.menuItem} onPress={handleUploadResume} disabled={uploadingResume}>
            <Ionicons name="cloud-upload-outline" size={20} color="#6b7280" />
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Upload Resume</Text>
              <Text style={styles.menuSub}>PDF · personalises outreach messages</Text>
            </View>
            {uploadingResume
              ? <ActivityIndicator size="small" color="#4f46e5" />
              : <Ionicons name="chevron-forward" size={16} color="#d1d5db" />}
          </TouchableOpacity>
        )}
      </View>

      {/* Plan section */}
      <SectionHeader label="Plan" colors={colors} />
      <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {isPro ? (
          <>
            <View style={styles.menuItem}>
              <Ionicons name="star" size={20} color="#4f46e5" />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>GhostJob Pro</Text>
                <Text style={styles.menuSub}>Unlimited watchlist · all features</Text>
              </View>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>Active</Text>
              </View>
            </View>
            <MenuRow icon="card-outline" label="Manage Subscription" onPress={() => Alert.alert('Manage Subscription', 'To manage or cancel your subscription, go to Settings → Apple ID → Subscriptions on your device.')} />
            <MenuRow icon="refresh-outline" label="Restore Purchases" onPress={restorePurchases} />
          </>
        ) : (
          <TouchableOpacity style={styles.upgradeRow} onPress={() => router.push('/paywall')}>
            <View style={styles.upgradeLeft}>
              <Ionicons name="star-outline" size={20} color="#7c3aed" />
              <View>
                <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
                <Text style={styles.upgradeSub}>Unlimited watchlist · hiring activity filters</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#7c3aed" />
          </TouchableOpacity>
        )}
      </View>

      {/* Preferences section */}
      <SectionHeader label="Preferences" colors={colors} />
      <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.menuItem, { borderBottomColor: colors.surfaceSecondary }]}>
          <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.menuLabel, { color: colors.text }]}>Push Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: colors.borderStrong, true: '#c7d2fe' }}
            thumbColor={notificationsEnabled ? colors.primary : colors.textMuted}
            style={{ marginLeft: 'auto' }}
          />
        </View>
        <View style={[styles.menuItem, { borderBottomColor: colors.surfaceSecondary }]}>
          <Ionicons name="moon-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.menuLabel, { color: colors.text }]}>Dark Mode</Text>
          <Switch
            value={isDark}
            onValueChange={toggleDark}
            trackColor={{ false: colors.borderStrong, true: '#c7d2fe' }}
            thumbColor={isDark ? colors.primary : colors.textMuted}
            style={{ marginLeft: 'auto' }}
          />
        </View>
      </View>

      {/* Support section */}
      <SectionHeader label="Support" colors={colors} />
      <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MenuRow icon="help-circle-outline" label="Help & Support" onPress={() => {}} colors={colors} />
        <MenuRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => router.push('/privacy-policy')} colors={colors} />
      </View>

      {/* DEV ONLY */}
      {__DEV__ && (
        <View style={styles.devSection}>
          <TouchableOpacity style={styles.devButton} onPress={handleResetOnboarding}>
            <Ionicons name="refresh-outline" size={18} color="#6b7280" />
            <Text style={styles.devText}>Reset Onboarding (Dev)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.devButton, { marginTop: 8 }]} onPress={devTogglePro}>
            <Ionicons name={isPro ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={18} color="#7c3aed" />
            <Text style={[styles.devText, { color: '#7c3aed' }]}>
              Switch to {isPro ? 'Free' : 'Pro'} (Dev)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sign out */}
      <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.dangerLight }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={[styles.logoutText, { color: colors.danger }]}>Sign out</Text>
      </TouchableOpacity>

      {/* Delete account */}
      <TouchableOpacity style={styles.deleteAccountBtn} onPress={() => setDeleteModal(true)}>
        <Text style={[styles.deleteAccountText, { color: colors.textMuted }]}>Delete Account</Text>
      </TouchableOpacity>

      {/* Modals */}
      <EditModal
        visible={editName}
        title="Edit Name"
        placeholder="Full name"
        value={user?.name || ''}
        onClose={() => setEditName(false)}
        onSave={handleSaveName}
      />
      <EditModal
        visible={editEmail}
        title="Edit Email"
        placeholder="Email address"
        value={user?.email || ''}
        onClose={() => setEditEmail(false)}
        onSave={handleSaveEmail}
        keyboardType="email-address"
        note="You'll need to sign in again after changing your email."
      />
      <DeleteModal
        visible={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </ScrollView>
  );
}

function SectionHeader({ label, colors }) {
  return <Text style={[styles.sectionHeader, { color: colors?.textMuted || '#9ca3af' }]}>{label}</Text>;
}

function MenuRow({ icon, label, value, onPress, right, colors }) {
  const c = colors || { text: '#374151', textSecondary: '#9ca3af', textMuted: '#6b7280', surfaceSecondary: '#f9fafb' };
  return (
    <TouchableOpacity style={[styles.menuItem, { borderBottomColor: c.surfaceSecondary }]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={c.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, { color: c.text }]}>{label}</Text>
        {value && <Text style={[styles.menuSub, { color: c.textMuted }]} numberOfLines={1}>{value}</Text>}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={16} color={c.borderStrong || '#d1d5db'} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingBottom: 48 },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#4f46e5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: '#111827' },
  email: { fontSize: 14, color: '#6b7280', marginTop: 2, marginBottom: 10 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeFree: { backgroundColor: '#e5e7eb' },
  badgePro: { backgroundColor: '#4f46e5' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  sectionHeader: {
    fontSize: 11, fontWeight: '600', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
  },
  menu: {
    backgroundColor: '#fff',
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
    gap: 12,
  },
  menuLabel: { fontSize: 15, color: '#374151' },
  menuSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  upgradeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#faf5ff',
  },
  upgradeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  upgradeTitle: { fontSize: 15, fontWeight: '600', color: '#7c3aed' },
  upgradeSub: { fontSize: 12, color: '#a78bfa', marginTop: 1 },
  proBadge: { backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  proBadgeText: { fontSize: 12, fontWeight: '600', color: '#4f46e5' },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 24, marginHorizontal: 20,
    padding: 15, borderRadius: 12, backgroundColor: '#fef2f2',
  },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  deleteAccountBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  deleteAccountText: { color: '#9ca3af', fontSize: 13 },
  devSection: { marginTop: 24, marginHorizontal: 20 },
  devButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 15, borderRadius: 12, backgroundColor: '#f3f4f6',
  },
  devText: { color: '#6b7280', fontSize: 14, fontWeight: '500' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cancel: { fontSize: 16, color: '#6b7280', width: 50 },
  save: { fontSize: 16, color: '#4f46e5', fontWeight: '600', width: 50, textAlign: 'right' },
  input: {
    margin: 20, padding: 14,
    backgroundColor: '#f9fafb',
    borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, fontSize: 16, color: '#111827',
  },
  inputLabel: { paddingHorizontal: 20, fontSize: 13, color: '#6b7280', marginBottom: 4 },
  note: { paddingHorizontal: 20, fontSize: 13, color: '#9ca3af', lineHeight: 18 },
  deleteWarn: {
    alignItems: 'center', margin: 20, padding: 20,
    backgroundColor: '#fef2f2', borderRadius: 16,
  },
  deleteWarnTitle: { fontSize: 16, fontWeight: '700', color: '#ef4444', marginTop: 8 },
  deleteWarnText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 4, lineHeight: 20 },
  deleteBtn: {
    margin: 20, backgroundColor: '#ef4444',
    paddingVertical: 15, borderRadius: 12, alignItems: 'center',
  },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
