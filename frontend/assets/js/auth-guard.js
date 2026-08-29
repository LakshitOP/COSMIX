(function () {
  "use strict";

  const USER_STORAGE_KEY = "cosmix_user";
  const AUTH_RETURN_KEY = "cosmix_auth_return_to";

  function getStoredUser() {
    try {
      const raw = window.localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function isAuthenticated() {
    const user = getStoredUser();
    return !!(user && (user.uid || user.email));
  }

  function isProtectedPath(pathname) {
    return /\/(Explore|MONITOR|Analytics)\//i.test(pathname || "");
  }

  function getHomeUrl() {
    const path = window.location.pathname;
    const frontendIndex = path.toLowerCase().indexOf("/frontend/");

    if (frontendIndex >= 0) {
      return `${path.slice(0, frontendIndex)}/frontend/HOME/index.html?auth=required`;
    }

    return "../HOME/index.html?auth=required";
  }

  function redirectToSignIn() {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    try {
      window.sessionStorage.setItem(AUTH_RETURN_KEY, returnTo);
    } catch (error) {}

    window.location.replace(getHomeUrl());
  }

  if (isProtectedPath(window.location.pathname) && !isAuthenticated()) {
    redirectToSignIn();
  }

  window.CosmixAuthGuard = {
    isAuthenticated,
    requireAuth() {
      if (isAuthenticated()) return true;
      redirectToSignIn();
      return false;
    }
  };
})();
