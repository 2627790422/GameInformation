/**
 * 顶尖资讯 — Auth & Bookmarks Module
 * Supabase 客户端初始化 + 认证/收藏/个人信息 API
 * 依赖: Supabase JS SDK (CDN)
 */
(function () {
  'use strict';

  /* ---- Supabase Config ---- */
  const SUPABASE_URL = 'https://gfzkhdhzqhphzteflxxk.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmemtoZGh6cWhwaHp0ZWZseHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzAzNTksImV4cCI6MjA5MzY0NjM1OX0.DCRlvqPr4M1Djv4-x_72HiUkJ7iFZQak5aaJud4ZXQg';

  /* ---- State ---- */
  let _client = null;
  let _user = null;
  let _profile = null;
  let _bookmarks = new Set();  // article_id -> true
  let _readArticles = new Set();  // article_id -> true
  let _listeners = [];

  /* ---- Init ---- */
  function getClient() {
    if (!_client) {
      if (typeof supabase === 'undefined') {
        console.error('[Auth] Supabase SDK not loaded. Include CDN script before auth.js.');
        return null;
      }
      _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return _client;
  }

  /* ---- Auth State ---- */
  async function init() {
    const sb = getClient();
    if (!sb) return;

    // Restore session
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      _user = session.user;
      await loadProfile();
      await loadBookmarks();
      await loadReadHistory();
    }

    // Always notify after session restore (even if null — tells listeners initial state)
    _notify();

    // Listen for changes
    sb.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        _user = session.user;
        await loadProfile();
        await loadBookmarks();
        await loadReadHistory();
      } else {
        _user = null;
        _profile = null;
        _bookmarks = new Set();
        _readArticles = new Set();
      }
      _notify();
    });
  }

  async function loadProfile() {
    if (!_user) return;
    const sb = getClient();
    const { data } = await sb.from('profiles').select('*').eq('user_id', _user.id).single();
    _profile = data;
  }

  async function loadBookmarks() {
    if (!_user) return;
    const sb = getClient();
    const { data } = await sb.from('bookmarks').select('article_id').eq('user_id', _user.id);
    _bookmarks = new Set((data || []).map(r => r.article_id));
  }

  async function loadReadHistory() {
    if (!_user) return;
    const sb = getClient();
    const { data } = await sb.from('reading_history').select('article_id').eq('user_id', _user.id);
    _readArticles = new Set((data || []).map(r => r.article_id));
  }

  async function markAsRead(articleId) {
    if (!_user) return;
    const sb = getClient();
    const { error } = await sb.from('reading_history').insert({
      user_id: _user.id,
      article_id: articleId
    });
    if (error) {
      // Ignore duplicate key errors
      if (error.code === '23505') return;
      console.error('[Auth] markAsRead error:', error);
      return;
    }
    _readArticles.add(articleId);
  }

  function isRead(articleId) {
    return _readArticles.has(articleId);
  }

  /* ---- Listeners ---- */
  function onAuthChange(fn) {
    _listeners.push(fn);
    // Immediately call with current state
    if (_user !== undefined) fn(_user);
  }

  function _notify() {
    _listeners.forEach(fn => { try { fn(_user); } catch (_) {} });
  }

  /* ---- Auth Methods ---- */
  async function signUp(email, password, displayName) {
    const sb = getClient();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || email.split('@')[0] } }
    });
    if (error) throw error;
    const needsConfirmation = !data.session;
    if (data.session) {
      _user = data.session.user;
      await loadProfile();
      await loadBookmarks();
      await loadReadHistory();
      _notify();
    }
    return { user: data.user, session: data.session, needsEmailConfirmation: needsConfirmation };
  }

  async function signIn(email, password) {
    const sb = getClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    _user = data.user;
    await loadProfile();
    await loadBookmarks();
    await loadReadHistory();
    _notify();
    return data;
  }

  async function signOut() {
    const sb = getClient();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    _user = null;
    _profile = null;
    _bookmarks = new Set();
    _readArticles = new Set();
    _notify();
  }

  /* ---- User Methods ---- */
  function getUser() { return _user; }
  function getProfile() { return _profile; }

  async function updateProfile(data) {
    if (!_user) throw new Error('Not logged in');
    const sb = getClient();
    const { error } = await sb.from('profiles').update({
      ...data,
      updated_at: new Date().toISOString()
    }).eq('user_id', _user.id);
    if (error) throw error;
    await loadProfile();
    _notify();
    return _profile;
  }

  /* ---- Bookmark Methods ---- */
  async function addBookmark(articleId) {
    if (!_user) throw new Error('Not logged in');
    const sb = getClient();
    const { error } = await sb.from('bookmarks').insert({
      user_id: _user.id,
      article_id: articleId
    });
    if (error) {
      // Ignore duplicate key errors
      if (error.code === '23505') return;
      throw error;
    }
    _bookmarks.add(articleId);
  }

  async function removeBookmark(articleId) {
    if (!_user) throw new Error('Not logged in');
    const sb = getClient();
    const { error } = await sb.from('bookmarks').delete()
      .eq('user_id', _user.id)
      .eq('article_id', articleId);
    if (error) throw error;
    _bookmarks.delete(articleId);
  }

  function isBookmarked(articleId) {
    return _bookmarks.has(articleId);
  }

  async function getBookmarks() {
    if (!_user) return [];
    const sb = getClient();
    const { data, error } = await sb.from('bookmarks')
      .select('article_id, created_at')
      .eq('user_id', _user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /* ---- Expose ---- */
  window.Auth = {
    init,
    signUp,
    signIn,
    signOut,
    getUser,
    getProfile,
    updateProfile,
    onAuthChange,
    addBookmark,
    removeBookmark,
    getBookmarks,
    isBookmarked,
    markAsRead,
    isRead
  };

})();
