import {
    GithubAuthProvider,
    GoogleAuthProvider,
    isSignInWithEmailLink,
    onAuthStateChanged,
    sendSignInLinkToEmail,
    signInWithEmailLink,
    signInWithPopup,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { auth } from "./firebase-config.js";

// ================================================================
// DOM ELEMENTS
// ================================================================

// Auth Modal
const authOverlay = document.getElementById("auth-overlay");
const authCloseBtn = document.getElementById("auth-close");
const googleBtn = document.getElementById("google-auth-btn");
const githubBtn = document.getElementById("github-auth-btn");
const demoAuthBtn = document.getElementById("demo-auth-btn");
const signupForm = document.getElementById("signup-form");
const emailInput = document.getElementById("email");
const fullNameInput = document.getElementById("full-name");
const authStatus = document.getElementById("auth-status");
const submitBtn = document.getElementById("auth-submit-btn");
const heroTrigger = document.getElementById("hero-signup-trigger");
const signinLink = document.getElementById("auth-signin-link");

// Navbar & Animate UI Menu
const profileMenuRoot = document.getElementById("profile-menu-root");
const navAvatarBtn = document.getElementById("nav-avatar-btn");
const navAvatar = document.getElementById("nav-avatar");
const presenceIndicator = document.getElementById("presence-indicator");
const profileMenu = document.getElementById("profile-menu");
const menuAuthView = document.getElementById("menu-auth-view");
const menuGuestView = document.getElementById("menu-guest-view");
const menuAvatarLarge = document.getElementById("menu-avatar-large");
const menuUserName = document.getElementById("menu-user-name");
const menuUserEmail = document.getElementById("menu-user-email");
const menuItemProfile = document.getElementById("menu-item-profile");
const menuItemWatchlist = document.getElementById("menu-item-watchlist");
const menuItemTelemetry = document.getElementById("menu-item-telemetry");
const menuItemCopyUid = document.getElementById("menu-item-copy-uid");
const menuItemSignout = document.getElementById("menu-item-signout");
const guestMenuSigninBtn = document.getElementById("guest-menu-signin-btn");
const guestMenuDemoBtn = document.getElementById("guest-menu-demo-btn");
const navNotifBtn = document.getElementById("nav-notif-btn");

// Profile Modal
const profileOverlay = document.getElementById("profile-overlay");
const profileCloseBtn = document.getElementById("profile-close");
const profileAvatar = document.getElementById("profile-avatar");
const profileTitle = document.getElementById("profile-title");
const profileSubtitle = document.getElementById("profile-subtitle");
const profileStatTracked = document.getElementById("profile-stat-tracked");
const profileStatProvider = document.getElementById("profile-stat-provider");
const profileNameInput = document.getElementById("profile-name-input");
const profileEmailInput = document.getElementById("profile-email-input");
const profileUidInput = document.getElementById("profile-uid-input");
const profileCopyUidBtn = document.getElementById("profile-copy-uid-btn");
const profileSaveBtn = document.getElementById("profile-save-btn");
const profileLogoutBtn = document.getElementById("profile-logout-btn");

// Toast Container
const toastContainer = document.getElementById("orbital-toast-container");

const emailStorageKey = "emailForSignIn";
const demoUserStorageKey = "orbital_demo_user";

// Local state
let currentUserData = null;

// ================================================================
// TOAST NOTIFICATIONS
// ================================================================

export function showToast(message, type = "info", duration = 3500) {
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `orbital-toast toast-${type}`;

    let iconSvg = "";
    if (type === "success") {
        iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === "error") {
        iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
        iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
        <div class="orbital-toast-icon">${iconSvg}</div>
        <div class="orbital-toast-text">${message}</div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("hiding");
        setTimeout(() => toast.remove(), 250);
    }, duration);
}

// ================================================================
// AUTH MODAL LOGIC
// ================================================================

