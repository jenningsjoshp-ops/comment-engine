import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ANTHROPIC_API_KEY, APIFY_API_TOKEN } from '../config';
import { saveDiscoveryCache, loadDiscoveryCache } from '../lib/supabase';

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

const DISCOVER_MESSAGES = [
  "hunting for posts in your niche...",
  "finding people who need your comment...",
  "scouting the hashtags you care about",
  "looking for posts with room for your voice",
  "filtering out the ones not worth your time",
  "finding the sweet spot... popular but not too popular",
];

const GENERATE_MESSAGES = [
  "teaching AI to be funny... harder than it sounds",
  "crafting something that doesn't sound like a robot wrote it",
  "making sure this doesn't sound like 'great post bro'",
  "generating something better than a fire emoji",
  "calibrating sarcasm levels...",
  "making sure nobody can tell AI wrote this",
];

export default function DiscoverScreen({
  navigation,
  userProfile,
  onCommentUsed,
  selectedComments,
  commentCount,
  tierLimit,
  tier,
  commentedPostUrls,
  onDiscoveryUsed,
  discoveryCache,
  setDiscoveryCache,
  engagedAccounts,
  discoveryRemaining,
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [generatingComments, setGeneratingComments] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [completedPosts, setCompletedPosts] = useState([]);
  const [skippedPosts, setSkippedPosts] = useState([]);

  const hashtags = userProfile?.hashtags || [];
  const remaining = tierLimit - commentCount;

  useEffect(() => {
    if (hashtags.length > 0) {
      discoverPosts();
    }
  }, []);

  const getCacheKey = () => {
    const today = new Date().toDateString();
    const tags = hashtags.slice(0, 5).sort().join(',');
    return `${today}:${tags}`;
  };

  const discoverPosts = async () => {
    const cacheKey = getCacheKey();

    // 1. In-memory cache (free, no session consumed)
    if (discoveryCache[cacheKey]) {
      const cached = discoveryCache[cacheKey].filter(
        (p) => !commentedPostUrls.includes(p.url) && !completedPosts.includes(p.url) && !skippedPosts.includes(p.url)
      );
      if (cached.length > 0) {
        setPosts(cached);
        return;
      }
    }

    setLoading(true);
    try {
      // 2. Supabase persistent cache (free, survives app restarts)
      const supabaseCached = await loadDiscoveryCache(cacheKey);
      if (supabaseCached) {
        const filtered = supabaseCached.filter(
          (p) => !commentedPostUrls.includes(p.url) && !completedPosts.includes(p.url) && !skippedPosts.includes(p.url)
        );
        if (filtered.length > 0) {
          setDiscoveryCache((prev) => ({ ...prev, [cacheKey]: supabaseCached }));
          setPosts(filtered);
          return;
        }
      }

      // 3. Check daily limit before hitting Apify
      if (discoveryRemaining <= 0) {
        Alert.alert('No sessions left today', 'You\'ve used your discovery sessions for today. Come back tomorrow!');
        return;
      }

      // 4. Fetch fresh from Apify
      const tagsToSearch = hashtags.slice(0, 5);
      const allPosts = [];

      for (const tag of tagsToSearch) {
        try {
          const response = await fetch(
            `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                hashtags: [tag],
                resultsLimit: 20,
              }),
            }
          );
          const data = await response.json();
          if (data && data.length > 0) {
            allPosts.push(...data);
          }
        } catch (e) {
          console.error('Failed to fetch hashtag:', tag, e);
        }
      }

      const filtered = allPosts
        .filter((p) => {
          const likes = p.likesCount || 0;
          const commentsCt = p.commentsCount || 0;
          const followers = p.ownerFollowersCount || 0;
          const url = p.url || '';
          const isOwn = p.ownerUsername === userProfile?.igHandle;
          return (
            likes >= 50 &&
            likes <= 10000 &&
            commentsCt < 50 &&
            (followers === 0 || followers <= 100000) &&
            url &&
            !isOwn &&
            !commentedPostUrls.includes(url)
          );
        })
        .sort((a, b) => {
          const aEngaged = engagedAccounts.find((e) => e.username === a.ownerUsername);
          const bEngaged = engagedAccounts.find((e) => e.username === b.ownerUsername);
          if (aEngaged && !bEngaged) return -1;
          if (!aEngaged && bEngaged) return 1;
          const aRatio = (a.likesCount || 0) / Math.max(a.commentsCount || 1, 1);
          const bRatio = (b.likesCount || 0) / Math.max(b.commentsCount || 1, 1);
          return bRatio - aRatio;
        })
        .slice(0, 10)
        .map((p) => ({
          url: p.url,
          caption: p.caption || p.text || '',
          likes: p.likesCount || 0,
          comments: p.commentsCount || 0,
          username: p.ownerUsername || '',
          fullName: p.ownerFullName || '',
          timestamp: p.timestamp || '',
          type: p.type || 'Post',
        }));

      setDiscoveryCache((prev) => ({ ...prev, [cacheKey]: filtered }));
      await saveDiscoveryCache(cacheKey, filtered);
      setPosts(filtered);
      onDiscoveryUsed();
    } catch (error) {
      console.error('Discovery failed:', error);
      Alert.alert('Discovery failed', 'Something went wrong finding posts. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateForPost = async (post) => {
    if (remaining <= 0) {
      Alert.alert(
        'Comment limit reached',
        `You've used all ${tierLimit} comments this month. Upgrade to get more!`,
        [
          { text: 'Upgrade', onPress: () => navigation.navigate('Settings') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }

    setSelectedPost(post);
    setGeneratingComments(true);
    setComments([]);

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
- NEVER use dashes or em dashes or hyphens between words
- Sounds like a text not a caption
- Never promotional
- Make people curious about the commenter

Generate exactly 3 different comments for the given post. Each should have a different angle. Return ONLY a JSON array of 3 strings, no other text.`,
          messages: [
            {
              role: 'user',
              content: `Generate 3 comments for this Instagram post by @${post.username}:\n\nCaption: ${post.caption}`,
            },
          ],
        }),
      });

      const data = await response.json();

      if (!data.content || !data.content[0]) {
        Alert.alert('AI hiccup', 'The comment engine had a moment. Try again.');
        setGeneratingComments(false);
        return;
      }

      const text = data.content[0].text;
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setComments(parsed);
    } catch (error) {
      Alert.alert('Couldn\'t generate comments', 'Something went wrong. Try again.');
      console.error(error);
    } finally {
      setGeneratingComments(false);
    }
  };

  const regenerateComments = () => {
    if (selectedPost) {
      generateForPost(selectedPost);
    }
  };

  const skipPost = () => {
    if (selectedPost) {
      setSkippedPosts((prev) => [...prev, selectedPost.url]);
    }
    setSelectedPost(null);
    setComments([]);
  };

const selectComment = async (comment, index) => {
    await Clipboard.setStringAsync(comment);
    setCopiedIndex(index);
    onCommentUsed(comment, comments, selectedPost.caption, selectedPost.url, selectedPost.username);
    setCompletedPosts((prev) => [...prev, selectedPost.url]);
    const url = selectedPost.url;

    setTimeout(() => {
      setCopiedIndex(null);
      setSelectedPost(null);
      setComments([]);
      Linking.openURL(url || 'instagram://');
    }, 1000);
  };

  const availablePosts = posts.filter(
    (p) => !completedPosts.includes(p.url) && !skippedPosts.includes(p.url)
  );

  if (selectedPost && (comments.length > 0 || generatingComments)) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setSelectedPost(null); setComments([]); }} style={styles.backButton}>
            <Text style={styles.backText}>Back to posts</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.postPreview}>
          <Text style={styles.postUsername}>@{selectedPost.username}</Text>
          <Text style={styles.postCaption} numberOfLines={4}>{selectedPost.caption}</Text>
        </View>

        {generatingComments ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#4f8ef7" size="large" />
            <LoadingMessages messages={GENERATE_MESSAGES} />
          </View>
        ) : (
          <>
            <Text style={styles.resultsTitle}>Pick your comment</Text>
            <Text style={styles.learningHint}>We learn from your picks to make better comments over time</Text>

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

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={regenerateComments}>
                <Text style={styles.secondaryButtonText}>Regenerate</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipButton} onPress={skipPost}>
                <Text style={styles.skipButtonText}>Skip Post</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discover</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#4f8ef7" size="large" />
          <LoadingMessages messages={DISCOVER_MESSAGES} />
        </View>
      ) : availablePosts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {posts.length > 0 ? 'You\'ve gone through them all!' : 'No posts found'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {posts.length > 0
              ? 'Nice work! Come back later for fresh posts.'
              : hashtags.length === 0
              ? 'Add hashtags in Settings to discover posts.'
              : 'Try adjusting your hashtags in Settings for better results.'}
          </Text>
          {posts.length > 0 && (
            <TouchableOpacity style={styles.refreshBtn} onPress={discoverPosts}>
              <Text style={styles.refreshBtnText}>Find More Posts</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <Text style={styles.discoverSubtitle}>
            {availablePosts.length} posts to comment on
          </Text>

          {availablePosts.map((post, index) => (
            <TouchableOpacity
              key={post.url}
              style={styles.postCard}
              onPress={() => generateForPost(post)}
              disabled={generatingComments}
            >
              <View style={styles.postCardHeader}>
                <Text style={styles.postCardUsername}>@{post.username}</Text>
                <View style={styles.postCardStats}>
                  <Text style={styles.statText}>{post.likes} likes</Text>
                  <Text style={styles.statDot}>·</Text>
                  <Text style={styles.statText}>{post.comments} comments</Text>
                </View>
              </View>
              <Text style={styles.postCardCaption} numberOfLines={3}>
                {post.caption}
              </Text>
              <Text style={styles.postCardAction}>Tap to generate comments</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={discoverPosts}
          >
            <Text style={styles.refreshBtnText}>Refresh Posts</Text>
          </TouchableOpacity>
        </>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#4f8ef7',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  discoverSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  postCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  postCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  postCardUsername: {
    color: '#4f8ef7',
    fontSize: 15,
    fontWeight: '600',
  },
  postCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: '#666',
    fontSize: 12,
  },
  statDot: {
    color: '#666',
    fontSize: 12,
    marginHorizontal: 6,
  },
  postCardCaption: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  postCardAction: {
    color: '#4f8ef7',
    fontSize: 13,
    textAlign: 'right',
  },
  postPreview: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  postUsername: {
    color: '#4f8ef7',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  postCaption: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
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
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4f8ef7',
  },
  secondaryButtonText: {
    color: '#4f8ef7',
    fontSize: 15,
    fontWeight: '600',
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  skipButtonText: {
    color: '#999',
    fontSize: 15,
    fontWeight: '600',
  },
  refreshBtn: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  refreshBtnText: {
    color: '#4f8ef7',
    fontSize: 16,
    fontWeight: '600',
  },
});