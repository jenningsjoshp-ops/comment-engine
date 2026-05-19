import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

export default function QueueScreen({ navigation, queue, onDone }) {
  const [copiedIds, setCopiedIds] = useState(new Set());

  const handleCopy = async (item) => {
    await Clipboard.setStringAsync(item.comment);
    setCopiedIds((prev) => new Set([...prev, item.id]));
  };

  const handleOpen = (item) => {
    Linking.openURL(item.postUrl || 'instagram://');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comment Queue</Text>
        <Text style={styles.headerCount}>
          {queue.length} {queue.length === 1 ? 'item' : 'items'}
        </Text>
      </View>

      {queue.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Queue is empty</Text>
          <Text style={styles.emptySubtitle}>
            Pick comments in Discover and they'll appear here so you can post them whenever you're ready.
          </Text>
          <TouchableOpacity style={styles.discoverBtn} onPress={() => navigation.navigate('Discover')}>
            <Text style={styles.discoverBtnText}>Go to Discover</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.hint}>
            Your comment queue. Tap Copy to grab a comment, then Open Post to go to Instagram. Mark Done when you've posted it.
          </Text>
          {queue.map((item) => {
            const copied = copiedIds.has(item.id);
            return (
              <View key={item.id} style={[styles.card, item.done && styles.cardDone]}>
                <View style={styles.cardTop}>
                  <Text style={styles.username}>@{item.username}</Text>
                  {copied && <Text style={styles.copiedBadge}>✓ Copied</Text>}
                </View>
                <Text style={styles.caption} numberOfLines={1}>{item.caption}</Text>
                <Text style={styles.comment} numberOfLines={2}>{item.comment}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.copyBtn, copied && styles.copyBtnDone]}
                    onPress={() => handleCopy(item)}
                  >
                    <Text style={[styles.copyBtnText, copied && styles.copyBtnTextDone]}>
                      {copied ? '✓ Copied' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.openBtn]} onPress={() => handleOpen(item)}>
                    <Text style={styles.openBtnText}>Open @{item.username}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.doneBtn]} onPress={() => onDone(item.id)}>
                    <Text style={styles.doneBtnText}>Done ✓</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wrongPostNote}>
                  If Instagram shows the wrong post, close Instagram and tap Open @{item.username} again.
                </Text>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  backButton: { padding: 8 },
  backText: { color: '#4f8ef7', fontSize: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerCount: { color: '#666', fontSize: 13, minWidth: 40, textAlign: 'right' },
  hint: { color: '#555', fontSize: 13, marginBottom: 20, lineHeight: 18 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 12 },
  emptySubtitle: {
    fontSize: 15, color: '#666', textAlign: 'center',
    lineHeight: 22, marginBottom: 32, paddingHorizontal: 16,
  },
  discoverBtn: {
    backgroundColor: '#4f8ef7', paddingVertical: 14,
    paddingHorizontal: 32, borderRadius: 12,
  },
  discoverBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 14,
    padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#333',
  },
  cardDone: { opacity: 0.5 },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  username: { color: '#4f8ef7', fontSize: 14, fontWeight: '600' },
  copiedBadge: { color: '#4caf50', fontSize: 12, fontWeight: '600' },
  caption: { color: '#555', fontSize: 12, marginBottom: 8 },
  comment: {
    color: '#fff', fontSize: 15, lineHeight: 22,
    marginBottom: 14, fontStyle: 'italic',
  },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', borderWidth: 1,
  },
  copyBtn: { backgroundColor: '#1a2a4a', borderColor: '#4f8ef7' },
  copyBtnDone: { backgroundColor: '#1a3a1a', borderColor: '#4caf50' },
  copyBtnText: { color: '#4f8ef7', fontSize: 13, fontWeight: '600' },
  copyBtnTextDone: { color: '#4caf50' },
  openBtn: { backgroundColor: '#2a2a2a', borderColor: '#555' },
  openBtnText: { color: '#ccc', fontSize: 12, fontWeight: '600' },
  wrongPostNote: { color: '#444', fontSize: 11, marginTop: 10, lineHeight: 16 },
  doneBtn: { backgroundColor: '#1a1a1a', borderColor: '#333' },
  doneBtnText: { color: '#555', fontSize: 13, fontWeight: '600' },
});
