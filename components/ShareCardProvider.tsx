/**
 * Post-workout "share your workout" flow. Call useShareCard().promptShare(data) to show
 * a modal previewing a ShareCard; the user can Share (captures the card to a PNG and opens
 * the native share sheet), dismiss ("Not now"), or turn the prompt off ("Don't ask again").
 * Field visibility follows the user's share-card settings. Rendered at the root so it
 * survives the navigation that happens right after Finish & Save.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { PillButton } from '@/components/PillButton';
import { ShareCard, CARD_W, type ShareCardData } from '@/components/ShareCard';
import { useSettings } from '@/settings/SettingsProvider';
import { haptics } from '@/lib/haptics';
import { colors, spacing, fonts } from '@/theme/theme';

const ShareCardContext = createContext<{ promptShare: (data: ShareCardData) => void }>({ promptShare: () => {} });

export function ShareCardProvider({ children }: { children: React.ReactNode }) {
  const { shareCardFields, setShareOnFinish } = useSettings();
  const [data, setData] = useState<ShareCardData | null>(null);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);

  const promptShare = useCallback((d: ShareCardData) => { setData(d); }, []);
  const close = () => { setData(null); setBusy(false); };

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'This device can’t open the share sheet.');
        setBusy(false);
        return;
      }
      haptics.selection();
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your workout' });
      close();
    } catch (e) {
      setBusy(false);
      Alert.alert('Couldn’t create the card', 'Something went wrong generating the image. Please try again.');
    }
  };

  const onNeverAsk = () => { setShareOnFinish(false); close(); };

  return (
    <ShareCardContext.Provider value={{ promptShare }}>
      {children}
      <Modal visible={data != null} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.heading}>SHARE YOUR WORKOUT</Text>
            <Text style={styles.sub}>Post it, hype your buddies, keep the streak going.</Text>

            {/* The captured node — rendered visibly as the preview. */}
            <View ref={cardRef} collapsable={false} style={styles.cardWrap}>
              {data && <ShareCard data={data} fields={shareCardFields} />}
            </View>

            <PillButton label={busy ? 'Preparing…' : 'Share'} variant="primary" block onPress={onShare} style={styles.shareBtn} />
            <Pressable onPress={close} style={styles.link}><Text style={styles.linkText}>Not now</Text></Pressable>
            <Pressable onPress={onNeverAsk} style={styles.link}><Text style={styles.linkMuted}>Don&rsquo;t ask after workouts</Text></Pressable>
          </ScrollView>
        </View>
      </Modal>
    </ShareCardContext.Provider>
  );
}

export const useShareCard = () => useContext(ShareCardContext);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center' },
  scroll: { alignItems: 'center', padding: spacing.xl },
  heading: { fontFamily: fonts.display, fontSize: 24, color: colors.text, letterSpacing: 0.5 },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2, marginTop: 2, marginBottom: spacing.lg, textAlign: 'center' },
  cardWrap: { width: CARD_W, borderRadius: 16, overflow: 'hidden', marginBottom: spacing.lg },
  shareBtn: { width: CARD_W },
  link: { paddingVertical: spacing.md, alignItems: 'center' },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text2 },
  linkMuted: { fontFamily: fonts.regular, fontSize: 13, color: colors.text3 },
});
