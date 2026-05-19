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
import * as AppleAuthentication from 'expo-apple-authentication';
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

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState(null);
  const [igHandle, setIgHandle] = useState('');
  const [igData, setIgData] = useState(null);
  const [igLoading, setIgLoading] = useState(false);
  const [igError, setIgError] = useState('');
  const [extractedHashtags, setExtractedHashtags] = useState([]);
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [customHashtag, setCustomHashtag] = useState('');
  const [urls, setUrls] = useState(['']);
  const [urlContents, setUrlContents] = useState({});
  const [urlLoading, setUrlLoading] = useState(false);
  const [sliderValues, setSliderValues] = useState({});
  const [previewComment, setPreviewComment] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleChecking, setAppleChecking] = useState(false);
  const [appleEmailMissing, setAppleEmailMissing] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const igTimeoutRef = useRef(null);

  const getSliders = () =>
    accountType === 'creator' ? CREATOR_SLIDERS : BUSINESS_SLIDERS;

  useEffect(() => {
    if (step === 7) {
      setAppleChecking(true);
      AppleAuthentication.isAvailableAsync()
        .then((available) => { setAppleAvailable(available); setAppleChecking(false); })
        .catch(() => { setAppleAvailable(false); setAppleChecking(false); });
    }
  }, [step]);

  const isValidEmail = (e) => {
    return e.includes('@') && e.includes('.') && e.indexOf('@') < e.lastIndexOf('.');
  };

  const extractHashtagsFromPosts = (posts) => {
    const allTags = {};
    posts.forEach((post) => {
      if (post.hashtags && Array.isArray(post.hashtags)) {
        post.hashtags.forEach((tag) => {
          const clean = tag.toLowerCase().replace('#', '');
          if (clean.length > 2) {
            allTags[clean] = (allTags[clean] || 0) + 1;
          }
        });
      }
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
    });
    return Object.entries(allTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag]) => tag);
  };

  const fetchIgProfile = async () => {
    if (!igHandle.trim()) return;
    if (igTimeoutRef.current) { clearTimeout(igTimeoutRef.current); igTimeoutRef.current = null; }
    setIgLoading(true);
    setIgError('');

    igTimeoutRef.current = setTimeout(() => {
      setIgLoading(false);
      Alert.alert(
        'This is taking a while',
        "Instagram is slow right now. You can continue without connecting your account.",
        [
          { text: 'Continue without IG', onPress: () => setStep(3) },
          { text: 'Try again', style: 'cancel', onPress: fetchIgProfile },
        ]
      );
    }, 60000);

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
        const posts = data;
        const captions = posts.map((p) => p.caption || p.text || '').filter(Boolean);
        const hashtags = extractHashtagsFromPosts(posts);

        setIgData({
          handle: data[0].ownerUsername,
          fullName: data[0].ownerFullName || '',
          posts: captions,
          rawPosts: posts,
        });
        setExtractedHashtags(hashtags);
        setSelectedHashtags(hashtags);
      } else if (data && data.length === 0) {
        setIgError('No posts found. This account may be private or have no posts yet. CommentEngine works best with public accounts that have recent posts.');
      } else {
        setIgError('Couldn\'t find that account. Check the spelling and try again.');
      }
    } catch (error) {
      console.error('Failed to fetch IG:', error);
      const isNetwork = error?.message?.includes('Network request failed') || error?.message?.includes('Failed to fetch');
      setIgError(isNetwork
        ? 'Check your internet connection and try again.'
        : 'Instagram is being difficult right now. Try again in a minute.'
      );
    } finally {
      if (igTimeoutRef.current) { clearTimeout(igTimeoutRef.current); igTimeoutRef.current = null; }
      setIgLoading(false);
    }
  };

  const toggleHashtag = (tag) => {
    setSelectedHashtags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomHashtag = () => {
    const clean = customHashtag.toLowerCase().replace('#', '').trim();
    if (clean.length > 2 && !selectedHashtags.includes(clean)) {
      setSelectedHashtags((prev) => [...prev, clean]);
      setExtractedHashtags((prev) => prev.includes(clean) ? prev : [...prev, clean]);
    }
    setCustomHashtag('');
  };

  const fetchUrlContent = async () => {
    const validUrls = urls.filter((u) => u.trim());
    if (validUrls.length === 0) {
      setStep(5);
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
      setStep(5);
    }
  };

  const generatePreview = async () => {
    setPreviewLoading(true);
    try {
      const sliders = getSliders();
      const sliderDesc = sliders
        .map((s) => {
          const val = sliderValues[s.id] || 3;
          const label = val <= 2 ? s.left : val >= 4 ? s.right : 'balanced';
          return `${s.left} vs ${s.right}: leaning ${label}`;
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

Generate exactly 1 sample comment for a popular post in this account's niche. STRICT RULES YOU MUST FOLLOW: maximum 2 sentences, NEVER use dashes or em dashes or hyphens between words, sounds like a casual text message not a caption, never promotional, make people curious about the commenter. Return ONLY the comment text, nothing else. Do not use any dashes.`,
          messages: [
            {
              role: 'user',
              content: 'Generate a sample comment that shows what my comments will sound like.',
            },
          ],
        }),
      });

      const data = await response.json();
      if (!data.content?.[0]?.text) {
        setPreviewComment('Could not generate preview. You can adjust settings later.');
        return;
      }
      setPreviewComment(data.content[0].text);
    } catch (error) {
      console.error('Preview failed:', error);
      setPreviewComment('Could not generate preview. You can adjust settings later.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleComplete = (overrides = {}) => {
    const finalName = overrides.name !== undefined ? overrides.name : name;
    const finalEmail = overrides.email !== undefined ? overrides.email : email;
    if (!isValidEmail(finalEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    onComplete({
      accountType,
      igHandle: igData?.handle || igHandle.replace('@', ''),
      igFullName: igData?.fullName || '',
      igPosts: igData?.posts || [],
      hashtags: selectedHashtags,
      referenceUrls: urlContents,
      sliderValues,
      sliders: getSliders(),
      name: finalName,
      email: finalEmail,
    });
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const givenName = credential.fullName?.givenName || '';
      const familyName = credential.fullName?.familyName || '';
      const appleName = [givenName, familyName].filter(Boolean).join(' ');
      const appleEmail = credential.email || '';

      if (!appleEmail) {
        if (appleName) setName(appleName);
        setAppleEmailMissing(true);
        setShowManualForm(true);
        return;
      }
      handleComplete({ name: appleName, email: appleEmail });
    } catch (error) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        setShowManualForm(true);
      }
    } finally {
      setAppleLoading(false);
    }
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

  const getSliderLabel = (slider, value) => {
    if (value <= 2) return slider.left;
    if (value >= 4) return slider.right;
    return 'Balanced';
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>What best describes you?</Text>
            <Text style={styles.subtitle}>This helps us match your tone</Text>
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
            <TouchableOpacity
              onPress={() => { setAccountType('creator'); setStep(2); }}
              style={styles.stepSkipButton}
            >
              <Text style={styles.stepSkipText}>Use default</Text>
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Your Instagram</Text>
            <Text style={styles.subtitle}>We'll study your last few posts so your comments sound authentic</Text>
            <View style={[styles.handleInputRow, igLoading && styles.inputDisabled]}>
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
                editable={!igLoading}
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
                <Text style={styles.successPosts}>Account connected</Text>
              </View>
            ) : null}
            {!igData ? (
              <TouchableOpacity
                style={[styles.button, (!igHandle.trim() || igLoading) && styles.buttonDisabled]}
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
            {!igData && !igLoading && (
              <TouchableOpacity onPress={() => setStep(3)} style={styles.stepSkipButton}>
                <Text style={styles.stepSkipText}>My account is new — skip this step</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 3:
        return (
          <ScrollView contentContainerStyle={styles.stepContainer} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => setStep(2)} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Your Communities</Text>
            <Text style={styles.subtitle}>
              These are the communities where we'll find posts for you to comment on
            </Text>
            <View style={styles.hashtagGrid}>
              {extractedHashtags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.hashtagChip,
                    selectedHashtags.includes(tag) && styles.hashtagChipSelected,
                  ]}
                  onPress={() => toggleHashtag(tag)}
                >
                  <Text
                    style={[
                      styles.hashtagText,
                      selectedHashtags.includes(tag) && styles.hashtagTextSelected,
                    ]}
                  >
                    #{tag}
                  </Text>
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
                onSubmitEditing={addCustomHashtag}
              />
              <TouchableOpacity
                style={[styles.addHashtagButton, !customHashtag.trim() && styles.buttonDisabled]}
                onPress={addCustomHashtag}
                disabled={!customHashtag.trim()}
              >
                <Text style={styles.addHashtagButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hashtagCount}>
              {selectedHashtags.length} hashtags selected
            </Text>
            <TouchableOpacity
              style={[styles.button, selectedHashtags.length === 0 && styles.buttonDisabled]}
              onPress={() => setStep(4)}
              disabled={selectedHashtags.length === 0}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(4)} style={styles.stepSkipButton}>
              <Text style={styles.stepSkipText}>I'll add these later</Text>
            </TouchableOpacity>
          </ScrollView>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <TouchableOpacity onPress={() => setStep(3)} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Reference URLs</Text>
            <Text style={styles.subtitle}>
              Got a website or menu? We'll reference it when writing replies
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
            ) : urls.some((u) => u.trim()) ? (
              <TouchableOpacity style={styles.button} onPress={fetchUrlContent}>
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.button} onPress={() => setStep(5)}>
                <Text style={styles.buttonText}>Skip this step</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 5:
        return (
          <ScrollView contentContainerStyle={styles.stepContainer} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => setStep(4)} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Set your voice</Text>
            <Text style={styles.subtitle}>Fine-tune how you want to sound</Text>
            {getSliders().map((slider) => (
              <View key={slider.id} style={styles.sliderContainer}>
                <View style={styles.sliderLabels}>
                  <Text style={[styles.sliderLeft, (sliderValues[slider.id] || 3) <= 2 && styles.sliderActive]}>{slider.left}</Text>
                  <Text style={[styles.sliderRight, (sliderValues[slider.id] || 3) >= 4 && styles.sliderActive]}>{slider.right}</Text>
                </View>
                <View style={styles.sliderTrack}>
                  {[1, 2, 3, 4, 5].map((val) => (
                    <TouchableOpacity
                      key={slider.id + '-' + val}
                      style={[
                        styles.sliderDot,
                        (sliderValues[slider.id] || 3) === val && styles.sliderDotSelected,
                      ]}
                      onPress={() => setSlider(slider.id, val)}
                    />
                  ))}
                  <View
                    style={[
                      styles.sliderFill,
                      { width: `${((sliderValues[slider.id] || 3) - 1) * 25}%` },
                    ]}
                  />
                </View>
                <Text style={styles.sliderCurrent}>
                  {getSliderLabel(slider, sliderValues[slider.id] || 3)}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setStep(6);
                generatePreview();
              }}
            >
              <Text style={styles.buttonText}>Preview My Voice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setStep(6); generatePreview(); }}
              style={styles.stepSkipButton}
            >
              <Text style={styles.stepSkipText}>Use defaults</Text>
            </TouchableOpacity>
          </ScrollView>
        );

      case 6:
        return (
          <View style={styles.stepContainer}>
            <TouchableOpacity onPress={() => setStep(5)} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Here's your voice</Text>
            <Text style={styles.subtitle}>Here's what your comments will sound like</Text>
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
              onPress={() => setStep(7)}
              disabled={previewLoading}
            >
              <Text style={styles.buttonText}>Looks good</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                generatePreview();
              }}
              style={styles.skipButton}
              disabled={previewLoading}
            >
              <Text style={styles.skipText}>See another one</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(5)} style={styles.skipButton}>
              <Text style={styles.skipText}>Adjust sliders</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(7)} style={styles.stepSkipButton}>
              <Text style={styles.stepSkipText}>I'll see it in action</Text>
            </TouchableOpacity>
          </View>
        );

      case 7:
        return (
          <View style={styles.stepContainer}>
            <TouchableOpacity onPress={() => setStep(6)} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Almost done</Text>
            <Text style={styles.subtitle}>Create your account</Text>
            {appleChecking ? (
              <ActivityIndicator color="#4f8ef7" style={{ marginVertical: 24 }} />
            ) : appleAvailable && !showManualForm ? (
              <>
                {appleLoading ? (
                  <ActivityIndicator color="#4f8ef7" style={{ marginVertical: 20 }} />
                ) : (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={12}
                    style={styles.appleButton}
                    onPress={handleAppleSignIn}
                  />
                )}
                <TouchableOpacity onPress={() => setShowManualForm(true)} style={styles.skipButton}>
                  <Text style={styles.skipText}>Use email instead</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {appleEmailMissing && (
                  <View style={styles.appleEmailMissingBox}>
                    <Text style={styles.appleEmailMissingText}>
                      Apple didn't share your email. Please enter it below.
                    </Text>
                  </View>
                )}
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
                  onPress={() => handleComplete()}
                  disabled={!name || !isValidEmail(email)}
                >
                  <Text style={styles.buttonText}>Start Using CommentEngine</Text>
                </TouchableOpacity>
                {appleAvailable && (
                  <TouchableOpacity onPress={() => { setShowManualForm(false); setAppleEmailMissing(false); }} style={styles.skipButton}>
                    <Text style={styles.skipText}>Use Apple Sign In instead</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
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
    width: 8,
    height: 8,
    borderRadius: 4,
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
  inputDisabled: {
    opacity: 0.5,
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
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    padding: 4,
  },
  backText: {
    color: '#4f8ef7',
    fontSize: 15,
  },
  stepSkipButton: {
    marginTop: 12,
    padding: 10,
  },
  stepSkipText: {
    color: '#555',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  appleEmailMissingBox: {
    backgroundColor: '#2a1a0a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ffaa00',
  },
  appleEmailMissingText: {
    color: '#ffaa00',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  hashtagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  hashtagChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  hashtagChipSelected: {
    backgroundColor: '#4f8ef7',
    borderColor: '#4f8ef7',
  },
  hashtagText: {
    color: '#999',
    fontSize: 14,
  },
  hashtagTextSelected: {
    color: '#fff',
  },
  addHashtagRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 16,
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
  hashtagCount: {
    color: '#666',
    fontSize: 13,
    marginBottom: 16,
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
    marginBottom: 12,
  },
  sliderLeft: {
    color: '#666',
    fontSize: 14,
  },
  sliderRight: {
    color: '#666',
    fontSize: 14,
  },
  sliderActive: {
    color: '#4f8ef7',
    fontWeight: '600',
  },
  sliderTrack: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 6,
    backgroundColor: '#4f8ef7',
    borderRadius: 3,
  },
  sliderDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#444',
    zIndex: 1,
  },
  sliderDotSelected: {
    backgroundColor: '#4f8ef7',
    borderColor: '#4f8ef7',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  sliderCurrent: {
    color: '#4f8ef7',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
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
  appleButton: {
    width: '100%',
    height: 52,
    marginBottom: 8,
  },
});