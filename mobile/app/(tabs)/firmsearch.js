import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { discoverService, companyService } from '../../services/api';
import { usePurchase } from '../../context/PurchaseContext';

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------
const INDUSTRIES = [
  { label: 'All', value: null },
  { label: 'Technology', value: 'Technology' },
  { label: 'AI', value: 'Artificial Intelligence' },
  { label: 'Fintech', value: 'Fintech' },
  { label: 'Healthcare', value: 'Healthcare' },
  { label: 'Education', value: 'Education' },
  { label: 'Aerospace', value: 'Aerospace' },
  { label: 'Food Tech', value: 'Food Tech' },
];

const SIZES = [
  { label: 'Any Size', value: null },
  { label: 'Startup', value: 'startup' },
  { label: 'SMB', value: 'smb' },
  { label: 'Mid-size', value: 'mid' },
  { label: 'Enterprise', value: 'enterprise' },
];

const JOB_TYPES = [
  { label: 'Any Role', value: null },
  { label: 'Engineering', value: 'engineering' },
  { label: 'Sales', value: 'sales' },
  { label: 'Design', value: 'design' },
  { label: 'Marketing', value: 'marketing' },
  { label: 'Operations', value: 'operations' },
  { label: 'Finance', value: 'finance' },
  { label: 'Legal', value: 'legal' },
];

