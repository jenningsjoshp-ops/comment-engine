import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APIFY_API_TOKEN } from '../config';

const SLIDER_STEPS = [1, 2, 3, 4, 5];

const TIER_INFO = {
  starter: { name: 'Starter', price: '$5/mo', limit: '20 comments/month' },
  growth: { name: 'Growth', price: '$15/mo', limit: '150 comments/month' },
  business: { name: 'Business', price: '$50/mo', limit: '500 comments/month' },
};

const GOAL_OPTIONS = [5, 10, 15, 20];

export default function SettingsScreen({ navigation, userProfile, onUpdate, tier, onUpgrade, dailyGoal, onLogOut }) {
  const [goalValue, setGoalValue] = useState(dailyGoal || userProfile?.dailyGoal || 10);
  const [sliderValues, setSliderValues] = useState(userProfile?.sliderValues || {});
  const [name, setName] = useState(userProfile?.name || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [igHandle, setIgHandle] = useState(userProfile?.igHandle || '');
  const [hashtags, setHashtags] = useState(userProfile?.hashtags || []);
  const [customHashtag, setCustomHashtag] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [urls, setUrls] = useState(() => {
    const existing = Object.keys(userProfile?.referenceUrls || {});
    return existing.length > 0 ? existing : [''];
  });

  const sliders = userProfile?.sliders || [];

  const setSlider = (id, value) => {
    setSliderValues((prev) => ({ ...prev, [id]: value }));
  };

  const isValidEmail = (e) => {
    return e.includes('@') && e.includes('.') && e.indexOf('@') < e.lastIndexOf('.');
  };

  const addUrlField = () => {
    if (urls.length < 5) setUrls([...urls, '']);
  };

  const updateUrl = (index, value) => {
    const updated = [...urls];
    updated[index] = value;
    setUrls(updated);
  };

  const removeUrl = (index) => {
    const updated = urls.filter((_, i) => i !== index);
    if (updated.length === 0) updated.push('');
    setUrls(updated);
  };

  const removeHashtag = (tag) => {
    setHashtags((prev) => prev.filter((t) => t !== tag));
  };

  const addHashtag = () => {
    const clean = customHashtag.toLowerCase().replace('#', '').trim();
    if (clean.length > 2 && !hashtags.includes(clean)) {
      setHashtags((prev) => [...prev, clean]);
    }
    setCustomHashtag('');
  };

  const refreshVoice = async () => {
    const handle = igHandle.replace('@', '').trim();
    if (!handle) {
      Alert.alert('No handle', 'Enter your Instagram handle first.');
      return;
    }

    setRefreshing(true);
    try {
      const response = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            directUrls: [`https://www.instagram.com/${handle}/`],
            resultsType: 'posts',
            resultsLimit: 10,
          }),
        }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const captions = data.map((p) => p.caption || p.text || '').filter(Boolean);

        const allTags = {};
        data.forEach((post) => {
          const caption = post.caption || post.text || '';
          const matches = caption.match(/#(\w+)/g);
          if (matches) {
            matches.forEach((tag) => {
              const clean = tag.toLowerCase().replace('#', '');
              if (clean.length > 2) {
                allTags[clean] = (allTags[clean] || 0) + 1;
              }
            });
          }
          if (post.hashtags && Array.isArray(post.hashtags)) {
            post.hashtags.forEach((tag) => {
              const clean = tag.toLowerCase().replace('#', '');
              if (clean.length > 2) {
                allTags[clean] = (allTags[clean] || 0) + 1;
              }
            });
          }
        });

        const newHashtags = Object.entries(allTags)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([tag]) => tag);

        const mergedHashtags = [...new Set([...hashtags, ...newHashtags])];

        onUpdate({
          ...userProfile,
          igPosts: captions,
          hashtags: mergedHashtags,
          sliderValues,
          name,
          email,
          igHandle: handle,
        });

        setHashtags(mergedHashtags);
        Alert.alert('Voice refreshed', `Pulled ${captions.length} new posts and ${newHashtags.length} hashtags.`);
      } else if (data && data.length === 0) {
        Alert.alert(
          'Account may be private',
          'CommentEngine only works with public profiles. Check your account privacy settings.'
        );
      } else {
        Alert.alert('Could not refresh', 'Couldn\'t find posts for that handle.');
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      const isNetwork = error?.message?.includes('Network request failed') || error?.message?.includes('Failed to fetch');
      Alert.alert(
        isNetwork ? 'Check your internet connection' : 'Instagram is being difficult right now',
        isNetwork ? 'Check your internet connection and try again.' : 'Try again in a minute.'
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (!isValidEmail(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    const validUrls = urls.filter((u) => u.trim());
    const urlContents = {};
    for (const url of validUrls) {
      if (userProfile?.referenceUrls?.[url]) {
        urlContents[url] = userProfile.referenceUrls[url];
      } else {
        try {
          const response = await fetch(url);
          const text = await response.text();
          const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          urlContents[url] = stripped.substring(0, 2000);
        } catch (e) {
          urlContents[url] = '';
        }
      }
    }

    onUpdate({
      ...userProfile,
      sliderValues,
      name,
      email,
      igHandle: igHandle.replace('@', ''),
      referenceUrls: urlContents,
      hashtags,
      dailyGoal: goalValue,
    });

    navigation.goBack();
  };

  const handleLogOut = () => {
    Alert.alert(
      'Log Out',
      'This will clear your session and reset all data so you can start fresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: onLogOut },
      ]
    );
  };

  const handleUpgrade = (newTier) => {
    Alert.alert(
      `Upgrade to ${TIER_INFO[newTier].name}`,
      `${TIER_INFO[newTier].price} — ${TIER_INFO[newTier].limit}\n\nPayment integration coming soon. For now, your tier has been updated.`,
      [
        {
          text: 'Upgrade',
          onPress: () => onUpgrade(newTier),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 50 }} />
      </View>

      <Text style={styles.sectionTitle}>Your Plan</Text>
      <View style={styles.tierCard}>
        <Text style={styles.tierName}>{TIER_INFO[tier].name}</Text>
        <Text style={styles.tierPrice}>{TIER_INFO[tier].price}</Text>
        <Text style={styles.tierLimit}>{TIER_INFO[tier].limit}</Text>
      </View>

      {tier !== 'business' && (
        <View style={styles.upgradeSection}>
          {tier === 'starter' && (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => handleUpgrade('growth')}
            >
              <Text style={styles.upgradeName}>Growth</Text>
              <Text style={styles.upgradeDetail}>$15/mo — 150 comments/month</Text>
            </TouchableOpacity>
          )}
          {(tier === 'starter' || tier === 'growth') && (
            <TouchableOpacity
              style={[styles.upgradeButton, styles.upgradeButtonPremium]}
              onPress={() => handleUpgrade('business')}
            >
              <Text style={styles.upgradeName}>Business</Text>
              <Text style={styles.upgradeDetail}>$50/mo — 500 comments/month</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Profile</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholderTextColor="#666"
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor="#666"
      />

      <Text style={styles.label}>Instagram Handle</Text>
      <View style={styles.handleInputRow}>
        <Text style={styles.atPrefix}>@</Text>
        <TextInput
          style={styles.handleInput}
          value={igHandle}
          onChangeText={(val) => setIgHandle(val.replace('@', ''))}
          autoCapitalize="none"
          placeholderTextColor="#666"
        />
      </View>

      <TouchableOpacity
        style={[styles.refreshButton, refreshing && styles.buttonDisabled]}
        onPress={refreshVoice}
        disabled={refreshing}
      >
        {refreshing ? (
          <ActivityIndicator color="#4f8ef7" />
        ) : (
          <Text style={styles.refreshButtonText}>Refresh My Voice & Hashtags</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Target Hashtags</Text>
      <Text style={styles.sectionSubtitle}>
        These determine which posts show up in Discover
      </Text>

      <View style={styles.hashtagGrid}>
        {hashtags.map((tag) => (
          <TouchableOpacity
            key={tag}
            style={styles.hashtagChip}
            onPress={() => removeHashtag(tag)}
          >
            <Text style={styles.hashtagText}>#{tag}</Text>
            <Text style={styles.hashtagRemove}> ✕</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.addHashtagRow}>
        <TextInput
          style={styles.addHashtagInput}
          placeholder="Add a hashtag..."
          placeholderTextColor="#666"
          value={customHashtag}
          onChangeText={setCustomHashtag}
          autoCapitalize="none"
          onSubmitEditing={addHashtag}
        />
        <TouchableOpacity
          style={[styles.addHashtagButton, !customHashtag.trim() && styles.buttonDisabled]}
          onPress={addHashtag}
          disabled={!customHashtag.trim()}
        >
          <Text style={styles.addHashtagButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Reference URLs</Text>
      <Text style={styles.sectionSubtitle}>
        Your website, menu, services page, or any reference content
      </Text>

      {urls.map((url, index) => (
        <View key={'url-' + index} style={styles.urlRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="https://yoursite.com"
            placeholderTextColor="#666"
            value={url}
            onChangeText={(val) => updateUrl(index, val)}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity
            onPress={() => removeUrl(index)}
            style={styles.removeUrlButton}
          >
            <Text style={styles.removeUrlText}>X</Text>
          </TouchableOpacity>
        </View>
      ))}

      {urls.length < 5 && (
        <TouchableOpacity onPress={addUrlField} style={styles.addUrlButton}>
          <Text style={styles.addUrlText}>+ Add another URL</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Daily Comment Goal</Text>
      <Text style={styles.sectionSubtitle}>Hit this many comments to keep your streak going</Text>
      <View style={styles.goalOptions}>
        {GOAL_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.goalOption, goalValue === opt && styles.goalOptionSelected]}
            onPress={() => setGoalValue(opt)}
          >
            <Text style={[styles.goalOptionText, goalValue === opt && styles.goalOptionTextSelected]}>
              {opt}
            </Text>
            <Text style={[styles.goalOptionLabel, goalValue === opt && styles.goalOptionTextSelected]}>
              /day
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Voice Settings</Text>
      <Text style={styles.sectionSubtitle}>
        Account type: {userProfile?.accountType || 'creator'}
      </Text>

      {sliders.map((slider) => (
        <View key={slider.id} style={styles.sliderContainer}>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLeft}>{slider.left}</Text>
            <Text style={styles.sliderRight}>{slider.right}</Text>
          </View>
          <View style={styles.sliderDots}>
            {SLIDER_STEPS.map((val) => (
              <TouchableOpacity
                key={slider.id + '-' + val}
                style={[styles.dot, (sliderValues[slider.id] || 3) === val && styles.dotSelected]}
                onPress={() => setSlider(slider.id, val)}
              >
                <Text
                  style={[styles.dotText, (sliderValues[slider.id] || 3) === val && styles.dotTextSelected]}
                >
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logOutButton} onPress={handleLogOut}>
        <Text style={styles.logOutButtonText}>Log Out</Text>
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
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    marginTop: -8,
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
  handleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  atPrefix: {
    color: '#4f8ef7',
    fontSize: 18,
    fontWeight: '600',
    paddingLeft: 16,
  },
  handleInput: {
    flex: 1,
    padding: 16,
    paddingLeft: 8,
    fontSize: 16,
    color: '#fff',
  },
  refreshButton: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4f8ef7',
    marginBottom: 8,
  },
  refreshButtonText: {
    color: '#4f8ef7',
    fontSize: 16,
    fontWeight: '600',
  },
  tierCard: {
    backgroundColor: '#1a2a4a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#4f8ef7',
    alignItems: 'center',
  },
  tierName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4f8ef7',
  },
  tierPrice: {
    fontSize: 18,
    color: '#fff',
    marginTop: 4,
  },
  tierLimit: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  upgradeSection: {
    marginTop: 16,
    gap: 10,
  },
  upgradeButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4f8ef7',
  },
  upgradeButtonPremium: {
    backgroundColor: '#1a1a3a',
    borderColor: '#aa77ff',
  },
  upgradeName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  upgradeDetail: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  hashtagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  hashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1a2a4a',
    borderWidth: 1,
    borderColor: '#4f8ef7',
  },
  hashtagText: {
    color: '#4f8ef7',
    fontSize: 14,
  },
  hashtagRemove: {
    color: '#ff6666',
    fontSize: 14,
  },
  addHashtagRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  addHashtagInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  addHashtagButton: {
    backgroundColor: '#4f8ef7',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addHashtagButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  removeUrlButton: {
    backgroundColor: '#ff4444',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeUrlText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  addUrlButton: {
    marginBottom: 16,
  },
  addUrlText: {
    color: '#4f8ef7',
    fontSize: 16,
  },
  buttonDisabled: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333',
  },
  sliderContainer: {
    width: '100%',
    marginBottom: 28,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sliderLeft: {
    color: '#999',
    fontSize: 13,
  },
  sliderRight: {
    color: '#999',
    fontSize: 13,
  },
  sliderDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotSelected: {
    backgroundColor: '#4f8ef7',
    borderColor: '#4f8ef7',
  },
  dotText: {
    color: '#666',
    fontSize: 14,
  },
  dotTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  goalOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  goalOption: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  goalOptionSelected: {
    backgroundColor: '#1a3a1a',
    borderColor: '#4caf50',
  },
  goalOptionText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  goalOptionLabel: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  goalOptionTextSelected: {
    color: '#4caf50',
  },
  saveButton: {
    backgroundColor: '#4f8ef7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  logOutButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  logOutButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
});