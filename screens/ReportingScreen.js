import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';

export default function ReportingScreen({ navigation, commentHistory, commentCount, tier, tierLimit, engagedAccounts = [] }) {
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
  const hasData = commentHistory.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stats</Text>
        <View style={{ width: 50 }} />
      </View>

      {!hasData ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No comments yet</Text>
          <Text style={styles.emptySubtitle}>
            Generate and select comments to see your stats build up here
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.emptyButtonText}>Start Commenting</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{commentCount}</Text>
              <Text style={styles.statLabel}>This Month</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{todayCount}</Text>
              <Text style={styles.statLabel}>Today's Comments</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{thisWeekCount}</Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{uniquePosts}</Text>
              <Text style={styles.statLabel}>Posts Commented On</Text>
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
                {commentCount} of {tierLimit} comments used ({tier} plan)
              </Text>
            </View>
          </View>

          <View style={styles.insightSection}>
            <Text style={styles.sectionTitle}>Your Voice DNA</Text>
            {topWords.length > 0 ? (
              <>
                <Text style={styles.insightSubtitle}>Words that show up most in your picks</Text>
                <View style={styles.wordCloud}>
                  {topWords.map((word) => (
                    <View key={word} style={styles.wordChip}>
                      <Text style={styles.wordText}>{word}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.emptyHint}>Generate 5+ comments to see your voice patterns here</Text>
            )}
          </View>

          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Accounts You Engage With</Text>
            {engagedAccounts.length > 0 ? (
              engagedAccounts.slice(0, 10).map((acct) => (
                <View key={acct.username} style={styles.accountRow}>
                  <Text style={styles.accountUsername}>@{acct.username}</Text>
                  <Text style={styles.accountCount}>{acct.count} comment{acct.count !== 1 ? 's' : ''}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyHint}>Start commenting on posts to track your top accounts here</Text>
            )}
          </View>

          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Recent Comments</Text>
            {commentHistory.slice(0, 10).map((entry) => (
              <View key={entry.id} style={styles.historyCard}>
                <Text style={styles.historyComment}>{entry.selected}</Text>
                <Text style={styles.historyMeta}>
                {new Date(entry.timestamp).toLocaleDateString()} at{' '}
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {entry.url ? (
                <TouchableOpacity onPress={() =>
                  Linking.openURL(entry.url).catch(() =>
                    Alert.alert("Couldn't open post", 'The post link may no longer be available.')
                  )
                }>
                  <Text style={styles.historyLink}>View post on Instagram</Text>
                </TouchableOpacity>
              ) : null}
</View>
            ))}
          </View>
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
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: '#4f8ef7',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    textAlign: 'center',
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
  historyLink: {
    color: '#4f8ef7',
    fontSize: 13,
    marginTop: 6,
  },
  emptyHint: {
    color: '#555',
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
    lineHeight: 20,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  accountUsername: {
    color: '#4f8ef7',
    fontSize: 14,
  },
  accountCount: {
    color: '#666',
    fontSize: 13,
  },
});