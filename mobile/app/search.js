import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { companyService } from '../services/api';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);
  const router = useRouter();

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await companyService.search(q);
      setResults(res.data.companies);
    } catch {
      Alert.alert('Error', 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (company) => {
    setAdding(company._id);
    try {
      await companyService.watch(company._id);
      Alert.alert('Added', `${company.name} added to your watchlist`);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not add company';
      Alert.alert('Error', msg);
    } finally {
      setAdding(null);
    }
  };

  // Create a new company and immediately watch it
  const handleCreateAndWatch = async () => {
    const q = query.trim();
    if (!q) return;
    setAdding('new');
    try {
      const createRes = await companyService.create({ name: q });
      await companyService.watch(createRes.data.company._id);
      Alert.alert('Added', `${q} added to your watchlist`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not add company';
      Alert.alert('Error', msg);
    } finally {
      setAdding(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Search companies..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          {searching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.length > 0 && !searching ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No results for "{query}"</Text>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={handleCreateAndWatch}
                disabled={adding === 'new'}
              >
                {adding === 'new' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createBtnText}>+ Add "{query}" to watchlist</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.resultRow}>
            <View style={styles.resultLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.resultName}>{item.name}</Text>
                {item.industry ? (
                  <Text style={styles.resultMeta}>{item.industry}</Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              style={styles.watchBtn}
              onPress={() => handleAdd(item)}
              disabled={adding === item._id}
            >
              {adding === item._id ? (
                <ActivityIndicator size="small" color="#4f46e5" />
              ) : (
                <Text style={styles.watchBtnText}>Watch</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  searchRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  searchIcon: { marginRight: 2 },
  input: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 10 },
  searchBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  list: { padding: 16 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  resultLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#4f46e5' },
  resultName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  resultMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  watchBtn: {
    borderWidth: 1.5,
    borderColor: '#4f46e5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  watchBtnText: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  noResults: { alignItems: 'center', paddingTop: 40 },
  noResultsText: { color: '#6b7280', fontSize: 15, marginBottom: 16 },
  createBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
