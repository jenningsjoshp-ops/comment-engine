import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from './screens/WelcomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainScreen from './screens/MainScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReportingScreen from './screens/ReportingScreen';
import FeedbackScreen from './screens/FeedbackScreen';
import DiscoverScreen from './screens/DiscoverScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [commentHistory, setCommentHistory] = useState([]);
  const [selectedComments, setSelectedComments] = useState([]);
  const [commentCount, setCommentCount] = useState(0);
  const [tier, setTier] = useState('starter');
  const [discoveryCount, setDiscoveryCount] = useState(0);
  const [lastDiscoveryDate, setLastDiscoveryDate] = useState(null);
  const [commentedPostUrls, setCommentedPostUrls] = useState([]);
  const [discoveryCache, setDiscoveryCache] = useState({});
  const [engagedAccounts, setEngagedAccounts] = useState([]);

  const tierLimits = {
    starter: 20,
    growth: 150,
    business: 500,
  };

  const discoveryLimits = {
    starter: 1,
    growth: 5,
    business: 999,
  };

  const handleOnboardingComplete = (profile) => {
    setUserProfile(profile);
    setIsOnboarded(true);
  };

  const handleProfileUpdate = (updated) => {
    setUserProfile(updated);
  };

  const handleCommentUsed = (comment, allOptions, postCaption, postUrl, accountUsername) => {
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
  };

  const handleDiscoveryUsed = () => {
    const today = new Date().toDateString();
    if (lastDiscoveryDate !== today) {
      setDiscoveryCount(1);
      setLastDiscoveryDate(today);
    } else {
      setDiscoveryCount((prev) => prev + 1);
    }
  };

  const getDiscoveryRemaining = () => {
    const today = new Date().toDateString();
    if (lastDiscoveryDate !== today) return discoveryLimits[tier];
    return Math.max(0, discoveryLimits[tier] - discoveryCount);
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {showWelcome ? (
          <Stack.Screen name="Welcome">
            {(props) => (
              <WelcomeScreen {...props} onComplete={() => setShowWelcome(false)} />
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
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Discover">
              {(props) => (
                <DiscoverScreen
                  {...props}
                  userProfile={userProfile}
                  onCommentUsed={handleCommentUsed}
                  selectedComments={selectedComments}
                  commentCount={commentCount}
                  tierLimit={tierLimits[tier]}
                  tier={tier}
                  commentedPostUrls={commentedPostUrls}
                  onDiscoveryUsed={handleDiscoveryUsed}
                  discoveryCache={discoveryCache}
                  setDiscoveryCache={setDiscoveryCache}
                  engagedAccounts={engagedAccounts}
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
  );
}