export function openAuthModal() {
    if (!authOverlay) return;
    closeProfileMenu();
    authOverlay.classList.add("show");
    authOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

export function closeAuthModal() {
    if (!authOverlay) return;
    authOverlay.classList.remove("show");
    authOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

if (heroTrigger) {
    heroTrigger.addEventListener("click", () => {
        if (currentUserData) {
            openProfileModal();
        } else {
            openAuthModal();
        }
    });
}

if (authCloseBtn) {
    authCloseBtn.addEventListener("click", closeAuthModal);
}

if (signinLink) {
    signinLink.addEventListener("click", () => {
        setStatus("Enter your email address to receive a secure login link.");
        if (emailInput) emailInput.focus();
    });
}

if (authOverlay) {
    authOverlay.addEventListener("click", (event) => {
        if (event.target === authOverlay) closeAuthModal();
    });
}

// ================================================================
// PROFILE MODAL LOGIC
// ================================================================

export function openProfileModal() {
    closeProfileMenu();
    if (!profileOverlay) return;
    populateProfileData(currentUserData);
    profileOverlay.classList.add("show");
    profileOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

export function closeProfileModal() {
    if (!profileOverlay) return;
    profileOverlay.classList.remove("show");
    profileOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

if (profileCloseBtn) {
    profileCloseBtn.addEventListener("click", closeProfileModal);
}

if (profileOverlay) {
    profileOverlay.addEventListener("click", (event) => {
        if (event.target === profileOverlay) closeProfileModal();
    });
}

// Save profile changes
if (profileSaveBtn) {
    profileSaveBtn.addEventListener("click", async () => {
        const newName = profileNameInput ? profileNameInput.value.trim() : "";
        if (!newName) {
            showToast("Please enter a valid display name.", "error");
            return;
        }

        try {
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: newName });
            }

            if (currentUserData) {
                currentUserData.displayName = newName;
                if (currentUserData.isDemo) {
                    localStorage.setItem(demoUserStorageKey, JSON.stringify(currentUserData));
                }
                syncUserUI(currentUserData);
            }

            showToast("Profile display name updated!", "success");
            closeProfileModal();
        } catch (err) {
            console.error("Profile update error:", err);
            showToast("Could not update profile: " + err.message, "error");
        }
    });
}

// Copy UID button inside profile modal
if (profileCopyUidBtn) {
    profileCopyUidBtn.addEventListener("click", () => {
        if (profileUidInput && profileUidInput.value) {
            navigator.clipboard.writeText(profileUidInput.value);
            showToast("UID copied to clipboard!", "success");
        }
    });
}

if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener("click", () => {
        closeProfileModal();
        logoutUser();
    });
}

// ================================================================
// ANIMATE UI MENU LOGIC
// ================================================================

export function openProfileMenu() {
    if (!profileMenu || !navAvatarBtn) return;
    profileMenu.classList.add("open");
    profileMenu.setAttribute("aria-hidden", "false");
    navAvatarBtn.setAttribute("aria-expanded", "true");
}

export function closeProfileMenu() {
    if (!profileMenu || !navAvatarBtn) return;
    profileMenu.classList.remove("open");
    profileMenu.setAttribute("aria-hidden", "true");
    navAvatarBtn.setAttribute("aria-expanded", "false");
}

export function toggleProfileMenu() {
    if (!profileMenu) return;
    const isOpen = profileMenu.classList.contains("open");
    if (isOpen) {
        closeProfileMenu();
    } else {
        openProfileMenu();
    }
}

if (navAvatarBtn) {
    navAvatarBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleProfileMenu();
    });
}

// Close when clicking outside menu
document.addEventListener("click", (e) => {
    if (profileMenuRoot && !profileMenuRoot.contains(e.target)) {
        closeProfileMenu();
    }
});

