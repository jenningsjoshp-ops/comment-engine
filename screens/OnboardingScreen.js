import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { APIFY_API_TOKEN, ANTHROPIC_API_KEY } from '../config';

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
        marginTop: 12,
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

const ACCOUNT_TYPES = [
  { id: 'creator', label: 'Creator', desc: 'Influencer, fitness, lifestyle, personal brand' },
  { id: 'business', label: 'Business', desc: 'Restaurant, salon, shop, local service' },
  { id: 'brand', label: 'Brand', desc: 'Product, ecommerce, DTC, agency' },
];

const CREATOR_SLIDERS = [
  { id: 'humor', left: 'Serious', right: 'Funny' },
  { id: 'edge', left: 'Supportive', right: 'Roast-y' },
  { id: 'length', left: 'Short & punchy', right: 'Storytelling' },
  { id: 'personal', left: 'Universal', right: 'Personal' },
  { id: 'risk', left: 'Play it safe', right: 'Edgy' },
];

const BUSINESS_SLIDERS = [
  { id: 'formality', left: 'Casual', right: 'Professional' },
  { id: 'detail', left: 'Brief', right: 'Detailed' },
  { id: 'warmth', left: 'Friendly', right: 'Authoritative' },
  { id: 'branding', left: 'Generic', right: 'Brand-specific' },
  { id: 'initiative', left: 'Reactive', right: 'Proactive' },
];

