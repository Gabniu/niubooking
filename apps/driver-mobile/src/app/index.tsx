import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  useFonts,
} from '@expo-google-fonts/hanken-grotesk';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  canvas: '#F7F9FD',
  surface: '#FFFFFF',
  blue: '#140BA7',
  deepBlue: '#0D0778',
  softBlue: '#E9E8FB',
  iconBlue: '#C2D2FF',
  text: '#171717',
  secondary: '#64748B',
  border: '#E5E7EB',
  amber: '#B45309',
};

function Step({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View>
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepCopy}>{copy}</Text>
      </View>
    </View>
  );
}

export default function DriverHomeScreen() {
  const [fontsLoaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
  });
  const configured = false;

  if (!fontsLoaded) {
    return <View style={styles.loading}><ActivityIndicator color={colors.blue} /></View>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>N</Text></View>
          <View>
            <Text style={styles.brand}>NIU Driver</Text>
            <Text style={styles.brandSub}>Assigned trip companion</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: configured ? '#16A34A' : colors.amber }]} />
            <Text style={styles.statusText}>{configured ? 'Ready' : 'Setup pending'}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>DRIVER CONSOLE</Text>
          <Text style={styles.title}>Ready when you are.</Text>
          <Text style={styles.subtitle}>
            Sign in to see your assigned trip, then choose when to share your live location with dispatch.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIcon}><Text style={styles.cardIconText}>↗</Text></View>
          <Text style={styles.cardEyebrow}>ACCOUNT CONNECTION</Text>
          <Text style={styles.cardTitle}>Connect your account</Text>
          <Text style={styles.cardCopy}>
            NOVA Auth keeps your identity separate from trip permissions. Your location is never shared before you start an assigned trip.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !configured }}
            disabled={!configured}
            style={({ pressed }) => [styles.primaryButton, pressed && configured && styles.pressed, !configured && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>{configured ? 'Continue to sign in  →' : 'Sign-in setup pending'}</Text>
          </Pressable>
          {!configured && <Text style={styles.hint}>A server connection is required before sign-in can begin.</Text>}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>What happens next</Text>
          <Text style={styles.sectionMeta}>Three simple steps</Text>
        </View>
        <View style={styles.stepsCard}>
          <Step number="1" title="Sign in" copy="Use your NIU account to access only the trips assigned to you." />
          <Step number="2" title="Allow location" copy="Choose the permission that matches your shift and device settings." />
          <Step number="3" title="Start sharing" copy="Begin a trip to send secure updates to dispatch and approved viewers." />
        </View>

        <View style={styles.privacyNote}>
          <Text style={styles.privacyIcon}>◈</Text>
          <Text style={styles.privacyText}>You can stop sharing at any time. Offline updates wait on the device and sync when connected.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 36, gap: 20, maxWidth: 560, width: '100%', alignSelf: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: colors.surface, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 20 },
  brand: { color: colors.text, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16 },
  brandSub: { color: colors.secondary, fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, marginTop: 1 },
  statusPill: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  statusDot: { width: 7, height: 7, borderRadius: 99 },
  statusText: { color: colors.secondary, fontFamily: 'HankenGrotesk_500Medium', fontSize: 12 },
  hero: { gap: 7, marginTop: 14 },
  eyebrow: { color: colors.blue, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, letterSpacing: 1.2 },
  title: { color: colors.text, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 30, letterSpacing: -0.5 },
  subtitle: { color: colors.secondary, fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, lineHeight: 22, maxWidth: 490 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 20, gap: 10, shadowColor: '#0D0778', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  cardIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.iconBlue, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  cardIconText: { color: colors.deepBlue, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 22 },
  cardEyebrow: { color: colors.blue, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, letterSpacing: 0.9, marginTop: 2 },
  cardTitle: { color: colors.text, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 21 },
  cardCopy: { color: colors.secondary, fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, lineHeight: 21 },
  primaryButton: { minHeight: 46, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  pressed: { backgroundColor: colors.deepBlue, transform: [{ scale: 0.99 }] },
  disabledButton: { backgroundColor: '#D9D8EF' },
  primaryButtonText: { color: colors.surface, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15 },
  hint: { color: colors.secondary, fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { color: colors.text, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 18 },
  sectionMeta: { color: colors.secondary, fontFamily: 'HankenGrotesk_400Regular', fontSize: 12 },
  stepsCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 16 },
  step: { flexDirection: 'row', gap: 12 },
  stepNumber: { width: 27, height: 27, borderRadius: 99, backgroundColor: colors.softBlue, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: colors.blue, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13 },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { color: colors.text, fontFamily: 'HankenGrotesk_500Medium', fontSize: 14 },
  stepCopy: { color: colors.secondary, fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, lineHeight: 19 },
  privacyNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 2 },
  privacyIcon: { color: colors.blue, fontSize: 14, lineHeight: 19 },
  privacyText: { flex: 1, color: colors.secondary, fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, lineHeight: 18 },
});