// Keyboard navigation for Animate UI Menu
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (profileMenu && profileMenu.classList.contains("open")) {
            closeProfileMenu();
            if (navAvatarBtn) navAvatarBtn.focus();
        } else if (authOverlay && authOverlay.classList.contains("show")) {
            closeAuthModal();
        } else if (profileOverlay && profileOverlay.classList.contains("show")) {
            closeProfileModal();
        }
        return;
    }

    // Global Shortcuts
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p" && !event.shiftKey) {
        if (currentUserData) {
            event.preventDefault();
            openProfileModal();
        }
    }

    // Arrow navigation inside opened menu
    if (profileMenu && profileMenu.classList.contains("open")) {
        const activeView = currentUserData ? menuAuthView : menuGuestView;
        if (!activeView) return;
        const menuItems = Array.from(activeView.querySelectorAll(".menu-item:not([disabled])"));
        if (!menuItems.length) return;

        const currentIndex = menuItems.indexOf(document.activeElement);

        if (event.key === "ArrowDown") {
            event.preventDefault();
            const nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
            menuItems[nextIndex].focus();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
            menuItems[prevIndex].focus();
        }
    }
});

// Menu item handlers
if (menuItemProfile) {
    menuItemProfile.addEventListener("click", () => {
        closeProfileMenu();
        openProfileModal();
    });
}

if (menuItemWatchlist) {
    menuItemWatchlist.addEventListener("click", () => {
        closeProfileMenu();
        showToast("Tracking 12 live orbital objects in watchlist.", "info");
        const exploreSection = document.getElementById("explore");
        if (exploreSection) exploreSection.scrollIntoView({ behavior: "smooth" });
    });
}

if (menuItemTelemetry) {
    menuItemTelemetry.addEventListener("click", () => {
        closeProfileMenu();
        showToast("Orbital telemetry link active (120ms latency).", "success");
    });
}

if (menuItemCopyUid) {
    menuItemCopyUid.addEventListener("click", () => {
        if (currentUserData && currentUserData.uid) {
            navigator.clipboard.writeText(currentUserData.uid);
            const copyLabel = document.getElementById("menu-copy-label");
            if (copyLabel) copyLabel.textContent = "Copied!";
            showToast("User UID copied to clipboard!", "success");
            setTimeout(() => {
                if (copyLabel) copyLabel.textContent = "Copy UID";
                closeProfileMenu();
            }, 800);
        }
    });
}

if (menuItemSignout) {
    menuItemSignout.addEventListener("click", () => {
        closeProfileMenu();
        logoutUser();
    });
}

if (guestMenuSigninBtn) {
    guestMenuSigninBtn.addEventListener("click", () => {
        closeProfileMenu();
        openAuthModal();
    });
}

// ================================================================
// NOTIFICATIONS CENTER
// ================================================================

const notifWrapper = document.getElementById("notif-wrapper");
const notifDropdown = document.getElementById("notif-dropdown");
const notifBadge = document.getElementById("notif-badge");
const notifUnreadCount = document.getElementById("notif-unread-count");
const notifMarkReadBtn = document.getElementById("notif-mark-read");
const notifTabs = document.querySelectorAll(".notif-tab");
const notifItems = document.querySelectorAll(".notif-item");

export function toggleNotifDropdown() {
    if (!notifDropdown || !navNotifBtn) return;
    closeProfileMenu();
    const isOpen = notifDropdown.classList.contains("show");
    if (isOpen) {
        closeNotifDropdown();
    } else {
        openNotifDropdown();
    }
}

export function openNotifDropdown() {
    if (!notifDropdown || !navNotifBtn) return;
    notifDropdown.classList.add("show");
    navNotifBtn.setAttribute("aria-expanded", "true");
}

export function closeNotifDropdown() {
    if (!notifDropdown || !navNotifBtn) return;
    notifDropdown.classList.remove("show");
    navNotifBtn.setAttribute("aria-expanded", "false");
}

if (navNotifBtn) {
    navNotifBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleNotifDropdown();
    });
}

// Close notifications when clicking outside
document.addEventListener("click", (e) => {
    if (notifWrapper && !notifWrapper.contains(e.target)) {
        closeNotifDropdown();
    }
});