const SCORE_FILTERS = [
  { label: 'Any Activity', value: null },
  { label: 'Some Activity', value: 30 },
  { label: 'Warm (40+)', value: 40 },
  { label: 'Hot (70+)', value: 70 },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FilterSection({ title, options, selected, onSelect }) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {options.map((o) => (
          <FilterChip
            key={String(o.value)}
            label={o.label}
            active={selected === o.value}
            onPress={() => onSelect(o.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ScoreBadge({ score }) {
  if (!score) return null;
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#6b7280';
  const bg = score >= 70 ? '#dcfce7' : score >= 40 ? '#fef3c7' : '#f3f4f6';
  const label = score >= 70 ? '🔥 Hot' : score >= 40 ? '⚡ Warm' : 'Cold';
  return (
    <View style={[styles.scoreBadge, { backgroundColor: bg }]}>
      <Text style={[styles.scoreBadgeText, { color }]}>{label} · {score}</Text>
    </View>
  );
}

const SIZE_LABELS = { startup: 'Startup', smb: 'SMB', mid: 'Mid-size', enterprise: 'Enterprise' };
const JOB_TYPE_LABELS = { engineering: 'Engineering', sales: 'Sales', design: 'Design', marketing: 'Marketing', operations: 'Operations', finance: 'Finance', legal: 'Legal' };

function CompanyCard({ company, onWatch, onPress, watching, isPro }) {
  // Build the full tag list from all available fields
  const allTags = [
    company.industry,
    company.size ? SIZE_LABELS[company.size] : null,
    company.remote ? 'Remote' : null,
    ...(company.jobTypes || []).map((j) => JOB_TYPE_LABELS[j] || j),
    ...(company.tags || []),
    company.signals?.length > 0 ? `${company.signals.length} signal${company.signals.length > 1 ? 's' : ''}` : null,
  ].filter(Boolean);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{company.name[0].toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{company.name}</Text>
          {isPro && company.hiringScore > 0 && <ScoreBadge score={company.hiringScore} />}
          <View style={styles.tagWrap}>
            {allTags.map((tag) => (
              <View
                key={tag}
                style={[
                  styles.tag,
                  tag === 'Remote' && styles.tagRemote,
                  tag.includes('signal') && styles.tagSignal,
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    tag === 'Remote' && { color: '#16a34a' },
                    tag.includes('signal') && { color: '#4f46e5' },
                  ]}
                >
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={styles.watchBtn}
        onPress={() => onWatch(company)}
        disabled={watching === company._id}
      >
        {watching === company._id ? (
          <ActivityIndicator size="small" color="#4f46e5" />
        ) : (
          <Ionicons name="add-circle-outline" size={26} color="#4f46e5" />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function FirmSearchScreen() {
  const router = useRouter();
  const { isPro } = usePurchase();
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState(null);
  const [size, setSize] = useState(null);
  const [jobType, setJobType] = useState(null);
  const [minScore, setMinScore] = useState(null);
  const [hiringOnly, setHiringOnly] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [watching, setWatching] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const handleSearch = useCallback(async () => {
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    try {
      const res = await discoverService.search({
        query: query.trim(),
        industry,
        size,
        jobType,
        minScore,
        hiringOnly,
      });
      setResults(res.data.companies);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Unknown error';
      console.error('[discover] search error:', detail, err?.response?.status);
      Alert.alert('Search Failed', detail);
    } finally {
      setLoading(false);
    }
  }, [query, industry, size, jobType, minScore, hiringOnly]);

  const handleWatch = async (company) => {
    setWatching(company._id);
    try {
      await companyService.watch(company._id);
      Alert.alert('Added', `${company.name} added to your watchlist`);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not add company';
      Alert.alert('Error', msg);
    } finally {
      setWatching(null);
    }
  };

  const clearFilters = () => {
    setIndustry(null);
    setSize(null);
    setJobType(null);
    setMinScore(null);
    setHiringOnly(false);
  };

  const hasActiveFilters = industry || size || jobType || minScore || hiringOnly;

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <View style={styles.inputWrap}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            style={styles.input}
            placeholder="Search firms by name..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Filters toggle */}
      <TouchableOpacity style={styles.filtersToggle} onPress={() => setFiltersOpen((v) => !v)}>
        <View style={styles.filtersToggleLeft}>
          <Ionicons name="options-outline" size={16} color="#4f46e5" />
          <Text style={styles.filtersToggleText}>Filters</Text>
          {hasActiveFilters && (
            <View style={styles.activeDot} />
          )}
        </View>
        <Ionicons name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
      </TouchableOpacity>

      {filtersOpen && (
        <View style={styles.filtersPanel}>
          <FilterSection title="Industry" options={INDUSTRIES} selected={industry} onSelect={setIndustry} />
          <FilterSection title="Firm Size" options={SIZES} selected={size} onSelect={setSize} />
          <FilterSection title="Job Type" options={JOB_TYPES} selected={jobType} onSelect={setJobType} />
          {/* Hiring Activity — Pro only */}
          {isPro ? (
            <>
              <FilterSection title="Hiring Activity" options={SCORE_FILTERS} selected={minScore} onSelect={setMinScore} />
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Quick Filters</Text>
                <TouchableOpacity
                  style={[styles.chip, hiringOnly && styles.chipActive]}
                  onPress={() => setHiringOnly((v) => !v)}
                >
                  <Ionicons name="trending-up" size={13} color={hiringOnly ? '#fff' : '#6b7280'} />
                  <Text style={[styles.chipText, hiringOnly && styles.chipTextActive]}> Active Hiring</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity style={styles.filterSection} onPress={() => router.push('/paywall')}>
              <Text style={styles.filterLabel}>Hiring Activity</Text>
              <View style={styles.proGateRow}>
                <Ionicons name="lock-closed" size={13} color="#7c3aed" />
                <Text style={styles.proGateText}>Filter by hiring score — Pro only</Text>
                <View style={styles.proGateBadge}>
                  <Text style={styles.proGateBadgeText}>Upgrade</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {hasActiveFilters && (
            <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Results */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Searching firms...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id}
          contentContainerStyle={results.length === 0 ? styles.emptyContainer : styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searched ? (
              <View style={styles.empty}>
                <Ionicons name="business-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyTitle}>No firms found</Text>
                <Text style={styles.emptyText}>Try adjusting your filters or search term</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="compass-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyTitle}>Discover firms</Text>
                <Text style={styles.emptyText}>Use the filters above to find companies that match what you're looking for</Text>
              </View>
            )
          }
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={styles.resultsCount}>{results.length} firm{results.length > 1 ? 's' : ''} found</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <CompanyCard
              company={item}
              onWatch={handleWatch}
              onPress={() => router.push(`/company/${item._id}`)}
              watching={watching}
              isPro={isPro}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  searchBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
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
  input: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 10 },
  searchBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  filtersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  filtersToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filtersToggleText: { fontSize: 14, fontWeight: '600', color: '#4f46e5' },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4f46e5' },
  filtersPanel: {
    backgroundColor: '#fff',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  filterSection: { paddingHorizontal: 16, paddingTop: 10 },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', gap: 8, paddingBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  clearBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  clearBtnText: { color: '#ef4444', fontSize: 13 },
  proGateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f3ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  proGateText: { flex: 1, fontSize: 13, color: '#7c3aed' },
  proGateBadge: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  proGateBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 14 },
  listContent: { padding: 16 },
  emptyContainer: { flex: 1, padding: 16 },
  resultsCount: { fontSize: 12, color: '#9ca3af', marginBottom: 12, fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 6, paddingHorizontal: 32, lineHeight: 20 },
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
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#4f46e5' },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  tag: { backgroundColor: '#f3f4f6', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagRemote: { backgroundColor: '#dcfce7' },
  tagSignal: { backgroundColor: '#ede9fe' },
  tagText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  scoreBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  scoreBadgeText: { fontSize: 11, fontWeight: '600' },
  watchBtn: { padding: 4 },
});
