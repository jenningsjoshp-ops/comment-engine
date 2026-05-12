import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

export default function ReportingScreen({ navigation, commentHistory, commentCount, tier, tierLimit }) {
  const todayCount = commentHistory.filter((c) => {
    const today = new Date().toDateString();
    return new Date(c.timestamp).toDateString() === today;
  }).length;

  const thisWeekCount = commentHistory.filter((c) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return new Date(c.timestamp) > weekAgo;
  }).length;

  const uniquePosts = new Set(commentHistory.map((c) => c.url)).size;

  const getTopWords = () => {
    const allComments = commentHistory.map((c) => c.selected).join(' ').toLowerCase();
    const words = allComments.split(/\s+/).filter((w) => w.length > 4);
    const freq = {};
    words.forEach((w) => {
      freq[w] = (freq[w] || 0) + 1;
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  };

  const topWords = commentHistory.length > 5 ? getTopWords() : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stats</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{commentCount}</Text>
          <Text style={styles.statLabel}>Total Comments</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{todayCount}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{thisWeekCount}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{uniquePosts}</Text>
          <Text style={styles.statLabel}>Unique Posts</Text>
        </View>
      </View>

      <View style={styles.usageSection}>
        <Text style={styles.sectionTitle}>Monthly Usage</Text>
        <View style={styles.usageBarContainer}>
          <View style={styles.usageTrack}>
            <View
              style={[
                styles.usageFill,
                {
                  width: `${Math.min((commentCount / tierLimit) * 100, 100)}%`,
                  backgroundColor: commentCount / tierLimit > 0.9 ? '#ff4444' : commentCount / tierLimit > 0.7 ? '#ffaa00' : '#4f8ef7',
                },
              ]}
            />
          </View>
          <Text style={styles.usageText}>
            {commentCount} of {tierLimit} ({tier} plan)
          </Text>
        </View>
      </View>

      {topWords.length > 0 && (
        <View style={styles.insightSection}>
          <Text style={styles.sectionTitle}>Your Voice DNA</Text>
          <Text style={styles.insightSubtitle}>Words that show up most in your picks</Text>
          <View style={styles.wordCloud}>
            {topWords.map((word) => (
              <View key={word} style={styles.wordChip}>
                <Text style={styles.wordText}>{word}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {commentHistory.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Recent Comments</Text>
          {commentHistory.slice(0, 10).map((entry) => (
            <View key={entry.id} style={styles.historyCard}>
              <Text style={styles.historyComment}>{entry.selected}</Text>
              <Text style={styles.historyMeta}>
                {new Date(entry.timestamp).toLocaleDateString()} at{' '}
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))}
        </View>
      )}

      {commentHistory.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No comments yet</Text>
          <Text style={styles.emptySubtitle}>
            Generate and select comments to see your stats build up here
          </Text>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4f8ef7',
  },
  statLabel: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  usageSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  usageBarContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  usageTrack: {
    height: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  usageFill: {
    height: '100%',
    borderRadius: 4,
  },
  usageText: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
  },
  insightSection: {
    marginBottom: 24,
  },
  insightSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    marginTop: -4,
  },
  wordCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordChip: {
    backgroundColor: '#1a2a4a',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#4f8ef7',
  },
  wordText: {
    color: '#4f8ef7',
    fontSize: 14,
  },
  historySection: {
    marginBottom: 24,
  },
  historyCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  historyComment: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  historyMeta: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});