// Mark all as read
if (notifMarkReadBtn) {
    notifMarkReadBtn.addEventListener("click", () => {
        document.querySelectorAll(".notif-item.unread").forEach((item) => {
            item.classList.remove("unread");
        });
        if (notifBadge) {
            notifBadge.classList.add("hidden");
            notifBadge.textContent = "0";
        }
        if (notifUnreadCount) notifUnreadCount.textContent = "0 unread";
        showToast("All orbital alerts marked as read.", "success");
    });
}

// Notification tabs filter
if (notifTabs.length) {
    notifTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            notifTabs.forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            const filter = tab.dataset.filter;

            document.querySelectorAll(".notif-item").forEach((item) => {
                const category = item.dataset.category;
                if (filter === "all" || category === filter) {
                    item.style.display = "flex";
                } else {
                    item.style.display = "none";
                }
            });
        });
    });
}

// Click alert to view details
if (notifItems.length) {
    notifItems.forEach((item) => {
        item.addEventListener("click", () => {
            item.classList.remove("unread");
            const title = item.querySelector(".notif-title")?.textContent || "Alert";
            const desc = item.querySelector(".notif-desc")?.textContent || "Orbital event logged.";
            showToast(`${title}: ${desc}`, "info", 5000);
            closeNotifDropdown();
        });
    });
}

// ================================================================
// PROFILE AVATAR UPLOAD HANDLER
// ================================================================

const profileAvatarUpload = document.getElementById("profile-avatar-upload");
const profileAvatarWrap = document.getElementById("profile-avatar-wrap");
const avatarUploadTriggerBtn = document.getElementById("avatar-upload-trigger-btn");

if (profileAvatarWrap && profileAvatarUpload) {
    profileAvatarWrap.addEventListener("click", () => {
        profileAvatarUpload.click();
    });
}

if (avatarUploadTriggerBtn && profileAvatarUpload) {
    avatarUploadTriggerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        profileAvatarUpload.click();
    });
}

if (profileAvatarUpload) {
    profileAvatarUpload.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            showToast("Please choose a valid image file (PNG, JPG, WebP).", "error");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast("Image file size exceeds 5MB limit.", "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target.result;

            if (!currentUserData) {
                currentUserData = {
                    uid: "orb_cosmix_user",
                    displayName: "Explorer",
                    email: "explorer@orbital.cosmix",
                    provider: "Custom Avatar",
                    isDemo: true
                };
            }

            currentUserData.photoURL = dataUrl;
            localStorage.setItem("orbital_custom_avatar", dataUrl);

            if (currentUserData.isDemo) {
                localStorage.setItem(demoUserStorageKey, JSON.stringify(currentUserData));
            }

            if (auth.currentUser) {
                try {
                    await updateProfile(auth.currentUser, { photoURL: dataUrl });
                } catch (err) {
                    console.warn("Could not sync photo to Firebase:", err);
                }
            }

            syncUserUI(currentUserData);
            populateProfileData(currentUserData);
            showToast("Profile avatar uploaded and updated!", "success");
        };
        reader.readAsDataURL(file);
    });
}

// ================================================================
// USER & AVATAR UI SYNCHRONIZATION
// ================================================================

function getInitials(name, email) {
    if (name && name.trim()) {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0].slice(0, 2).toUpperCase();
    }
    if (email) {
        return email.slice(0, 2).toUpperCase();
    }
    return "OR";
}

function renderAvatar(container, user) {
    if (!container) return;
    if (user && user.photoURL) {
        container.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName || 'Avatar'}" onerror="this.onerror=null; this.parentElement.textContent='${getInitials(user.displayName, user.email)}';" />`;
    } else if (user) {
        container.textContent = getInitials(user.displayName, user.email);
    } else {
        container.textContent = "?";
    }
}

