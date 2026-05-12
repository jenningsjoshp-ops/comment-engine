import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';

const FEEDBACK_TYPES = [
  { id: 'bug', label: 'Bug Report', desc: 'Something broke or isn\'t working right' },
  { id: 'feature', label: 'Feature Request', desc: 'Something you wish the app could do' },
  { id: 'comment_quality', label: 'Comment Quality', desc: 'The comments aren\'t hitting right' },
  { id: 'other', label: 'Other', desc: 'General feedback or questions' },
];

export default function FeedbackScreen({ navigation, userProfile }) {
  const [feedbackType, setFeedbackType] = useState(null);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!feedbackType || !message.trim()) {
      Alert.alert('Missing info', 'Pick a category and write your message.');
      return;
    }

    const feedback = {
      type: feedbackType,
      message: message.trim(),
      user: userProfile?.name || 'Unknown',
      email: userProfile?.email || 'Unknown',
      igHandle: userProfile?.igHandle || 'Unknown',
      tier: userProfile?.accountType || 'Unknown',
      timestamp: new Date().toISOString(),
    };

    console.log('FEEDBACK SUBMITTED:', JSON.stringify(feedback));

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>✓</Text>
          <Text style={styles.successTitle}>Thanks for the feedback!</Text>
          <Text style={styles.successSubtitle}>
            We read every message. If you reported a bug, we'll look into it right away.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Back to CommentEngine</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback</Text>
        <View style={{ width: 50 }} />
      </View>

      <Text style={styles.sectionTitle}>What's this about?</Text>

      {FEEDBACK_TYPES.map((type) => (
        <TouchableOpacity
          key={type.id}
          style={[styles.typeCard, feedbackType === type.id && styles.typeCardSelected]}
          onPress={() => setFeedbackType(type.id)}
        >
          <Text style={[styles.typeLabel, feedbackType === type.id && styles.typeLabelSelected]}>
            {type.label}
          </Text>
          <Text style={[styles.typeDesc, feedbackType === type.id && styles.typeDescSelected]}>
            {type.desc}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Tell us more</Text>
      <TextInput
        style={styles.textArea}
        placeholder={
          feedbackType === 'bug'
            ? 'What happened? What were you trying to do?'
            : feedbackType === 'comment_quality'
            ? 'What was off about the comments? Too generic? Wrong tone?'
            : feedbackType === 'feature'
            ? 'What would you love to see in CommentEngine?'
            : 'What\'s on your mind?'
        }
        placeholderTextColor="#666"
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.button, (!feedbackType || !message.trim()) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!feedbackType || !message.trim()}
      >
        <Text style={styles.buttonText}>Send Feedback</Text>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    marginTop: 8,
  },
  typeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  typeCardSelected: {
    borderColor: '#4f8ef7',
    backgroundColor: '#1a2a4a',
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  typeLabelSelected: {
    color: '#4f8ef7',
  },
  typeDesc: {
    fontSize: 13,
    color: '#888',
  },
  typeDescSelected: {
    color: '#aac4f0',
  },
  textArea: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 24,
    minHeight: 120,
  },
  button: {
    backgroundColor: '#4f8ef7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#333',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successEmoji: {
    fontSize: 48,
    color: '#4caf50',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
});