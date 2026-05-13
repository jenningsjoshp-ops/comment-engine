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

const SLIDER_STEPS = [1, 2, 3, 4, 5];

const TIER_INFO = {
  starter: { name: 'Starter', price: '$5/mo', limit: '20 comments/month' },
  growth: { name: 'Growth', price: '$15/mo', limit: '150 comments/month' },
  business: { name: 'Business', price: '$50/mo', limit: '500 comments/month' },
};

export default function SettingsScreen({ navigation, userProfile, onUpdate, tier, onUpgrade }) {
  const [sliderValues, setSliderValues] = useState(userProfile?.sliderValues || {});
  const [name, setName] = useState(userProfile?.name || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [igHandle, setIgHandle] = useState(userProfile?.igHandle || '');
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
    });

    navigation.goBack();
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
  saveButton: {
    backgroundColor: '#4f8ef7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});