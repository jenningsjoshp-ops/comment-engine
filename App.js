import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from './screens/OnboardingScreen';
import MainScreen from './screens/MainScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReportingScreen from './screens/ReportingScreen';
import FeedbackScreen from './screens/FeedbackScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [commentHistory, setCommentHistory] = useState([]);
  const [selectedComments, setSelectedComments] = useState([]);
  const [commentCount, setCommentCount] = useState(0);
  const [tier, setTier] = useState('starter');

  const tierLimits = {
    starter: 20,
    growth: 150,
    business: 500,
  };

  const handleOnboardingComplete = (profile) => {
    setUserProfile(profile);
    setIsOnboarded(true);
  };

  const handleProfileUpdate = (updated) => {
    setUserProfile(updated);
  };

  const handleCommentUsed = (comment, allOptions, postCaption, postUrl) => {
    const entry = {
      id: Date.now().toString(),
      selected: comment,
      options: allOptions,
      caption: postCaption,
      url: postUrl,
      timestamp: new Date().toISOString(),
    };
    setCommentHistory((prev) => [entry, ...prev]);
    setSelectedComments((prev) => [comment, ...prev]);
    setCommentCount((prev) => prev + 1);
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isOnboarded ? (
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