function syncUserUI(user) {
    currentUserData = user;

    if (user) {
        // Authenticated Navbar
        renderAvatar(navAvatar, user);
        if (presenceIndicator) presenceIndicator.classList.add("active");

        // Menu views
        if (menuAuthView) menuAuthView.style.display = "block";
        if (menuGuestView) menuGuestView.style.display = "none";

        renderAvatar(menuAvatarLarge, user);
        if (menuUserName) menuUserName.textContent = user.displayName || user.email?.split("@")[0] || "Explorer";
        if (menuUserEmail) menuUserEmail.textContent = user.email || "orbital-session@cosmix.space";

        if (heroTrigger) {
            heroTrigger.innerHTML = `
                Profile & Satellites
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14" /><path d="M13 5l7 7-7 7" />
                </svg>
            `;
        }
    } else {
        // Guest State
        renderAvatar(navAvatar, null);
        if (presenceIndicator) presenceIndicator.classList.remove("active");

        if (menuAuthView) menuAuthView.style.display = "none";
        if (menuGuestView) menuGuestView.style.display = "block";

        if (heroTrigger) {
            heroTrigger.innerHTML = `
                Get Started
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14" /><path d="M13 5l7 7-7 7" />
                </svg>
            `;
        }
    }
}

function populateProfileData(user) {
    if (!user) {
        user = {
            displayName: "Guest Explorer",
            email: "Not signed in",
            uid: "guest-unauthenticated",
            provider: "None"
        };
    }

    renderAvatar(profileAvatar, user);

    if (profileTitle) profileTitle.textContent = user.displayName || "Cosmic Explorer";
    if (profileSubtitle) profileSubtitle.textContent = user.email || "Active Orbital Node";
    if (profileStatProvider) profileStatProvider.textContent = user.provider || (user.isDemo ? "Demo" : "Firebase");
    if (profileStatTracked) profileStatTracked.textContent = "12 Sats";

    if (profileNameInput) profileNameInput.value = user.displayName || "";
    if (profileEmailInput) profileEmailInput.value = user.email || "";
    if (profileUidInput) profileUidInput.value = user.uid || "";
}

// ================================================================
// DEMO ACCOUNT HANDLER (Instant testing without popup blockers)
// ================================================================

function activateDemoAccount() {
    const demoUser = {
        uid: "orb_cosmix_" + Math.random().toString(36).substring(2, 9),
        displayName: "Commander Isham",
        email: "isham.babu@orbital.cosmix",
        photoURL: "../assets/images/isham.png",
        provider: "Demo Uplink",
        isDemo: true
    };

    localStorage.setItem(demoUserStorageKey, JSON.stringify(demoUser));
    syncUserUI(demoUser);
    closeAuthModal();
    showToast(`Welcome back, ${demoUser.displayName}!`, "success");
}

if (demoAuthBtn) {
    demoAuthBtn.addEventListener("click", activateDemoAccount);
}

// ================================================================
// AUTH HELPERS & PROVIDER LOGIN
// ================================================================

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

function setStatus(message, type = "info") {
    if (!authStatus) return;
    authStatus.textContent = message;
    authStatus.dataset.type = type;
}

function setButtonLoading(button, isLoading, loadingText) {
    if (!button) return;
    if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
    }
    button.disabled = isLoading;
    button.innerHTML = isLoading ? loadingText : button.dataset.originalHtml;
}

function describeAuthError(error) {
    if (error.code === "auth/popup-closed-by-user") {
        return "The sign-in popup was closed before completion.";
    }
    if (error.code === "auth/unauthorized-domain") {
        return "This domain is not authorized in Firebase settings. Use Demo Profile or configure Firebase console.";
    }
    if (error.code === "auth/popup-blocked") {
        return "The popup was blocked by your browser. Please allow popups or use Instant Demo Profile.";
    }
    return error.message || "Authentication failed.";
}

