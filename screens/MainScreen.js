import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ANTHROPIC_API_KEY, APIFY_API_TOKEN } from '../config';

function LoadingMessages({ messages }) {
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIndex((prev) => (prev + 1) % messages.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <Animated.Text
      style={{
        color: '#999',
        marginTop: 16,
        textAlign: 'center',
        fontStyle: 'italic',
        opacity: fadeAnim,
        fontSize: 15,
      }}
    >
      {messages[index]}
    </Animated.Text>
  );
}

const FETCH_MESSAGES = [
  "stalking their page real quick...",
  "reading their caption so you don't have to",
  "doing the creeping you're too busy for",
  "scrolling so you don't have to",
  "pretending to be a normal viewer...",
  "finding out what they actually posted",
];

const GENERATE_MESSAGES = [
  "teaching AI to be funny... harder than it sounds",
  "crafting something that doesn't sound like a robot wrote it",
  "making sure this doesn't sound like 'great post bro'",
  "generating something better than a fire emoji",
  "your thumbs called, they want a break",
  "channeling your inner commenting genius",
  "writing comments your followers wish they thought of",
  "calibrating sarcasm levels...",
  "filtering out anything that sounds like a LinkedIn post",
  "making sure nobody can tell AI wrote this",
];

export default function MainScreen({
  userProfile,
  navigation,
  onCommentUsed,
  selectedComments,
  commentCount,
  tierLimit,
  tier,
}) {
  const [postUrl, setPostUrl] = useState('');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [currentCaption, setCurrentCaption] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const remaining = tierLimit - commentCount;

  const fetchCaption = async (url) => {
    try {
      const response = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            directUrls: [url],
            resultsType: 'posts',
            resultsLimit: 1,
          }),
        }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return data[0].caption || data[0].text || '';
      }
      return '';
    } catch (error) {
      console.error('Failed to fetch caption:', error);
      return '';
    }
  };

  const generateComments = async () => {
    if (!postUrl.trim()) {
      Alert.alert('Need a URL', 'Paste an Instagram post URL to generate comments.');
      return;
    }

    if (remaining <= 0) {
      Alert.alert(
        'Comment limit reached',
        `You've used all ${tierLimit} comments this month on the ${tier} plan. Upgrade to get more!`,
        [
          { text: 'Upgrade', onPress: () => navigation.navigate('Settings') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }

    setLoading(true);
    setLoadingPhase('fetch');
    setComments([]);

    let caption = '';
    try {
      caption = await fetchCaption(postUrl);
      if (!caption) {
        Alert.alert(
          'Hmm, couldn\'t grab that caption',
          'Instagram might be being difficult. Try a different post or try again in a minute.'
        );
        setLoading(false);
        return;
      }
      setCurrentCaption(caption);
    } catch (error) {
      Alert.alert(
        'Something went wrong',
        'We had trouble reaching Instagram. Check your connection and try again.'
      );
      setLoading(false);
      return;
    }

    setLoadingPhase('generate');

    try {
      const recentSelections = selectedComments.slice(0, 10);
      const learningContext = recentSelections.length >= 3
        ? `\nThe user has previously selected these comments (learn from their preferences):\n${recentSelections.map((c) => '- ' + c).join('\n')}`
        : '';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          system: `You are a comment ghostwriter. Account type: ${userProfile?.accountType || 'creator'}.

${userProfile?.igPosts?.length ? 'Recent posts by this account (use to match voice):\n' + userProfile.igPosts.slice(0, 5).join('\n---\n') : ''}

${Object.values(userProfile?.referenceUrls || {}).filter(Boolean).length ? 'Reference content:\n' + Object.values(userProfile.referenceUrls).filter(Boolean).join('\n---\n') : ''}

Voice settings:
${userProfile?.sliders?.map((s) => {
  const val = userProfile?.sliderValues?.[s.id] || 3;
  return s.left + ' vs ' + s.right + ': ' + val + '/5 toward ' + (val > 3 ? s.right : val < 3 ? s.left : 'neutral');
}).join('\n') || 'Default balanced voice'}
${learningContext}

Rules:
- 1-2 sentences max
- No dashes or em dashes
- Sounds like a text not a caption
- Never promotional
- Make people curious about the commenter

Generate exactly 3 different comments for the given post. Each should have a different angle. Return ONLY a JSON array of 3 strings, no other text.`,
          messages: [
            {
              role: 'user',
              content: `Generate 3 comments for this Instagram post:\n\nCaption: ${caption}`,
            },
          ],
        }),
      });

      const data = await response.json();

      if (!data.content || !data.content[0]) {
        Alert.alert(
          'AI hiccup',
          'The comment engine had a moment. Try again.'
        );
        setLoading(false);
        return;
      }

      const text = data.content[0].text;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setComments(parsed);
    } catch (error) {
      Alert.alert(
        'Couldn\'t generate comments',
        'Something went wrong with the AI. Try again in a moment.'
      );
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  };

  const selectComment = async (comment, index) => {
    await Clipboard.setStringAsync(comment);
    setCopiedIndex(index);
    onCommentUsed(comment, comments, currentCaption, postUrl);

    setTimeout(() => {
      setCopiedIndex(null);
      setPostUrl('');
      Alert.alert(
        'Comment copied!',
        'Open Instagram to paste your comment?',
        [
          {
            text: 'Open Instagram',
            onPress: () => Linking.openURL(postUrl || 'instagram://'),
          },
          { text: 'Stay here', style: 'cancel' },
        ]
      );
    }, 500);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.navigate('Reporting')} style={styles.navButton}>
          <Text style={styles.navText}>Stats</Text>
        </TouchableOpacity>
        <Text style={styles.title}>CommentEngine</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.navButton}>
          <Text style={styles.navText}>Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.usageBar}>
        <View style={styles.usageTrack}>
          <View
            style={[
              styles.usageFill,
              {
                width: `${Math.min((commentCount / tierLimit) * 100, 100)}%`,
                backgroundColor: remaining <= 5 ? '#ff4444' : remaining <= 15 ? '#ffaa00' : '#4f8ef7',
              },
            ]}
          />
        </View>
        <Text style={styles.usageText}>
          {commentCount}/{tierLimit} comments used ({tier})
        </Text>
      </View>

      <View style={styles.urlLabelRow}>
        <Text style={styles.label}>Post URL</Text>
        <TouchableOpacity onPress={() => setShowHelp(true)}>
          <Text style={styles.helpLink}>How do I get this?</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Paste Instagram post URL here..."
        placeholderTextColor="#666"
        value={postUrl}
        onChangeText={setPostUrl}
        autoCapitalize="none"
      />

      <Modal
        visible={showHelp}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHelp(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHelp(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How to copy a post URL</Text>
            <Text style={styles.modalText}>
              1. Open Instagram and find the post{'\n'}
              2. Tap the three dots (···) in the top right{'\n'}
              3. Tap "Copy Link"{'\n'}
              4. Come back here and paste it
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowHelp(false)}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity
        style={[styles.generateButton, (loading || remaining <= 0) && styles.buttonDisabled]}
        onPress={generateComments}
        disabled={loading || remaining <= 0}
      >
        <Text style={styles.generateButtonText}>
          {remaining <= 0 ? 'Upgrade for more comments' : 'Generate Comments'}
        </Text>
      </TouchableOpacity>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#4f8ef7" size="large" />
          <LoadingMessages
            messages={loadingPhase === 'fetch' ? FETCH_MESSAGES : GENERATE_MESSAGES}
          />
        </View>
      )}

      {comments.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.resultsTitle}>Pick your comment</Text>
          <Text style={styles.learningHint}>
            We learn from your picks to make better comments over time
          </Text>
          {comments.map((comment, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.commentCard, copiedIndex === index && styles.commentCardSelected]}
              onPress={() => selectComment(comment, index)}
            >
              <Text style={styles.commentText}>{comment}</Text>
              <Text style={styles.copyHint}>
                {copiedIndex === index ? 'Copied! Opening Instagram...' : 'Tap to copy & post'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={() => navigation.navigate('Feedback')}
        style={styles.feedbackLink}
      >
        <Text style={styles.feedbackText}>Report a bug or send feedback</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  navButton: {
    padding: 8,
  },
  navText: {
    color: '#4f8ef7',
    fontSize: 15,
  },
  usageBar: {
    marginBottom: 24,
  },
  usageTrack: {
    height: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  usageFill: {
    height: '100%',
    borderRadius: 3,
  },
  usageText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
  },
  urlLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#999',
  },
  helpLink: {
    fontSize: 13,
    color: '#4f8ef7',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 28,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#4f8ef7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  generateButton: {
    backgroundColor: '#4f8ef7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#333',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  resultsSection: {
    marginTop: 32,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  learningHint: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  commentCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  commentCardSelected: {
    borderColor: '#4f8ef7',
    backgroundColor: '#1a2a4a',
  },
  commentText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  copyHint: {
    color: '#4f8ef7',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  feedbackLink: {
    alignItems: 'center',
    marginTop: 32,
    padding: 16,
  },
  feedbackText: {
    color: '#666',
    fontSize: 14,
  },
});