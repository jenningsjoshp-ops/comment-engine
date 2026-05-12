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

export default function MainScreen({ userProfile }) {
  const [postUrl, setPostUrl] = useState('');
  const [postCaption, setPostCaption] = useState('');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

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
    let caption = postCaption;

    if (postUrl && !postCaption.trim()) {
      setLoading(true);
      setLoadingPhase('fetch');
      caption = await fetchCaption(postUrl);
      if (caption) {
        setPostCaption(caption);
      } else {
        Alert.alert('Could not fetch caption', 'Paste the caption manually or describe the post.');
        setLoading(false);
        return;
      }
    }

    if (!caption.trim()) {
      Alert.alert('Need context', 'Paste a URL or describe what the post is about.');
      return;
    }

    setLoading(true);
    setLoadingPhase('generate');
    setComments([]);

    try {
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
              content: `Generate 3 comments for this Instagram post:\n\nCaption: ${caption}${postUrl ? `\nURL: ${postUrl}` : ''}`,
            },
          ],
        }),
      });

      const data = await response.json();
      const text = data.content[0].text;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setComments(parsed);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate comments. Check your API key.');
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  };

  const copyComment = async (comment, index) => {
    await Clipboard.setStringAsync(comment);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>CommentEngine</Text>

      <Text style={styles.label}>Post URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://instagram.com/p/..."
        placeholderTextColor="#666"
        value={postUrl}
        onChangeText={setPostUrl}
      />

      <Text style={styles.label}>What's the post about? (auto-fills from URL)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Leave blank if you pasted a URL above..."
        placeholderTextColor="#666"
        value={postCaption}
        onChangeText={setPostCaption}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity
        style={[styles.generateButton, loading && styles.buttonDisabled]}
        onPress={generateComments}
        disabled={loading}
      >
        <Text style={styles.generateButtonText}>Generate Comments</Text>
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
          <Text style={styles.resultsTitle}>Your comments</Text>
          {comments.map((comment, index) => (
            <TouchableOpacity
              key={index}
              style={styles.commentCard}
              onPress={() => copyComment(comment, index)}
            >
              <Text style={styles.commentText}>{comment}</Text>
              <Text style={styles.copyHint}>
                {copiedIndex === index ? 'Copied!' : 'Tap to copy'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 32,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
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
});