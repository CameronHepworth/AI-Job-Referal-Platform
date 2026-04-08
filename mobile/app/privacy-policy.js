import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
      <Text style={[styles.date, { color: colors.textMuted }]}>Last updated: April 2026</Text>

      <Section title="Overview" colors={colors}>
        GhostJob ("we", "our", or "us") is committed to protecting your privacy. This policy explains what
        information we collect, how we use it, and your rights regarding your data.
      </Section>

      <Section title="Information We Collect" colors={colors}>
        {`• Account information: name and email address when you register.\n• Resume data: if you upload a resume, we extract structured information (skills, job titles, industries) to personalise outreach messages. The original file is not stored.\n• Usage data: which companies you watch, alerts you receive, and outreach messages you generate.\n• Device token: your push notification token, used only to send you hiring alerts.\n• Payment information: processed entirely by Apple (App Store). We do not store card details.`}
      </Section>

      <Section title="How We Use Your Information" colors={colors}>
        {`• To provide and improve the GhostJob service.\n• To generate personalised outreach messages using your resume data.\n• To send push notifications about hiring signals for companies you watch.\n• To enforce plan limits (free vs. Pro) and process subscription status.\n• We do not sell your personal data to third parties.`}
      </Section>

      <Section title="Third-Party Services" colors={colors}>
        {`• Anthropic Claude API: resume parsing and outreach message generation. Your resume text is sent to Anthropic's API for processing.\n• RevenueCat: subscription management.\n• MongoDB Atlas: secure cloud database hosting.\n• Railway: backend hosting provider.\n• Clearbit: company name autocomplete (no personal data shared).`}
      </Section>

      <Section title="Data Retention" colors={colors}>
        Your account data is retained until you delete your account. You can delete your account at any time
        from Profile → Delete Account, which permanently removes all your data including watchlist,
        alerts, and resume information.
      </Section>

      <Section title="Your Rights" colors={colors}>
        {`• Access: you can view your account data in the app at any time.\n• Correction: update your name or email in Profile → Account.\n• Deletion: delete your account and all associated data from Profile → Delete Account.\n• Data portability: contact us to request an export of your data.`}
      </Section>

      <Section title="Children's Privacy" colors={colors}>
        GhostJob is not directed at children under 13. We do not knowingly collect personal information
        from children under 13.
      </Section>

      <Section title="Contact" colors={colors}>
        {`For privacy questions or data requests, contact us at:\ncameronghepworth@gmail.com`}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children, colors }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  date: { fontSize: 13, marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 22 },
});
