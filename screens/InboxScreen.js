import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Animated, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase, logError } from '../lib/supabase';

function LoadingMessages({ messages }) {
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setIndex((prev) => (prev + 1) % messages.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <Animated.Text style={{ color: '#999', marginTop: 16, textAlign: 'center', fontStyle: 'italic', opacity: fadeAnim, fontSize: 15 }}>
      {messages[index]}
    </Animated.Text>
  );
}

const INBOX_MESSAGES = [
  "checking your comment inbox...",
  "seeing who left you love recently...",
  "pulling recent comments from your posts...",
  "finding comments worth replying to...",
];

const REPLY_MESSAGES = [
  "crafting the perfect comeback...",
  "thinking of something actually worth reading...",
  "making sure this doesn't sound corporate...",
  "writing a reply your followers will actually like",
];

function classifyError(error) {
  const msg = error?.message || '';
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'network';
  }
  return 'api';
}

export default function InboxScreen({ navigation, userProfile, tier, selectedComments }) {
  const [inboxItems, setInboxItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [replies, setReplies] = useState([]);
  const [generatingReplies, setGeneratingReplies] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const progressIntervalRef = useRef(null);

  useEffect(() => {
    fetchInbox();
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const startProgress = () => {
    setLoadProgress(0);
    setLoadingPhase('loading');
    let p = 0;
    progressIntervalRef.current = setInterval(() => {
      p += 1;
      if (p >= 80) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setLoadProgress(p);
    }, 112);
  };

  const finishProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setLoadingPhase('filtering');
    setLoadProgress(100);
  };

  const resetProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setLoadProgress(0);
    setLoadingPhase('');
  };

  const fetchInbox = async () => {
    const handle = userProfile?.igHandle;
    if (!handle) return;

    startProgress();
    setLoading(true);
    try {
      const { data, error: scrapeError } = await supabase.functions.invoke('scrape-instagram', {
        body: { action: 'profile', params: { handle, resultsLimit: 10 } },
      });
      if (scrapeError) throw scrapeError;

      finishProgress();

      if (data && data.length === 0) {
        Alert.alert(
          'No posts found',
          'This account may be private. CommentEngine only works with public profiles.'
        );
        return;
      }

      if (data && data.length > 0) {
        const allComments = [];
        data.forEach((post) => {
          const comments = post.latestComments || [];
          // Skip posts where the user already replied
          const alreadyReplied = comments.some((c) => c.ownerUsername === handle);
          if (alreadyReplied) return;

          comments.forEach((c) => {
            if (c.ownerUsername !== handle && c.text) {
              allComments.push({
                id: c.id || `${post.url}-${c.ownerUsername}-${allComments.length}`,
                commenter: c.ownerUsername || 'unknown',
                text: c.text,
                postUrl: post.url || '',
                postCaption: (post.caption || '').slice(0, 120),
              });
            }
          });
        });
        setInboxItems(allComments.slice(0, 25));
      }
    } catch (error) {
      const type = classifyError(error);
      Alert.alert(
        type === 'network' ? 'Check your internet connection' : 'Instagram is being difficult right now',
        type === 'network' ? 'Check your internet connection and try again.' : 'Try again in a minute.'
      );
      await logError({ screen: 'InboxScreen', action: 'fetchInbox', message: error.message, userId: userProfile?.id });
    } finally {
      setLoading(false);
      resetProgress();
    }
  };

  const generateReplies = async (item) => {
    setSelectedItem(item);
    setGeneratingReplies(true);
    setReplies([]);

    try {
      const recentSelections = (selectedComments || []).slice(0, 10);
      const learningContext = recentSelections.length >= 3
        ? `\nPreviously selected comments (match this style):\n${recentSelections.map((c) => '- ' + c).join('\n')}`
        : '';

      const { data, error: invokeError } = await supabase.functions.invoke('generate-comments', {
        body: {
          system: `You are a reply ghostwriter for a ${userProfile?.accountType || 'business'} account on Instagram.

${userProfile?.igPosts?.length ? 'Our recent posts (for voice matching):\n' + userProfile.igPosts.slice(0, 3).join('\n---\n') : ''}
${Object.values(userProfile?.referenceUrls || {}).filter(Boolean).length ? 'About us:\n' + Object.values(userProfile.referenceUrls).filter(Boolean).slice(0, 2).join('\n---\n') : ''}

Voice settings:
${userProfile?.sliders?.map((s) => {
  const val = userProfile?.sliderValues?.[s.id] || 3;
  return s.left + ' vs ' + s.right + ': ' + val + '/5 toward ' + (val > 3 ? s.right : val < 3 ? s.left : 'neutral');
}).join('\n') || 'Friendly, warm, and genuine'}
${learningContext}

Rules:
- 1-2 sentences max
- NEVER use dashes or em dashes or hyphens between words
- Sounds like a genuine human reply, not a brand template
- Never promotional or salesy
- Warm and engaging
- CRITICAL: NEVER invent or fabricate personal details about the account owner. Do not make up ages, career history, life events, or biographical facts. Only reference details that are explicitly present in the user's posts or profile. If you don't have specific details, keep the reply general and observational. Making up facts about the user is the worst thing you can do.
- Each reply MUST use a completely different sentence structure and opening. NEVER start multiple replies with similar phrases. Vary your openings: use questions, warm acknowledgments, humor, short punchy reactions. If one reply is warm and affirming, the next should be a question, and the third should be punchy or playful.
- NEVER start a reply with: "The difference between", "Most people", "The thing about", "What people don't realize", "The best part about". These are overused AI patterns. Sound human, not like a brand response template.
- Rotate between these angles: (a) warm and direct acknowledgment (b) a genuine question that invites more conversation (c) a short punchy reaction that feels like a real person texting back

Generate exactly 3 different reply options to the comment below. Each should have a different tone or angle. Return ONLY a JSON array of 3 strings, no other text.`,
          message: `Generate 3 replies to this comment on our post:\n\nComment by @${item.commenter}: "${item.text}"\n\nPost caption: "${item.postCaption}"`,
        },
      });
      if (invokeError) throw invokeError;

      if (!data.content?.[0]?.text) {
        Alert.alert('Our comment engine is taking a break.', 'Try again shortly.');
        setGeneratingReplies(false);
        return;
      }

      const cleaned = data.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      setReplies(JSON.parse(cleaned));
    } catch (error) {
      const type = classifyError(error);
      Alert.alert(
        type === 'network' ? 'Check your internet connection' : 'Our comment engine is taking a break.',
        type === 'network' ? 'Check your internet connection and try again.' : 'Try again shortly.'
      );
      await logError({ screen: 'InboxScreen', action: 'generateReplies', message: error.message, userId: userProfile?.id });
    } finally {
      setGeneratingReplies(false);
    }
  };

  const selectReply = async (reply, index) => {
    await Clipboard.setStringAsync(reply);
    setCopiedIndex(index);
    const url = selectedItem?.postUrl;

    setTimeout(() => {
      setCopiedIndex(null);
      setSelectedItem(null);
      setReplies([]);
      Linking.openURL(url || 'instagram://');
    }, 1000);
  };

  // No handle — explain and link to Settings
  if (!userProfile?.igHandle) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Inbox</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Instagram not connected</Text>
          <Text style={styles.emptySubtitle}>
            Add your Instagram handle in Settings to see comments on your posts.
          </Text>
          <TouchableOpacity style={styles.regenButton} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.regenButtonText}>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Reply view
  if (selectedItem && (replies.length > 0 || generatingReplies)) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => { setSelectedItem(null); setReplies([]); }} style={styles.backButton}>
          <Text style={styles.backText}>← Back to inbox</Text>
        </TouchableOpacity>

        <View style={styles.commentPreview}>
          <Text style={styles.commenterName}>@{selectedItem.commenter}</Text>
          <Text style={styles.previewComment}>"{selectedItem.text}"</Text>
        </View>

        {generatingReplies ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#4f8ef7" size="large" />
            <LoadingMessages messages={REPLY_MESSAGES} />
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Pick your reply</Text>
            {replies.map((reply, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.replyCard, copiedIndex === index && styles.replyCardSelected]}
                onPress={() => selectReply(reply, index)}
              >
                <Text style={styles.replyText}>{reply}</Text>
                <Text style={styles.copyHint}>
                  {copiedIndex === index ? 'Copied! Opening Instagram...' : 'Tap to copy & reply'}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.regenButton} onPress={() => generateReplies(selectedItem)}>
              <Text style={styles.regenButtonText}>Regenerate</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  }

  // Inbox list
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Inbox</Text>
        <TouchableOpacity onPress={fetchInbox} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.inboxSubtitle}>Comments on your posts that need a reply.</Text>

      {loading ? (
        <View style={styles.progressContainer}>
          <Text style={styles.phaseLabel}>
            {loadingPhase === 'filtering' ? 'Filtering your inbox...' : 'Checking your comment inbox...'}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${loadProgress}%` }]} />
          </View>
          <LoadingMessages messages={INBOX_MESSAGES} />
        </View>
      ) : inboxItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No comments yet</Text>
          <Text style={styles.emptySubtitle}>
            When people comment on your posts, they'll appear here ready for replies.
          </Text>
          <TouchableOpacity style={styles.regenButton} onPress={fetchInbox}>
            <Text style={styles.regenButtonText}>Check Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.inboxCount}>{inboxItems.length} comment{inboxItems.length !== 1 ? 's' : ''} to reply to</Text>
          {inboxItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.inboxCard}
              onPress={() => generateReplies(item)}
              disabled={generatingReplies}
            >
              <Text style={styles.commenterName}>@{item.commenter}</Text>
              <Text style={styles.commentCardText} numberOfLines={3}>{item.text}</Text>
              <Text style={styles.tapHint}>Tap to generate replies →</Text>
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backButton: { padding: 8 },
  backText: { color: '#4f8ef7', fontSize: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  refreshBtn: { padding: 8 },
  refreshBtnText: { color: '#4f8ef7', fontSize: 15 },
  inboxSubtitle: { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 18 },
  inboxCount: { fontSize: 14, color: '#999', marginBottom: 16, textAlign: 'center' },
  inboxCard: {
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#333',
  },
  commenterName: { color: '#4f8ef7', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  commentCardText: { color: '#ccc', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  tapHint: { color: '#555', fontSize: 12, textAlign: 'right' },
  loadingContainer: { alignItems: 'center', marginTop: 60 },
  progressContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 8 },
  phaseLabel: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  progressTrack: { width: '100%', height: 6, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4f8ef7', borderRadius: 3 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 12 },
  emptySubtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  commentPreview: {
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: '#333',
  },
  previewComment: { color: '#ccc', fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 16 },
  replyCard: {
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#333',
  },
  replyCardSelected: { borderColor: '#4f8ef7', backgroundColor: '#1a2a4a' },
  replyText: { color: '#fff', fontSize: 16, lineHeight: 22 },
  copyHint: { color: '#4f8ef7', fontSize: 12, marginTop: 8, textAlign: 'right' },
  regenButton: {
    backgroundColor: '#2a2a2a', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#4f8ef7',
  },
  regenButtonText: { color: '#4f8ef7', fontSize: 15, fontWeight: '600' },
  gateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  gateIcon: { fontSize: 56, marginBottom: 20 },
  gateTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  gateSubtitle: { fontSize: 15, color: '#999', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  upgradeButton: {
    backgroundColor: '#4f8ef7', paddingVertical: 16, paddingHorizontal: 32,
    borderRadius: 12, alignItems: 'center',
  },
  upgradeButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