async function signInWithProvider(provider, providerLabel, button) {
    try {
        setButtonLoading(button, true, `Connecting to ${providerLabel}...`);
        setStatus(`Opening ${providerLabel} sign-in...`, "info");

        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        localStorage.removeItem(demoUserStorageKey);

        const userData = {
            uid: user.uid,
            displayName: user.displayName || user.email?.split("@")[0],
            email: user.email,
            photoURL: user.photoURL,
            provider: providerLabel
        };

        syncUserUI(userData);
        closeAuthModal();
        showToast(`Welcome back, ${userData.displayName}!`, "success");
    } catch (error) {
        console.error(`${providerLabel} login error:`, error);
        setStatus(`${providerLabel} sign-in failed: ${describeAuthError(error)}`, "error");
        showToast(`${providerLabel} sign-in failed`, "error");
    } finally {
        setButtonLoading(button, false);
    }
}

if (googleBtn) {
    googleBtn.addEventListener("click", () => signInWithProvider(googleProvider, "Google", googleBtn));
}

if (githubBtn) {
    githubBtn.addEventListener("click", () => signInWithProvider(githubProvider, "GitHub", githubBtn));
}

// ================================================================
// EMAIL LINK AUTH
// ================================================================

function getActionCodeSettings() {
    return {
        url: `${window.location.origin}${window.location.pathname}`,
        handleCodeInApp: true
    };
}

async function completeEmailLinkSignIn() {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    openAuthModal();
    let email = window.localStorage.getItem(emailStorageKey);
    if (!email) {
        email = window.prompt("Please confirm your email address to complete sign-in:");
    }

    if (!email) {
        setStatus("Email sign-in could not finish without your email address.", "error");
        return;
    }

    try {
        setStatus("Completing secure email sign-in...", "info");
        const result = await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem(emailStorageKey);
        window.history.replaceState({}, document.title, window.location.pathname);

        const userData = {
            uid: result.user.uid,
            displayName: result.user.displayName || email.split("@")[0],
            email: result.user.email,
            photoURL: result.user.photoURL,
            provider: "Email Link"
        };

        syncUserUI(userData);
        closeAuthModal();
        showToast(`Welcome, ${userData.displayName}!`, "success");
    } catch (error) {
        console.error("Email link error:", error);
        setStatus(`Email sign-in failed: ${describeAuthError(error)}`, "error");
    }
}

completeEmailLinkSignIn();

if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!emailInput || !emailInput.value) {
            setStatus("Enter your email address to continue.", "error");
            return;
        }

        const email = emailInput.value.trim();
        try {
            setButtonLoading(submitBtn, true, "Sending login link...");
            await sendSignInLinkToEmail(auth, email, getActionCodeSettings());
            window.localStorage.setItem(emailStorageKey, email);
            setStatus("Check your inbox! We've sent your sign-in link.", "success");
            showToast("Login link sent to your email.", "info");
        } catch (error) {
            console.error("Send link error:", error);
            setStatus(`Could not send link: ${describeAuthError(error)}`, "error");
        } finally {
            setButtonLoading(submitBtn, false);
        }
    });
}

// ================================================================
// FIREBASE AUTH STATE LISTENER
// ================================================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        const userData = {
            uid: user.uid,
            displayName: user.displayName || user.email?.split("@")[0] || "Explorer",
            email: user.email,
            photoURL: user.photoURL,
            provider: user.providerData?.[0]?.providerId || "Firebase"
        };
        syncUserUI(userData);
    } else {
        const storedDemo = localStorage.getItem(demoUserStorageKey);
        if (storedDemo) {
            try {
                const parsedDemo = JSON.parse(storedDemo);
                syncUserUI(parsedDemo);
                return;
            } catch {
                localStorage.removeItem(demoUserStorageKey);
            }
        }
        syncUserUI(null);
    }
});

// ================================================================
// SIGN OUT
// ================================================================

export async function logoutUser() {
    try {
        localStorage.removeItem(demoUserStorageKey);
        await signOut(auth);
        syncUserUI(null);
        showToast("Signed out successfully.", "info");
    } catch (error) {
        console.error("Logout failed:", error);
        syncUserUI(null);
        showToast("Session ended.", "info");
    }
}