const SLIDER_STEPS = [1, 2, 3, 4, 5];

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState(null);
  const [igHandle, setIgHandle] = useState('');
  const [igData, setIgData] = useState(null);
  const [igLoading, setIgLoading] = useState(false);
  const [igError, setIgError] = useState('');
  const [urls, setUrls] = useState(['']);
  const [urlContents, setUrlContents] = useState({});
  const [urlLoading, setUrlLoading] = useState(false);
  const [sliderValues, setSliderValues] = useState({});
  const [previewComment, setPreviewComment] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const getSliders = () =>
    accountType === 'creator' ? CREATOR_SLIDERS : BUSINESS_SLIDERS;

  const isValidEmail = (e) => {
    return e.includes('@') && e.includes('.') && e.indexOf('@') < e.lastIndexOf('.');
  };

  const fetchIgProfile = async () => {
    if (!igHandle.trim()) return;
    setIgLoading(true);
    setIgError('');
    try {
      const handle = igHandle.replace('@', '').trim();
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
      if (data && data.length > 0 && data[0].ownerUsername) {
        setIgData({
          handle: data[0].ownerUsername,
          fullName: data[0].ownerFullName || '',
          posts: data.map((p) => p.caption || p.text || '').filter(Boolean),
        });
      } else {
        setIgError('Couldn\'t find that account. Check the spelling and try again.');
      }
    } catch (error) {
      console.error('Failed to fetch IG:', error);
      setIgError('Something went wrong. Check your connection and try again.');
    } finally {
      setIgLoading(false);
    }
  };

  const fetchUrlContent = async () => {
    const validUrls = urls.filter((u) => u.trim());
    if (validUrls.length === 0) {
      setStep(4);
      return;
    }
    setUrlLoading(true);
    try {
      const contents = {};
      for (const url of validUrls) {
        try {
          const response = await fetch(url);
          const text = await response.text();
          const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          contents[url] = stripped.substring(0, 2000);
        } catch (e) {
          contents[url] = '';
        }
      }
      setUrlContents(contents);
    } catch (error) {
      console.error('Failed to fetch URLs:', error);
    } finally {
      setUrlLoading(false);
      setStep(4);
    }
  };

  const generatePreview = async () => {
    setPreviewLoading(true);
    try {
      const sliders = getSliders();
      const sliderDesc = sliders
        .map((s) => {
          const val = sliderValues[s.id] || 3;
          return `${s.left} vs ${s.right}: ${val}/5 toward ${val > 3 ? s.right : val < 3 ? s.left : 'neutral'}`;
        })
        .join('\n');

      const igContext = igData?.posts?.length
        ? `\nRecent posts by this account:\n${igData.posts.slice(0, 5).join('\n---\n')}`
        : '';

      const urlContext = Object.values(urlContents).filter(Boolean).length
        ? `\nReference content:\n${Object.values(urlContents).filter(Boolean).join('\n---\n')}`
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
          max_tokens: 512,
          system: `You are a comment ghostwriter. Account type: ${accountType}.

Voice settings:
${sliderDesc}
${igContext}
${urlContext}

Generate exactly 1 sample comment for a popular post in this account's niche. The comment should demonstrate the voice settings above. Return ONLY the comment text, nothing else.`,
          messages: [
            {
              role: 'user',
              content: 'Generate a sample comment that shows what my comments will sound like.',
            },
          ],
        }),
      });

      const data = await response.json();
      setPreviewComment(data.content[0].text);
    } catch (error) {
      console.error('Preview failed:', error);
      setPreviewComment('Could not generate preview. You can adjust settings later.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleComplete = () => {
    if (!isValidEmail(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    onComplete({
      accountType,
      igHandle: igData?.handle || igHandle.replace('@', ''),
      igFullName: igData?.fullName || '',
      igPosts: igData?.posts || [],
      referenceUrls: urlContents,
      sliderValues,
      sliders: getSliders(),
      name,
      email,
    });
  };

  const addUrlField = () => {
    if (urls.length < 5) setUrls([...urls, '']);
  };

  const updateUrl = (index, value) => {
    const updated = [...urls];
    updated[index] = value;
    setUrls(updated);
  };

  const setSlider = (id, value) => {
    setSliderValues((prev) => ({ ...prev, [id]: value }));
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>What best describes you?</Text>
            <Text style={styles.subtitle}>This shapes how your comments sound</Text>
            {ACCOUNT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[styles.typeCard, accountType === type.id && styles.typeCardSelected]}
                onPress={() => setAccountType(type.id)}
              >
                <Text style={[styles.typeLabel, accountType === type.id && styles.typeLabelSelected]}>
                  {type.label}
                </Text>
                <Text style={[styles.typeDesc, accountType === type.id && styles.typeDescSelected]}>
                  {type.desc}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.button, !accountType && styles.buttonDisabled]}
              onPress={() => setStep(2)}
              disabled={!accountType}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Your Instagram</Text>
            <Text style={styles.subtitle}>We'll pull your recent posts to learn your voice</Text>
            <View style={styles.handleInputRow}>
              <Text style={styles.atPrefix}>@</Text>
              <TextInput
                style={styles.handleInput}
                placeholder="yourhandle"
                placeholderTextColor="#666"
                value={igHandle}
                onChangeText={(val) => {
                  setIgHandle(val.replace('@', ''));
                  setIgError('');
                  setIgData(null);
                }}
                autoCapitalize="none"
                autoFocus={true}
              />
            </View>
            {igLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#4f8ef7" />
                <LoadingMessages
                  messages={[
                    "stalking your page real quick...",
                    "scrolling through your posts like a fan...",
                    "reading your captions so the AI doesn't wing it",
                    "learning your vibe... this takes a sec",
                    "teaching the robot what makes you, you",
                    "judging your grid layout... just kidding",
                    "counting how many gym selfies you posted",
                  ]}
                />
              </View>
            ) : igError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{igError}</Text>
              </View>
            ) : igData ? (
              <View style={styles.successBox}>
                <Text style={styles.successName}>{igData.fullName}</Text>
                <Text style={styles.successHandle}>@{igData.handle}</Text>
               <Text style={styles.successPosts}>
                  Account connected
                </Text>
              </View>
            ) : null}
            {!igData ? (
              <TouchableOpacity
                style={[styles.button, !igHandle.trim() && styles.buttonDisabled]}
                onPress={fetchIgProfile}
                disabled={!igHandle.trim() || igLoading}
              >
                <Text style={styles.buttonText}>Pull Posts</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.button}
                onPress={() => setStep(3)}
              >
                <Text style={styles.buttonText}>Next</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setStep(3)} style={styles.skipButton}>
              <Text style={styles.skipText}>I don't have Instagram</Text>
            </TouchableOpacity>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Reference URLs</Text>
            <Text style={styles.subtitle}>
              Add your website, menu, services page, or any URL that has info about you
            </Text>
            {urls.map((url, index) => (
              <TextInput
                key={'url-' + index}
                style={styles.input}
                placeholder="https://yoursite.com"
                placeholderTextColor="#666"
                value={url}
                onChangeText={(val) => updateUrl(index, val)}
                autoCapitalize="none"
                keyboardType="url"
              />
            ))}
            {urls.length < 5 && (
              <TouchableOpacity onPress={addUrlField} style={styles.addUrlButton}>
                <Text style={styles.addUrlText}>+ Add another URL</Text>
              </TouchableOpacity>
            )}
            {urlLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#4f8ef7" />
                <LoadingMessages
                  messages={[
                    "reading your website like a detective...",
                    "scanning your menu for the good stuff",
                    "absorbing your brand voice...",
                    "memorizing your about page",
                    "learning everything you forgot to tell us",
                  ]}
                />
              </View>
            ) : (
              <TouchableOpacity style={styles.button} onPress={fetchUrlContent}>
                <Text style={styles.buttonText}>
                  {urls.some((u) => u.trim()) ? 'Fetch & Continue' : 'Skip'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 4:
        return (
          <ScrollView contentContainerStyle={styles.stepContainer}>
            <Text style={styles.title}>Set your voice</Text>
            <Text style={styles.subtitle}>Drag each slider to match how you want to sound</Text>
            {getSliders().map((slider) => (
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
                      <Text style={[styles.dotText, (sliderValues[slider.id] || 3) === val && styles.dotTextSelected]}>
                        {val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setStep(5);
                generatePreview();
              }}
            >
              <Text style={styles.buttonText}>Preview My Voice</Text>
            </TouchableOpacity>
          </ScrollView>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Here's your voice</Text>
            <Text style={styles.subtitle}>This is what your comments will sound like</Text>
            {previewLoading ? (
              <View style={styles.previewBox}>
                <ActivityIndicator color="#4f8ef7" />
                <LoadingMessages
                  messages={[
                    "crafting your first comment...",
                    "making sure it doesn't sound like ChatGPT",
                    "calibrating sarcasm levels...",
                    "testing if a human would actually say this",
                    "filtering out anything cringe",
                    "would you actually post this? let's find out",
                    "removing all traces of robot energy",
                  ]}
                />
              </View>
            ) : (
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>{previewComment}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.button}
              onPress={() => setStep(6)}
              disabled={previewLoading}
            >
              <Text style={styles.buttonText}>Looks good</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(4)} style={styles.skipButton}>
              <Text style={styles.skipText}>Adjust sliders</Text>
            </TouchableOpacity>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Almost done</Text>
            <Text style={styles.subtitle}>Create your account</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity
              style={[styles.button, (!name || !isValidEmail(email)) && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={!name || !isValidEmail(email)}
            >
              <Text style={styles.buttonText}>Start Using CommentEngine</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.progress}>
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <View
              key={'step-' + s}
              style={[styles.progressDot, step >= s && styles.progressDotActive]}
            />
          ))}
        </View>
        {renderStep()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
    gap: 8,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333',
  },
  progressDotActive: {
    backgroundColor: '#4f8ef7',
  },
  stepContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    width: '100%',
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
    width: '100%',
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
  button: {
    backgroundColor: '#4f8ef7',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#333',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  typeCard: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  typeCardSelected: {
    borderColor: '#4f8ef7',
    backgroundColor: '#1a2a4a',
  },
  typeLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  typeLabelSelected: {
    color: '#4f8ef7',
  },
  typeDesc: {
    fontSize: 14,
    color: '#888',
  },
  typeDescSelected: {
    color: '#aac4f0',
  },
  errorBox: {
    backgroundColor: '#3a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#ff6666',
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#1a3a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  successName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  successHandle: {
    color: '#4caf50',
    fontSize: 16,
    marginTop: 4,
  },
  successPosts: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },
  skipButton: {
    marginTop: 16,
    padding: 12,
  },
  skipText: {
    color: '#666',
    fontSize: 14,
  },
  addUrlButton: {
    marginBottom: 16,
  },
  addUrlText: {
    color: '#4f8ef7',
    fontSize: 16,
  },
  loadingBox: {
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
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
  previewBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
});