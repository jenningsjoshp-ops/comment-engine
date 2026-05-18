import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://loamofbivwruygmfdbkt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvYW1vZmJpdndydXlnbWZkYmt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTgwMTQsImV4cCI6MjA5NDYzNDAxNH0.7hgQ_Mz-rD_iRis1jQu2_nDGDK-dYc2POk2GyzInBMA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Save or update user profile
export async function saveUser(profile) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        email: profile.email,
        name: profile.name,
        ig_handle: profile.igHandle,
        ig_full_name: profile.igFullName || '',
        account_type: profile.accountType,
        slider_values: profile.sliderValues,
        sliders: profile.sliders,
        hashtags: profile.hashtags || [],
        ig_posts: profile.igPosts || [],
        reference_urls: profile.referenceUrls || {},
        tier: profile.tier || 'starter',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )
    .select()
    .single();

  if (error) console.error('Save user error:', error);
  return data;
}

// Load user by email
export async function loadUser(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    igHandle: data.ig_handle,
    igFullName: data.ig_full_name,
    accountType: data.account_type,
    sliderValues: data.slider_values,
    sliders: data.sliders,
    hashtags: data.hashtags,
    igPosts: data.ig_posts,
    referenceUrls: data.reference_urls,
    tier: data.tier,
  };
}

// Save a comment to history
export async function saveComment(userId, comment, allOptions, postCaption, postUrl, accountUsername) {
  const { error } = await supabase
    .from('comment_history')
    .insert({
      user_id: userId,
      selected_comment: comment,
      all_options: allOptions,
      post_caption: postCaption,
      post_url: postUrl,
      account_username: accountUsername || '',
    });

  if (error) console.error('Save comment error:', error);
}

// Load comment history
export async function loadCommentHistory(userId) {
  const { data, error } = await supabase
    .from('comment_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return [];
  return data.map((c) => ({
    id: c.id,
    selected: c.selected_comment,
    options: c.all_options,
    caption: c.post_caption,
    url: c.post_url,
    account: c.account_username,
    timestamp: c.created_at,
  }));
}

// Save commented post URL
export async function saveCommentedPost(userId, postUrl) {
  const { error } = await supabase
    .from('commented_posts')
    .upsert(
      { user_id: userId, post_url: postUrl },
      { onConflict: 'user_id,post_url' }
    );

  if (error) console.error('Save commented post error:', error);
}

// Load all commented post URLs
export async function loadCommentedPosts(userId) {
  const { data, error } = await supabase
    .from('commented_posts')
    .select('post_url')
    .eq('user_id', userId);

  if (error) return [];
  return data.map((p) => p.post_url);
}

// Save or update engaged account
export async function saveEngagedAccount(userId, username) {
  const { data: existing } = await supabase
    .from('engaged_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('username', username)
    .single();

  if (existing) {
    await supabase
      .from('engaged_accounts')
      .update({
        engagement_count: existing.engagement_count + 1,
        last_engaged: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('engaged_accounts')
      .insert({
        user_id: userId,
        username,
        engagement_count: 1,
        last_engaged: new Date().toISOString(),
      });
  }
}

// Load engaged accounts
export async function loadEngagedAccounts(userId) {
  const { data, error } = await supabase
    .from('engaged_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('last_engaged', { ascending: false });

  if (error) return [];
  return data.map((a) => ({
    username: a.username,
    count: a.engagement_count,
    lastEngaged: a.last_engaged,
  }));
}

// Save discovery cache
export async function saveDiscoveryCache(cacheKey, posts) {
  const { error } = await supabase
    .from('discovery_cache')
    .upsert(
      { cache_key: cacheKey, posts, created_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    );

  if (error) console.error('Save cache error:', error);
}

// Load discovery cache
export async function loadDiscoveryCache(cacheKey) {
  const { data, error } = await supabase
    .from('discovery_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .single();

  if (error) return null;

  const cacheAge = Date.now() - new Date(data.created_at).getTime();
  if (cacheAge > 24 * 60 * 60 * 1000) return null;

  return data.posts;
}