import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Modal, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import WelcomeScreen from './screens/WelcomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainScreen from './screens/MainScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReportingScreen from './screens/ReportingScreen';
import FeedbackScreen from './screens/FeedbackScreen';
import DiscoverScreen from './screens/DiscoverScreen';
import InboxScreen from './screens/InboxScreen';
import QueueScreen from './screens/QueueScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveUser,
  loadUser,
  saveComment,
  loadCommentHistory,
  saveCommentedPost,
  loadCommentedPosts,
  saveEngagedAccount,
  loadEngagedAccounts,
  saveGoalProgress,
} from './lib/supabase';

const Stack = createNativeStackNavigator();

// TODO: replace with your App Store ID after submission
const APP_STORE_URL = 'https://apps.apple.com/app/id0000000000?action=write-review';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userId, setUserId] = useState(null);
  const [commentHistory, setCommentHistory] = useState([]);
  const [selectedComments, setSelectedComments] = useState([]);
  const [commentCount, setCommentCount] = useState(0);
  const [tier, setTier] = useState('starter');
  const [discoveryCount, setDiscoveryCount] = useState(0);
  const [lastDiscoveryDate, setLastDiscoveryDate] = useState(null);
  const [commentedPostUrls, setCommentedPostUrls] = useState([]);
  const [discoveryCache, setDiscoveryCache] = useState({});
  const [engagedAccounts, setEngagedAccounts] = useState([]);

  // Daily goal & streak
  const [todayCommentCount, setTodayCommentCount] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(10);
  const [streak, setStreak] = useState(0);
  const [lastGoalDate, setLastGoalDate] = useState(null);

  // Comment queue
  const [commentQueue, setCommentQueue] = useState([]);

  // Rating prompt
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);

  // Skipped onboarding (skip-and-explore flow)
  const [skippedOnboarding, setSkippedOnboarding] = useState(false);

  const tierLimits = { starter: 20, growth: 150, business: 500 };
  const discoveryLimits = { starter: 1, growth: 5, business: 999 };

  useEffect(() => {
    checkExistingUser();
  }, []);

  const checkExistingUser = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('userEmail');
      if (savedEmail) {
        const profile = await loadUser(savedEmail);
        if (profile) {
          setUserProfile(profile);
          setUserId(profile.id);
          setTier(profile.tier || 'starter');
          setIsOnboarded(true);
          setShowWelcome(false);

          // Goal & streak
          const goal = profile.dailyGoal || 10;
          setDailyGoal(goal);
          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          let currentStreak = profile.streak || 0;
          if (profile.lastGoalDate && profile.lastGoalDate !== today && profile.lastGoalDate !== yesterday) {
            currentStreak = 0;
            saveGoalProgress(profile.id, { streak: 0, lastGoalDate: profile.lastGoalDate });
          }
          setStreak(currentStreak);
          setLastGoalDate(profile.lastGoalDate || null);

          const history = await loadCommentHistory(profile.id);
          setCommentHistory(history);
          setSelectedComments(history.map((h) => h.selected));

          // Monthly comment count
          const now = new Date();
          const monthlyCount = history.filter((h) => {
            const d = new Date(h.timestamp);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          }).length;
          setCommentCount(monthlyCount);

          // Today's comment count for goal tracking
          const todayCount = history.filter((h) => new Date(h.timestamp).toDateString() === today).length;
          setTodayCommentCount(todayCount);

          const commented = await loadCommentedPosts(profile.id);
          setCommentedPostUrls(commented);

          const engaged = await loadEngagedAccounts(profile.id);
          setEngagedAccounts(engaged);

          // Rating prompt — show if ≥10 all-time comments and not yet shown
          const ratingShown = await AsyncStorage.getItem('ratingPromptShown');
          if (!ratingShown && history.length >= 10) {
            setShowRatingPrompt(true);
          }
        }
      }
    } catch (error) {
      console.error('Load user error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = async (profile) => {
    setUserProfile(profile);
    setIsOnboarded(true);
    setDailyGoal(profile.dailyGoal || 10);

    try {
      const saved = await saveUser(profile);
      if (saved) {
        setUserId(saved.id);
        await AsyncStorage.setItem('userEmail', profile.email);
      }
    } catch (error) {
      console.error('Save user error:', error);
    }
  };

  const handleProfileUpdate = async (updated) => {
    setUserProfile(updated);
    if (updated.dailyGoal !== undefined) setDailyGoal(updated.dailyGoal);
    if (updated.igHandle) setSkippedOnboarding(false);

    try {
      await saveUser({ ...updated, tier });
      if (updated.email) await AsyncStorage.setItem('userEmail', updated.email);
    } catch (error) {
      console.error('Update user error:', error);
    }
  };

  const handleCommentUsed = async (comment, allOptions, postCaption, postUrl, accountUsername) => {
    const entry = {
      id: Date.now().toString(),
      selected: comment,
      options: allOptions,
      caption: postCaption,
      url: postUrl,
      account: accountUsername || '',
      timestamp: new Date().toISOString(),
    };
    setCommentHistory((prev) => [entry, ...prev]);
    setSelectedComments((prev) => [comment, ...prev]);
    setCommentCount((prev) => prev + 1);

    // Today count + streak check
    const newTodayCount = todayCommentCount + 1;
    setTodayCommentCount(newTodayCount);

    const today = new Date().toDateString();
    if (dailyGoal > 0 && newTodayCount >= dailyGoal && lastGoalDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const newStreak = lastGoalDate === yesterday ? streak + 1 : 1;
      setStreak(newStreak);
      setLastGoalDate(today);
      if (userId) saveGoalProgress(userId, { streak: newStreak, lastGoalDate: today });
    }

    if (postUrl && !commentedPostUrls.includes(postUrl)) {
      setCommentedPostUrls((prev) => [...prev, postUrl]);
    }

    if (accountUsername && !engagedAccounts.find((a) => a.username === accountUsername)) {
      setEngagedAccounts((prev) => [
        ...prev,
        { username: accountUsername, count: 1, lastEngaged: new Date().toISOString() },
      ]);
    } else if (accountUsername) {
      setEngagedAccounts((prev) =>
        prev.map((a) =>
          a.username === accountUsername
            ? { ...a, count: a.count + 1, lastEngaged: new Date().toISOString() }
            : a
        )
      );
    }

    if (userId) {
      try {
        await saveComment(userId, comment, allOptions, postCaption, postUrl, accountUsername);
        if (postUrl) await saveCommentedPost(userId, postUrl);
        if (accountUsername) await saveEngagedAccount(userId, accountUsername);
      } catch (error) {
        console.error('Save to Supabase error:', error);
      }
    }

    // Rating prompt — trigger on 10th comment ever
    if (!showRatingPrompt && commentHistory.length + 1 >= 10) {
      const ratingShown = await AsyncStorage.getItem('ratingPromptShown');
      if (!ratingShown) setShowRatingPrompt(true);
    }
  };

  const handleDiscoveryUsed = () => {
    const today = new Date().toDateString();
    if (lastDiscoveryDate !== today) {
      // Explicitly reset to 0 for the new day, then count this session as 1
      setDiscoveryCount(1);
      setLastDiscoveryDate(today);
    } else {
      setDiscoveryCount((prev) => prev + 1);
    }
  };

  const resetDiscoveryIfNewDay = () => {
    const today = new Date().toDateString();
    if (lastDiscoveryDate && lastDiscoveryDate !== today) {
      setDiscoveryCount(0);
      setLastDiscoveryDate(null);
    }
  };

  const getDiscoveryRemaining = () => {
    const today = new Date().toDateString();
    if (lastDiscoveryDate !== today) return discoveryLimits[tier];
    return Math.max(0, discoveryLimits[tier] - discoveryCount);
  };

  const addToQueue = (item) => {
    setCommentQueue((prev) => [item, ...prev]);
  };

  const markQueueDone = (id) => {
    setCommentQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRateUs = async () => {
    await AsyncStorage.setItem('ratingPromptShown', 'true');
    setShowRatingPrompt(false);
    Linking.openURL(APP_STORE_URL);
  };

  const handleDismissRating = async () => {
    await AsyncStorage.setItem('ratingPromptShown', 'true');
    setShowRatingPrompt(false);
  };

  const handleSkipAndExplore = () => {
    const defaultProfile = {
      accountType: 'creator',
      igHandle: '',
      igFullName: '',
      igPosts: [],
      hashtags: [],
      referenceUrls: {},
      sliderValues: {},
      sliders: [
        { id: 'humor', left: 'Serious', right: 'Funny' },
        { id: 'edge', left: 'Supportive', right: 'Roast-y' },
        { id: 'length', left: 'Short & punchy', right: 'Storytelling' },
        { id: 'personal', left: 'Universal', right: 'Personal' },
        { id: 'risk', left: 'Play it safe', right: 'Edgy' },
      ],
      name: '',
      email: '',
      dailyGoal: 10,
    };
    setUserProfile(defaultProfile);
    setIsOnboarded(true);
    setShowWelcome(false);
    setSkippedOnboarding(true);
    setDailyGoal(10);
  };

  const handleSetUpNow = () => {
    setSkippedOnboarding(false);
    setIsOnboarded(false);
  };

  const handleLogOut = async () => {
    try {
      await AsyncStorage.removeItem('userEmail');
      await AsyncStorage.removeItem('ratingPromptShown');
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUserProfile(null);
    setUserId(null);
    setIsOnboarded(false);
    setShowWelcome(true);
    setCommentHistory([]);
    setSelectedComments([]);
    setCommentCount(0);
    setTier('starter');
    setDiscoveryCount(0);
    setLastDiscoveryDate(null);
    setCommentedPostUrls([]);
    setDiscoveryCache({});
    setEngagedAccounts([]);
    setTodayCommentCount(0);
    setDailyGoal(10);
    setStreak(0);
    setLastGoalDate(null);
    setCommentQueue([]);
    setShowRatingPrompt(false);
    setSkippedOnboarding(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#4f8ef7" size="large" />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {showWelcome ? (
            <Stack.Screen name="Welcome">
              {(props) => (
                <WelcomeScreen
                  {...props}
                  onComplete={() => setShowWelcome(false)}
                  onSkipAndExplore={handleSkipAndExplore}
                />
              )}
            </Stack.Screen>
          ) : !isOnboarded ? (
            <Stack.Screen name="Onboarding">
              {(props) => (
                <OnboardingScreen {...props} onComplete={handleOnboardingComplete} />
              )}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Main">
                {(props) => (
                  <MainScreen
                    {...props}
                    userProfile={userProfile}
                    onCommentUsed={handleCommentUsed}
                    selectedComments={selectedComments}
                    commentCount={commentCount}
                    tierLimit={tierLimits[tier]}
                    tier={tier}
                    discoveryRemaining={getDiscoveryRemaining()}
                    todayCommentCount={todayCommentCount}
                    dailyGoal={dailyGoal}
                    streak={streak}
                    queueCount={commentQueue.length}
                    skippedOnboarding={skippedOnboarding}
                    onSetUpNow={handleSetUpNow}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Discover">
                {(props) => (
                  <DiscoverScreen
                    {...props}
                    userProfile={userProfile}
                    onCommentUsed={handleCommentUsed}
                    addToQueue={addToQueue}
                    selectedComments={selectedComments}
                    commentCount={commentCount}
                    tierLimit={tierLimits[tier]}
                    tier={tier}
                    commentedPostUrls={commentedPostUrls}
                    onDiscoveryUsed={handleDiscoveryUsed}
                    discoveryCache={discoveryCache}
                    setDiscoveryCache={setDiscoveryCache}
                    engagedAccounts={engagedAccounts}
                    discoveryRemaining={getDiscoveryRemaining()}
                    discoveryCount={discoveryCount}
                    lastDiscoveryDate={lastDiscoveryDate}
                    dailyDiscoveryLimit={discoveryLimits[tier]}
                    onResetDiscovery={resetDiscoveryIfNewDay}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Inbox">
                {(props) => (
                  <InboxScreen
                    {...props}
                    userProfile={userProfile}
                    tier={tier}
                    selectedComments={selectedComments}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Queue">
                {(props) => (
                  <QueueScreen
                    {...props}
                    queue={commentQueue}
                    onDone={markQueueDone}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Settings">
                {(props) => (
                  <SettingsScreen
                    {...props}
                    userProfile={userProfile}
                    onUpdate={handleProfileUpdate}
                    tier={tier}
                    onUpgrade={setTier}
                    dailyGoal={dailyGoal}
                    onLogOut={handleLogOut}
                    skippedOnboarding={skippedOnboarding}
                    onSetUpNow={handleSetUpNow}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Reporting">
                {(props) => (
                  <ReportingScreen
                    {...props}
                    commentHistory={commentHistory}
                    commentCount={commentCount}
                    tier={tier}
                    tierLimit={tierLimits[tier]}
                    engagedAccounts={engagedAccounts}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Feedback">
                {(props) => <FeedbackScreen {...props} userProfile={userProfile} />}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {/* App Store rating prompt */}
      <Modal visible={showRatingPrompt} transparent animationType="fade">
        <View style={ratingStyles.overlay}>
          <View style={ratingStyles.card}>
            <Text style={ratingStyles.emoji}>⭐</Text>
            <Text style={ratingStyles.title}>Enjoying CommentEngine?</Text>
            <Text style={ratingStyles.body}>
              A quick rating helps us reach more creators and keeps the app growing!
            </Text>
            <TouchableOpacity style={ratingStyles.rateBtn} onPress={handleRateUs}>
              <Text style={ratingStyles.rateBtnText}>Rate Us</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ratingStyles.dismissBtn} onPress={handleDismissRating}>
              <Text style={ratingStyles.dismissText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const ratingStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 20, padding: 28,
    width: '100%', maxWidth: 360, alignItems: 'center',
    borderWidth: 1, borderColor: '#333',
  },
  emoji: { fontSize: 44, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 10, textAlign: 'center' },
  body: { fontSize: 15, color: '#999', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  rateBtn: {
    backgroundColor: '#4f8ef7', paddingVertical: 14, borderRadius: 12,
    width: '100%', alignItems: 'center', marginBottom: 12,
  },
  rateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dismissBtn: { padding: 8 },
  dismissText: { color: '#666', fontSize: 14 },
});
