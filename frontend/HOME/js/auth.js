/**
 * ORBITAL — HOME AUTHENTICATION & OPERATOR PROFILE CONTROLLER
 * Full Firebase Auth Integration & Modern SaaS User Experience:
 * - Google & GitHub OAuth Popups
 * - Email + Password Authentication & Registration
 * - Passwordless Magic Link Sign-In
 * - Password Reset Flow
 * - Interactive Profile Menu Popover & Avatar Photo Upload
 * - Edit Profile Modal (Name, Username, Role, Photo Preview)
 * - Ground Station Tracking Location Modal (Presets + GPS Auto-detection)
 * - Orbital Preferences & Settings Modal
 * - Real-time Session & Cross-Tab Synchronization
 */

import {
    createUserWithEmailAndPassword,
    GithubAuthProvider,
    GoogleAuthProvider,
    isSignInWithEmailLink,
    onAuthStateChanged,
    sendPasswordResetEmail,
    sendSignInLinkToEmail,
    signInWithEmailAndPassword,
    signInWithEmailLink,
    signInWithPopup,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { auth } from "./firebase-config.js";

// -----------------------------------------------------------------------------
// DOM ELEMENTS & CONSTANTS
// -----------------------------------------------------------------------------

// Storage Keys
const EMAIL_STORAGE_KEY = "cosmix_email_for_signin";
const USER_STORAGE_KEY = "cosmix_user";
const GROUND_STATION_KEY = "cosmix_ground_station";
const SETTINGS_KEY = "cosmix_settings";
const AUTH_RETURN_KEY = "cosmix_auth_return_to";

// Providers
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

// Current User State
let currentUser = null;

// Auth Modal Elements
const authOverlay = document.getElementById("auth-overlay");
const authCloseBtn = document.getElementById("auth-close");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const authStatus = document.getElementById("auth-status");
const tabBtnSignin = document.getElementById("tab-btn-signin");
const tabBtnSignup = document.getElementById("tab-btn-signup");

// Auth Views
const viewSignin = document.getElementById("auth-view-signin");
const viewSignup = document.getElementById("auth-view-signup");
const viewForgot = document.getElementById("auth-view-forgot");
const viewMagic = document.getElementById("auth-view-magic");

// Sign In Form Elements
const signinForm = document.getElementById("signin-form");
const signinEmail = document.getElementById("signin-email");
const signinPassword = document.getElementById("signin-password");
const signinPwToggle = document.getElementById("signin-pw-toggle");
const signinSubmitBtn = document.getElementById("signin-submit-btn");
const googleAuthBtn = document.getElementById("google-auth-btn");
const githubAuthBtn = document.getElementById("github-auth-btn");
const btnToForgotPw = document.getElementById("btn-to-forgot-pw");
const btnToMagicLink = document.getElementById("btn-to-magic-link");

// Sign Up Form Elements
const signupForm = document.getElementById("signup-form");
const signupFullName = document.getElementById("signup-fullname");
const signupUsername = document.getElementById("signup-username");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");
const signupPwToggle = document.getElementById("signup-pw-toggle");
const pwBar = document.getElementById("pw-bar");
const pwStrengthText = document.getElementById("pw-strength-text");
const signupRole = document.getElementById("signup-role");
const signupAgree = document.getElementById("signup-agree");
const signupSubmitBtn = document.getElementById("signup-submit-btn");
const googleSignupBtn = document.getElementById("google-signup-btn");
const githubSignupBtn = document.getElementById("github-signup-btn");

// Forgot Password Form Elements
const forgotForm = document.getElementById("forgot-form");
const forgotEmail = document.getElementById("forgot-email");
const forgotSubmitBtn = document.getElementById("forgot-submit-btn");
const btnBackToSigninFromForgot = document.getElementById("btn-back-to-signin-from-forgot");

// Magic Link Form Elements
const magicForm = document.getElementById("magic-form");
const magicEmail = document.getElementById("magic-email");
const magicSubmitBtn = document.getElementById("magic-submit-btn");
const btnBackToSigninFromMagic = document.getElementById("btn-back-to-signin-from-magic");

// Navbar & Header Triggers
const navAvatar = document.getElementById("nav-avatar");
const userProfileDropdown = document.getElementById("user-profile-dropdown");
const heroSignupTrigger = document.getElementById("hero-signup-trigger");

// Profile Popover Header Elements
const profileFlyoutAvatarWrapper = document.getElementById("profile-flyout-avatar-wrapper");
const profileFlyoutAvatar = document.getElementById("profile-flyout-avatar");
const profileFlyoutName = document.getElementById("profile-flyout-name");
const profileFlyoutEmail = document.getElementById("profile-flyout-email");
const profileFlyoutRole = document.getElementById("profile-flyout-role");
const menuLocationBadge = document.getElementById("menu-location-badge");
const navSignoutBtn = document.getElementById("nav-signout-btn");

// Profile Popover Menu Buttons
const menuBtnEditProfile = document.getElementById("menu-btn-edit-profile");
const menuBtnTrackingLocation = document.getElementById("menu-btn-tracking-location");
const menuBtnSettings = document.getElementById("menu-btn-settings");

// Hidden File Input for Avatar Upload
const avatarFileInput = document.getElementById("avatar-file-input");

// Edit Profile Modal Elements
const editProfileModal = document.getElementById("edit-profile-modal");
const editProfileClose = document.getElementById("edit-profile-close");
const editProfileCancel = document.getElementById("edit-profile-cancel");
const editProfileForm = document.getElementById("edit-profile-form");
const editAvatarPreviewWrapper = document.getElementById("edit-avatar-preview-wrapper");
const editAvatarPreview = document.getElementById("edit-avatar-preview");
const btnTriggerAvatarUpload = document.getElementById("btn-trigger-avatar-upload");
const editFullname = document.getElementById("edit-fullname");
const editUsername = document.getElementById("edit-username");
const editEmail = document.getElementById("edit-email");
const editRole = document.getElementById("edit-role");
const editProfileSave = document.getElementById("edit-profile-save");

// Tracking Location Modal Elements
const trackingLocationModal = document.getElementById("tracking-location-modal");
const trackingLocationClose = document.getElementById("tracking-location-close");
const trackingLocationCancel = document.getElementById("tracking-location-cancel");
const trackingLocationForm = document.getElementById("tracking-location-form");
const clcStationName = document.getElementById("clc-station-name");
const clcCoordsDisplay = document.getElementById("clc-coords-display");
const btnGpsDetect = document.getElementById("btn-gps-detect");
const gpsBtnText = document.getElementById("gps-btn-text");
const stationPresetSelect = document.getElementById("station-preset-select");
const stationNameInput = document.getElementById("station-name-input");
const stationLatInput = document.getElementById("station-lat-input");
const stationLonInput = document.getElementById("station-lon-input");
const trackingLocationSave = document.getElementById("tracking-location-save");

// Settings Modal Elements
const settingsModal = document.getElementById("settings-modal");
const settingsModalClose = document.getElementById("settings-modal-close");
const settingsCancel = document.getElementById("settings-cancel");
const settingsForm = document.getElementById("settings-form");
const settingTelemetryRate = document.getElementById("setting-telemetry-rate");
const settingDistanceUnits = document.getElementById("setting-distance-units");
const settingConjunctionThreshold = document.getElementById("setting-conjunction-threshold");

// Ground Station Preset Data
const GROUND_STATION_PRESETS = {
    "cape-canaveral": { name: "Cape Canaveral, USA", lat: 28.3922, lon: -80.6077, alt: 3 },
    "kourou": { name: "Kourou Space Centre, French Guiana", lat: 5.2372, lon: -52.7606, alt: 15 },
    "sriharikota": { name: "Satish Dhawan Space Centre, India", lat: 13.7200, lon: 80.2300, alt: 6 },
    "svalbard": { name: "Svalbard Satellite Station, Norway", lat: 78.2297, lon: 15.4077, alt: 450 },
    "tanegashima": { name: "Tanegashima Space Center, Japan", lat: 30.4000, lon: 130.9700, alt: 60 },
    "woomera": { name: "Woomera Range Complex, Australia", lat: -31.1990, lon: 136.8250, alt: 145 },
    "london": { name: "London / Greenwich Observatory, UK", lat: 51.4769, lon: -0.0005, alt: 48 }
};

// -----------------------------------------------------------------------------
// TOAST NOTIFICATIONS
// -----------------------------------------------------------------------------

export function showToast(message, type = "info") {
    let toast = document.getElementById("cosmix-global-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "cosmix-global-toast";
        toast.className = "cosmix-toast";
        document.body.appendChild(toast);
    }

    const iconSvg = type === "success"
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4fd1a5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
        : type === "error"
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff7878" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8fb4ff" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

    toast.className = `cosmix-toast ${type} show`;
    toast.innerHTML = `${iconSvg}<span>${message}</span>`;

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 4000);
}
window.showToast = showToast;

// -----------------------------------------------------------------------------
// AUTH MODAL & VIEW SWITCHING
// -----------------------------------------------------------------------------

function clearStatus() {
    if (!authStatus) return;
    authStatus.textContent = "";
    authStatus.className = "auth-status";
    authStatus.style.display = "none";
}

export function setStatus(message, type = "info") {
    if (!authStatus) return;
    authStatus.textContent = message;
    authStatus.className = `auth-status ${type}`;
    authStatus.style.display = "block";
}

export function switchAuthView(viewName) {
    clearStatus();

    [viewSignin, viewSignup, viewForgot, viewMagic].forEach(v => {
        if (v) v.classList.remove("active");
    });

    if (tabBtnSignin) tabBtnSignin.classList.remove("active");
    if (tabBtnSignup) tabBtnSignup.classList.remove("active");

    const tabsContainer = document.getElementById("auth-tabs");

    if (viewName === "signin") {
        if (viewSignin) viewSignin.classList.add("active");
        if (tabBtnSignin) tabBtnSignin.classList.add("active");
        if (tabsContainer) tabsContainer.style.display = "flex";
        if (authTitle) authTitle.textContent = "Welcome to Orbital";
        if (authSubtitle) authSubtitle.textContent = "Sign in to access live tracking and saved satellite watchlists.";
        if (signinEmail) signinEmail.focus();
    } else if (viewName === "signup") {
        if (viewSignup) viewSignup.classList.add("active");
        if (tabBtnSignup) tabBtnSignup.classList.add("active");
        if (tabsContainer) tabsContainer.style.display = "flex";
        if (authTitle) authTitle.textContent = "Create Operator Account";
        if (authSubtitle) authSubtitle.textContent = "Join ORBITAL to monitor space debris and configure custom alerts.";
        if (signupFullName) signupFullName.focus();
    } else if (viewName === "forgot") {
        if (viewForgot) viewForgot.classList.add("active");
        if (tabsContainer) tabsContainer.style.display = "none";
        if (authTitle) authTitle.textContent = "Reset Your Password";
        if (authSubtitle) authSubtitle.textContent = "We will send secure recovery instructions to your email address.";
        if (forgotEmail) {
            forgotEmail.value = (signinEmail && signinEmail.value) ? signinEmail.value : "";
            forgotEmail.focus();
        }
    } else if (viewName === "magic") {
        if (viewMagic) viewMagic.classList.add("active");
        if (tabsContainer) tabsContainer.style.display = "none";
        if (authTitle) authTitle.textContent = "Passwordless Sign-In";
        if (authSubtitle) authSubtitle.textContent = "Receive an instant, password-free login link in your inbox.";
        if (magicEmail) {
            magicEmail.value = (signinEmail && signinEmail.value) ? signinEmail.value : "";
            magicEmail.focus();
        }
    }
}

export function openAuthModal(defaultTab = "signin") {
    closeProfileFlyout();
    closeAllModals();
    if (!authOverlay) return;
    switchAuthView(defaultTab);
    authOverlay.classList.add("open", "show");
    authOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}
window.openAuthModal = openAuthModal;

export function closeAuthModal() {
    if (!authOverlay) return;
    authOverlay.classList.remove("open", "show");
    authOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    clearStatus();
}
window.closeAuthModal = closeAuthModal;

function getProtectedReturnPath() {
    try {
        const returnTo = sessionStorage.getItem(AUTH_RETURN_KEY);
        if (returnTo && /\/(Explore|MONITOR|Analytics)\//i.test(returnTo)) {
            return returnTo;
        }
    } catch (e) {}
    return "";
}

function finishAuthenticatedSession(user, message) {
    updateOperatorUI(user);

    const returnTo = getProtectedReturnPath();
    if (returnTo) {
        try {
            sessionStorage.removeItem(AUTH_RETURN_KEY);
        } catch (e) {}
        window.location.href = returnTo;
        return;
    }

    closeAuthModal();
    showToast(message, "success");
}

function isProtectedDestination(url) {
    try {
        const target = new URL(url, window.location.href);
        return /\/(Explore|MONITOR|Analytics)\//i.test(target.pathname);
    } catch (e) {
        return false;
    }
}

function requireAuthForProtectedLinks() {
    document.addEventListener("click", (event) => {
        const link = event.target.closest("a[href]");
        if (!link || !isProtectedDestination(link.href) || currentUser) return;

        event.preventDefault();
        try {
            const target = new URL(link.href, window.location.href);
            sessionStorage.setItem(AUTH_RETURN_KEY, `${target.pathname}${target.search}${target.hash}`);
        } catch (e) {}

        openAuthModal("signin");
        setStatus("Please sign in to access live orbital data.", "info");
    });
}

function openAuthFromRedirect() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") !== "required") return;

    openAuthModal("signin");
    setStatus("Please sign in to access live orbital data.", "info");

    try {
        const cleanUrl = `${window.location.pathname}${window.location.hash}`;
        window.history.replaceState({}, document.title, cleanUrl);
    } catch (e) {}
}

if (authCloseBtn) authCloseBtn.addEventListener("click", closeAuthModal);
if (tabBtnSignin) tabBtnSignin.addEventListener("click", () => switchAuthView("signin"));
if (tabBtnSignup) tabBtnSignup.addEventListener("click", () => switchAuthView("signup"));
if (btnToForgotPw) btnToForgotPw.addEventListener("click", () => switchAuthView("forgot"));
if (btnToMagicLink) btnToMagicLink.addEventListener("click", () => switchAuthView("magic"));
if (btnBackToSigninFromForgot) btnBackToSigninFromForgot.addEventListener("click", () => switchAuthView("signin"));
if (btnBackToSigninFromMagic) btnBackToSigninFromMagic.addEventListener("click", () => switchAuthView("signin"));

// -----------------------------------------------------------------------------
// PASSWORD TOGGLES & STRENGTH METER
// -----------------------------------------------------------------------------

function setupPasswordToggle(inputEl, toggleBtn) {
    if (!inputEl || !toggleBtn) return;
    toggleBtn.addEventListener("click", () => {
        const isPw = inputEl.getAttribute("type") === "password";
        inputEl.setAttribute("type", isPw ? "text" : "password");
        const eyeIcon = toggleBtn.querySelector(".icon-eye");
        const eyeOffIcon = toggleBtn.querySelector(".icon-eye-off");
        if (eyeIcon && eyeOffIcon) {
            eyeIcon.style.display = isPw ? "none" : "block";
            eyeOffIcon.style.display = isPw ? "block" : "none";
        }
    });
}

setupPasswordToggle(signinPassword, signinPwToggle);
setupPasswordToggle(signupPassword, signupPwToggle);

if (signupPassword && pwBar && pwStrengthText) {
    signupPassword.addEventListener("input", () => {
        const val = signupPassword.value;
        if (!val) {
            pwBar.className = "pw-bar";
            pwStrengthText.textContent = "Password strength";
            return;
        }

        let score = 0;
        if (val.length >= 6) score++;
        if (val.length >= 10) score++;
        if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        if (score <= 1) {
            pwBar.className = "pw-bar weak";
            pwStrengthText.textContent = "Weak password";
            pwStrengthText.style.color = "var(--risk)";
        } else if (score === 2 || score === 3) {
            pwBar.className = "pw-bar fair";
            pwStrengthText.textContent = "Fair password";
            pwStrengthText.style.color = "#e8b657";
        } else {
            pwBar.className = "pw-bar strong";
            pwStrengthText.textContent = "Strong password";
            pwStrengthText.style.color = "var(--safe)";
        }
    });
}

// -----------------------------------------------------------------------------
// BUTTON LOADING HELPER
// -----------------------------------------------------------------------------

function setButtonLoading(button, isLoading, loadingText = "Processing...") {
    if (!button) return;
    if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
    }
    button.disabled = isLoading;
    if (isLoading) {
        button.innerHTML = `
            <svg class="spinner" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite;margin-right:6px;">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
            </svg>
            <span>${loadingText}</span>
        `;
    } else {
        button.innerHTML = button.dataset.originalHtml;
    }
}

// -----------------------------------------------------------------------------
// ERROR TRANSLATOR
// -----------------------------------------------------------------------------

function describeAuthError(error) {
    if (!error) return "An unexpected error occurred.";
    const code = error.code || "";

    switch (code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
            return "Invalid email or password. Please verify credentials.";
        case "auth/user-not-found":
            return "No account exists with this email address.";
        case "auth/email-already-in-use":
            return "An account with this email already exists. Please sign in.";
        case "auth/weak-password":
            return "Password is too weak. Please use at least 6 characters.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/popup-closed-by-user":
            return "Authentication popup was closed before completing.";
        case "auth/popup-blocked":
            return "Browser blocked the popup window. Please allow popups.";
        case "auth/unauthorized-domain":
            return "Domain not authorized in Firebase settings.";
        case "auth/too-many-requests":
            return "Access temporarily throttled. Please try again later.";
        case "auth/network-request-failed":
            return "Network error. Please check your internet connection.";
        default:
            return error.message || "Authentication failed. Please try again.";
    }
}

// -----------------------------------------------------------------------------
// OPERATOR PROFILE DROPDOWN & UI STATE
// -----------------------------------------------------------------------------

function getInitials(name, email) {
    if (name && name.trim()) {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }
    if (email) {
        return email.slice(0, 2).toUpperCase();
    }
    return "OP";
}

export function updateOperatorUI(user) {
    currentUser = user;

    if (user) {
        const displayName = user.displayName || user.username || user.email?.split("@")[0] || "Orbital Operator";
        const email = user.email || "operator@orbital.space";
        const initials = getInitials(displayName, email);
        const photo = user.photoURL;
        const role = user.role || "Verified Operator";

        // Nav Avatar
        if (navAvatar) {
            navAvatar.classList.add("logged-in");
            navAvatar.setAttribute("title", `${displayName} (${email})`);
            if (photo) {
                navAvatar.innerHTML = `<img src="${photo}" alt="${displayName}" onerror="this.parentElement.textContent='${initials}'">`;
            } else {
                navAvatar.textContent = initials;
            }
        }

        // Profile Flyout Header
        if (profileFlyoutAvatar) {
            if (photo) {
                profileFlyoutAvatar.innerHTML = `<img src="${photo}" alt="${displayName}" onerror="this.parentElement.textContent='${initials}'">`;
            } else {
                profileFlyoutAvatar.textContent = initials;
            }
        }
        if (profileFlyoutName) profileFlyoutName.textContent = displayName;
        if (profileFlyoutEmail) profileFlyoutEmail.textContent = email;
        if (profileFlyoutRole) {
            profileFlyoutRole.textContent = role.startsWith("✦") ? role : `✦ ${role}`;
        }

        // Edit Profile Modal Avatar Preview
        if (editAvatarPreview) {
            if (photo) {
                editAvatarPreview.innerHTML = `<img src="${photo}" alt="${displayName}" onerror="this.parentElement.textContent='${initials}'">`;
            } else {
                editAvatarPreview.textContent = initials;
            }
        }

        // Hero CTA button adjustment
        if (heroSignupTrigger) {
            heroSignupTrigger.setAttribute("data-authenticated", "true");
            heroSignupTrigger.innerHTML = `
                Launch Explorer
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14" />
                    <path d="M13 5l7 7-7 7" />
                </svg>
            `;
        }

        // Persist session in localStorage for cross-page sync
        const sessionData = {
            uid: user.uid,
            displayName: displayName,
            username: user.username || displayName.toLowerCase().replace(/\s+/g, ""),
            email: email,
            photoURL: photo || "",
            role: role,
            savedAt: Date.now()
        };
        try {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(sessionData));
        } catch (e) {}

    } else {
        // Logged out
        if (navAvatar) {
            navAvatar.classList.remove("logged-in");
            navAvatar.textContent = "?";
            navAvatar.setAttribute("title", "Sign in to Orbital");
        }
        if (heroSignupTrigger) {
            heroSignupTrigger.removeAttribute("data-authenticated");
            heroSignupTrigger.innerHTML = `
                Get Started
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14" />
                    <path d="M13 5l7 7-7 7" />
                </svg>
            `;
        }
        try {
            localStorage.removeItem(USER_STORAGE_KEY);
        } catch (e) {}
    }

    // Broadcast auth change event to any listening components
    window.dispatchEvent(new CustomEvent("cosmix:auth-changed", { detail: { user: currentUser } }));
}

// -----------------------------------------------------------------------------
// PROFILE FLYOUT OPEN / CLOSE
// -----------------------------------------------------------------------------

export function toggleProfileFlyout() {
    if (!userProfileDropdown) return;
    const isOpen = userProfileDropdown.classList.toggle("open");
    userProfileDropdown.setAttribute("aria-hidden", isOpen ? "false" : "true");
    if (navAvatar) navAvatar.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

export function closeProfileFlyout() {
    if (!userProfileDropdown) return;
    userProfileDropdown.classList.remove("open");
    userProfileDropdown.setAttribute("aria-hidden", "true");
    if (navAvatar) navAvatar.setAttribute("aria-expanded", "false");
}

if (navAvatar) {
    navAvatar.addEventListener("click", (e) => {
        e.stopPropagation();
        if (currentUser) {
            toggleProfileFlyout();
        } else {
            openAuthModal("signin");
        }
    });
}

if (userProfileDropdown) {
    userProfileDropdown.addEventListener("click", (e) => {
        e.stopPropagation();
    });
}

// Hero Button Trigger
if (heroSignupTrigger) {
    heroSignupTrigger.addEventListener("click", () => {
        if (currentUser) {
            window.location.href = "../Explore/explore.html";
        } else {
            openAuthModal("signup");
        }
    });
}

// -----------------------------------------------------------------------------
// INTERACTIVE PROFILE PICTURE UPLOAD
// -----------------------------------------------------------------------------

function triggerPhotoUpload() {
    if (avatarFileInput) {
        avatarFileInput.click();
    }
}

if (profileFlyoutAvatarWrapper) {
    profileFlyoutAvatarWrapper.addEventListener("click", triggerPhotoUpload);
    profileFlyoutAvatarWrapper.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerPhotoUpload();
        }
    });
}

if (editAvatarPreviewWrapper) {
    editAvatarPreviewWrapper.addEventListener("click", triggerPhotoUpload);
    editAvatarPreviewWrapper.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerPhotoUpload();
        }
    });
}

if (btnTriggerAvatarUpload) {
    btnTriggerAvatarUpload.addEventListener("click", triggerPhotoUpload);
}

if (avatarFileInput) {
    avatarFileInput.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        // Validation: Allowed Image MIME types
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
            showToast("Invalid file format. Please upload a JPG, PNG, WEBP, or GIF image.", "error");
            avatarFileInput.value = "";
            return;
        }

        // Validation: File size limit (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            showToast("Image exceeds 5MB size limit. Please select a smaller photo.", "error");
            avatarFileInput.value = "";
            return;
        }

        try {
            showToast("Processing profile photo...", "info");

            const reader = new FileReader();
            reader.onload = async (event) => {
                const dataUrl = event.target.result;

                // Update current user photo URL in Firebase Auth if available
                if (auth.currentUser) {
                    try {
                        await updateProfile(auth.currentUser, { photoURL: dataUrl });
                    } catch (err) {
                        console.warn("Could not save photo to Firebase profile:", err);
                    }
                }

                // Update local user state
                if (currentUser) {
                    currentUser.photoURL = dataUrl;
                    updateOperatorUI(currentUser);
                } else {
                    const fallbackUser = {
                        uid: auth.currentUser?.uid || "local_op",
                        displayName: "Orbital Operator",
                        email: "operator@orbital.space",
                        photoURL: dataUrl,
                        role: "Verified Operator"
                    };
                    updateOperatorUI(fallbackUser);
                }

                showToast("Profile picture updated successfully!", "success");
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error("Avatar upload error:", err);
            showToast("Failed to update profile picture.", "error");
        } finally {
            avatarFileInput.value = "";
        }
    });
}

// -----------------------------------------------------------------------------
// MODAL MANAGEMENT (Universal Close, Escape & Click-Outside)
// -----------------------------------------------------------------------------

export function closeAllModals() {
    [authOverlay, editProfileModal, trackingLocationModal, settingsModal].forEach(modal => {
        if (modal) {
            modal.classList.remove("open", "show");
            modal.setAttribute("aria-hidden", "true");
        }
    });
    document.body.style.overflow = "";
    clearStatus();
}

[authOverlay, editProfileModal, trackingLocationModal, settingsModal].forEach(modal => {
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    }
});

document.addEventListener("click", () => {
    closeProfileFlyout();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeProfileFlyout();
        closeAllModals();
    }
});

// -----------------------------------------------------------------------------
// EDIT PROFILE MODAL LOGIC
// -----------------------------------------------------------------------------

function openEditProfileModal() {
    closeProfileFlyout();
    if (!editProfileModal) return;

    // Populate existing values
    if (currentUser) {
        if (editFullname) editFullname.value = currentUser.displayName || "";
        if (editUsername) editUsername.value = currentUser.username || (currentUser.displayName || "").toLowerCase().replace(/\s+/g, "");
        if (editEmail) editEmail.value = currentUser.email || "";
        if (editRole) {
            const cleanRole = (currentUser.role || "Orbital Analyst").replace("✦ ", "");
            editRole.value = cleanRole;
        }
        if (editAvatarPreview) {
            const initials = getInitials(currentUser.displayName, currentUser.email);
            if (currentUser.photoURL) {
                editAvatarPreview.innerHTML = `<img src="${currentUser.photoURL}" alt="${currentUser.displayName}" onerror="this.parentElement.textContent='${initials}'">`;
            } else {
                editAvatarPreview.textContent = initials;
            }
        }
    }

    editProfileModal.classList.add("open", "show");
    editProfileModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (editFullname) editFullname.focus();
}

if (menuBtnEditProfile) menuBtnEditProfile.addEventListener("click", openEditProfileModal);
if (editProfileClose) editProfileClose.addEventListener("click", closeAllModals);
if (editProfileCancel) editProfileCancel.addEventListener("click", closeAllModals);

if (editProfileForm) {
    editProfileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fullName = editFullname?.value.trim();
        const username = editUsername?.value.trim();
        const role = editRole?.value || "Orbital Analyst";

        if (!fullName) {
            showToast("Please enter your full name.", "error");
            return;
        }
        if (!username || username.length < 3) {
            showToast("Username must be at least 3 characters.", "error");
            return;
        }

        try {
            setButtonLoading(editProfileSave, true, "Saving...");

            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: fullName });
            }

            if (currentUser) {
                currentUser.displayName = fullName;
                currentUser.username = username;
                currentUser.role = role;
                updateOperatorUI(currentUser);
            }

            closeAllModals();
            showToast("Profile credentials updated successfully!", "success");
        } catch (err) {
            console.error("Profile update error:", err);
            showToast("Failed to update profile details.", "error");
        } finally {
            setButtonLoading(editProfileSave, false);
        }
    });
}

// -----------------------------------------------------------------------------
// SATELLITE TRACKING LOCATION MODAL LOGIC
// -----------------------------------------------------------------------------

function getSavedGroundStation() {
    try {
        const saved = JSON.parse(localStorage.getItem(GROUND_STATION_KEY) || "null");
        if (saved && saved.name && saved.lat !== undefined && saved.lon !== undefined) {
            return saved;
        }
    } catch (e) {}
    return { name: "Cape Canaveral, USA", lat: 28.3922, lon: -80.6077, alt: 3 };
}

function updateGroundStationUI(station) {
    if (clcStationName) clcStationName.textContent = station.name;
    if (clcCoordsDisplay) {
        const latDir = station.lat >= 0 ? "N" : "S";
        const lonDir = station.lon >= 0 ? "E" : "W";
        clcCoordsDisplay.textContent = `${Math.abs(station.lat).toFixed(4)}° ${latDir}, ${Math.abs(station.lon).toFixed(4)}° ${lonDir} · ${station.alt || 0}m Elevation`;
    }
    if (menuLocationBadge) {
        menuLocationBadge.textContent = station.name.split(",")[0];
    }
}

function openTrackingLocationModal() {
    closeProfileFlyout();
    if (!trackingLocationModal) return;

    const station = getSavedGroundStation();
    updateGroundStationUI(station);

    if (stationNameInput) stationNameInput.value = station.name;
    if (stationLatInput) stationLatInput.value = station.lat;
    if (stationLonInput) stationLonInput.value = station.lon;

    // Check if matching preset
    if (stationPresetSelect) {
        let matched = "custom";
        for (const [key, preset] of Object.entries(GROUND_STATION_PRESETS)) {
            if (Math.abs(preset.lat - station.lat) < 0.01 && Math.abs(preset.lon - station.lon) < 0.01) {
                matched = key;
                break;
            }
        }
        stationPresetSelect.value = matched;
    }

    trackingLocationModal.classList.add("open", "show");
    trackingLocationModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

if (menuBtnTrackingLocation) menuBtnTrackingLocation.addEventListener("click", openTrackingLocationModal);
if (trackingLocationClose) trackingLocationClose.addEventListener("click", closeAllModals);
if (trackingLocationCancel) trackingLocationCancel.addEventListener("click", closeAllModals);

// Preset Ground Station Selection
if (stationPresetSelect) {
    stationPresetSelect.addEventListener("change", () => {
        const selected = stationPresetSelect.value;
        if (selected !== "custom" && GROUND_STATION_PRESETS[selected]) {
            const preset = GROUND_STATION_PRESETS[selected];
            if (stationNameInput) stationNameInput.value = preset.name;
            if (stationLatInput) stationLatInput.value = preset.lat;
            if (stationLonInput) stationLonInput.value = preset.lon;
        }
    });
}

// GPS Auto-Detection (Explicit User Click Only)
if (btnGpsDetect) {
    btnGpsDetect.addEventListener("click", () => {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by your browser.", "error");
            return;
        }

        if (gpsBtnText) gpsBtnText.textContent = "Acquiring GPS Satellite Fix...";
        btnGpsDetect.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = parseFloat(pos.coords.latitude.toFixed(4));
                const lon = parseFloat(pos.coords.longitude.toFixed(4));
                const alt = Math.round(pos.coords.altitude || 0);

                if (stationNameInput) stationNameInput.value = "My GPS Ground Station";
                if (stationLatInput) stationLatInput.value = lat;
                if (stationLonInput) stationLonInput.value = lon;
                if (stationPresetSelect) stationPresetSelect.value = "custom";

                updateGroundStationUI({ name: "My GPS Ground Station", lat, lon, alt });
                showToast(`GPS Position Acquired: ${lat}°, ${lon}°`, "success");

                if (gpsBtnText) gpsBtnText.textContent = "Detect My Current GPS Location";
                btnGpsDetect.disabled = false;
            },
            (err) => {
                let errorMsg = "Unable to retrieve GPS coordinates.";
                if (err.code === err.PERMISSION_DENIED) {
                    errorMsg = "Location permission was denied. Please allow location access in your browser.";
                } else if (err.code === err.POSITION_UNAVAILABLE) {
                    errorMsg = "GPS satellite position unavailable.";
                } else if (err.code === err.TIMEOUT) {
                    errorMsg = "GPS acquisition timed out. Please try again.";
                }
                showToast(errorMsg, "error");
                if (gpsBtnText) gpsBtnText.textContent = "Detect My Current GPS Location";
                btnGpsDetect.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

// Save Ground Station Form
if (trackingLocationForm) {
    trackingLocationForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = stationNameInput?.value.trim() || "Custom Observation Post";
        const lat = parseFloat(stationLatInput?.value);
        const lon = parseFloat(stationLonInput?.value);

        if (isNaN(lat) || lat < -90 || lat > 90) {
            showToast("Please enter a valid latitude between -90° and +90°.", "error");
            return;
        }
        if (isNaN(lon) || lon < -180 || lon > 180) {
            showToast("Please enter a valid longitude between -180° and +180°.", "error");
            return;
        }

        const stationData = { name, lat, lon, alt: 10, savedAt: Date.now() };
        try {
            localStorage.setItem(GROUND_STATION_KEY, JSON.stringify(stationData));
            updateGroundStationUI(stationData);
            window.dispatchEvent(new CustomEvent("cosmix:location-changed", { detail: stationData }));
            closeAllModals();
            showToast(`Tracking location updated to ${name}!`, "success");
        } catch (err) {
            console.error("Location save error:", err);
            showToast("Failed to save location coordinates.", "error");
        }
    });
}

// Initial Ground Station UI setup
updateGroundStationUI(getSavedGroundStation());

// -----------------------------------------------------------------------------
// SETTINGS MODAL LOGIC
// -----------------------------------------------------------------------------

function getSavedSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
        if (saved) return saved;
    } catch (e) {}
    return { telemetryRate: "1000", distanceUnits: "km", conjunctionThreshold: "30" };
}

function openSettingsModal() {
    closeProfileFlyout();
    if (!settingsModal) return;

    const settings = getSavedSettings();
    if (settingTelemetryRate) settingTelemetryRate.value = settings.telemetryRate || "1000";
    if (settingDistanceUnits) settingDistanceUnits.value = settings.distanceUnits || "km";
    if (settingConjunctionThreshold) settingConjunctionThreshold.value = settings.conjunctionThreshold || "30";

    settingsModal.classList.add("open", "show");
    settingsModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

if (menuBtnSettings) menuBtnSettings.addEventListener("click", openSettingsModal);
if (settingsModalClose) settingsModalClose.addEventListener("click", closeAllModals);
if (settingsCancel) settingsCancel.addEventListener("click", closeAllModals);

if (settingsForm) {
    settingsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const telemetryRate = settingTelemetryRate?.value || "1000";
        const distanceUnits = settingDistanceUnits?.value || "km";
        const conjunctionThreshold = settingConjunctionThreshold?.value || "30";

        const newSettings = { telemetryRate, distanceUnits, conjunctionThreshold, savedAt: Date.now() };
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
            window.dispatchEvent(new CustomEvent("cosmix:settings-changed", { detail: newSettings }));
            closeAllModals();
            showToast("Orbital preferences saved successfully!", "success");
        } catch (err) {
            console.error("Settings save error:", err);
            showToast("Failed to save preferences.", "error");
        }
    });
}

// -----------------------------------------------------------------------------
// FIREBASE AUTHENTICATION ACTIONS
// -----------------------------------------------------------------------------

// 1. Social Login (Google & GitHub)
async function handleSocialSignIn(provider, providerLabel, button) {
    try {
        setButtonLoading(button, true, `Connecting to ${providerLabel}...`);
        setStatus(`Connecting to ${providerLabel} sign-in...`, "info");

        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        finishAuthenticatedSession(user, `Welcome, ${user.displayName || user.email}!`);
    } catch (err) {
        console.error(`${providerLabel} Auth error:`, err);
        setStatus(describeAuthError(err), "error");
    } finally {
        setButtonLoading(button, false);
    }
}

if (googleAuthBtn) googleAuthBtn.addEventListener("click", () => handleSocialSignIn(googleProvider, "Google", googleAuthBtn));
if (githubAuthBtn) githubAuthBtn.addEventListener("click", () => handleSocialSignIn(githubProvider, "GitHub", githubAuthBtn));
if (googleSignupBtn) googleSignupBtn.addEventListener("click", () => handleSocialSignIn(googleProvider, "Google", googleSignupBtn));
if (githubSignupBtn) githubSignupBtn.addEventListener("click", () => handleSocialSignIn(githubProvider, "GitHub", githubSignupBtn));

// 2. Email + Password Sign In
if (signinForm) {
    signinForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = signinEmail?.value.trim();
        const password = signinPassword?.value;

        if (!email || !password) {
            setStatus("Please enter both your email address and password.", "error");
            return;
        }

        try {
            setButtonLoading(signinSubmitBtn, true, "Authenticating...");
            setStatus("Verifying credentials with Orbital Security...", "info");

            const credential = await signInWithEmailAndPassword(auth, email, password);
            finishAuthenticatedSession(credential.user, `Welcome back, ${credential.user.displayName || credential.user.email}!`);
        } catch (err) {
            console.error("Sign-in error:", err);
            setStatus(describeAuthError(err), "error");
        } finally {
            setButtonLoading(signinSubmitBtn, false);
        }
    });
}

// 3. Email + Password Account Registration
if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fullName = signupFullName?.value.trim();
        const username = signupUsername?.value.trim();
        const email = signupEmail?.value.trim();
        const password = signupPassword?.value;
        const role = signupRole?.value || "Orbital Analyst";
        const agreed = signupAgree?.checked;

        if (!fullName || !username || !email || !password) {
            setStatus("Please fill in all required fields.", "error");
            return;
        }

        if (password.length < 6) {
            setStatus("Password must be at least 6 characters in length.", "error");
            return;
        }

        if (!agreed) {
            setStatus("Please agree to the Terms of Service & Privacy Policy to continue.", "error");
            return;
        }

        try {
            setButtonLoading(signupSubmitBtn, true, "Creating Account...");
            setStatus("Registering new Orbital Operator profile...", "info");

            const credential = await createUserWithEmailAndPassword(auth, email, password);

            await updateProfile(credential.user, {
                displayName: fullName
            });

            credential.user.role = role;
            credential.user.username = username;

            finishAuthenticatedSession(credential.user, `Account created! Welcome aboard, ${fullName}!`);
        } catch (err) {
            console.error("Sign-up error:", err);
            setStatus(describeAuthError(err), "error");
        } finally {
            setButtonLoading(signupSubmitBtn, false);
        }
    });
}

// 4. Password Reset Flow
if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = forgotEmail?.value.trim();

        if (!email) {
            setStatus("Please enter your registered email address.", "error");
            return;
        }

        try {
            setButtonLoading(forgotSubmitBtn, true, "Sending Link...");
            setStatus("Dispatching password reset instructions...", "info");

            await sendPasswordResetEmail(auth, email);
            setStatus(`Password reset link dispatched to ${email}. Check your inbox!`, "success");
            showToast("Password reset email sent.", "success");
        } catch (err) {
            console.error("Password reset error:", err);
            setStatus(describeAuthError(err), "error");
        } finally {
            setButtonLoading(forgotSubmitBtn, false);
        }
    });
}

// 5. Passwordless Magic Link Flow
function getActionCodeSettings() {
    return {
        url: window.location.href.split("#")[0],
        handleCodeInApp: true
    };
}

if (magicForm) {
    magicForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = magicEmail?.value.trim();

        if (!email) {
            setStatus("Please enter your email address.", "error");
            return;
        }

        try {
            setButtonLoading(magicSubmitBtn, true, "Sending Link...");
            setStatus("Sending secure passwordless sign-in link...", "info");

            await sendSignInLinkToEmail(auth, email, getActionCodeSettings());
            localStorage.setItem(EMAIL_STORAGE_KEY, email);

            setStatus(`Secure sign-in link sent to ${email}. Click the link in your email to authenticate.`, "success");
            showToast("Magic login link sent to your inbox!", "success");
        } catch (err) {
            console.error("Magic link send error:", err);
            setStatus(describeAuthError(err), "error");
        } finally {
            setButtonLoading(magicSubmitBtn, false);
        }
    });
}

// Complete Magic Link Sign-In if returning via email link
async function completeEmailLinkSignIn() {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    openAuthModal("signin");
    let email = localStorage.getItem(EMAIL_STORAGE_KEY);
    if (!email) {
        email = window.prompt("Please confirm the email address you used to request the sign-in link:");
    }

    if (!email) {
        setStatus("Sign-in link requires email confirmation to complete.", "error");
        return;
    }

    try {
        setStatus("Completing passwordless authentication...", "info");
        const result = await signInWithEmailLink(auth, email, window.location.href);
        localStorage.removeItem(EMAIL_STORAGE_KEY);

        window.history.replaceState({}, document.title, window.location.pathname);

        finishAuthenticatedSession(result.user, `Authenticated via Magic Link as ${result.user.email}!`);
    } catch (err) {
        console.error("Email link sign-in error:", err);
        setStatus(describeAuthError(err), "error");
    }
}
completeEmailLinkSignIn();

// 6. Sign Out
export async function logoutUser() {
    try {
        closeProfileFlyout();
        closeAllModals();
        await signOut(auth);
        updateOperatorUI(null);
        showToast("Signed out successfully.", "info");
    } catch (err) {
        console.error("Logout error:", err);
        showToast("Sign out encountered an error.", "error");
    }
}
window.logoutUser = logoutUser;
if (navSignoutBtn) navSignoutBtn.addEventListener("click", logoutUser);

// -----------------------------------------------------------------------------
// FIREBASE AUTH STATE LISTENER & LOCAL STORAGE RESTORE
// -----------------------------------------------------------------------------

// Instant restore from localStorage to eliminate UI flicker
try {
    const cachedUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || "null");
    if (cachedUser) {
        updateOperatorUI(cachedUser);
    }
} catch (e) {}

// Listen to live Firebase Auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Merge with local role/username if stored
        try {
            const cachedUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || "null");
            if (cachedUser) {
                user.role = cachedUser.role || user.role;
                user.username = cachedUser.username || user.username;
            }
        } catch (e) {}
        updateOperatorUI(user);
    } else {
        updateOperatorUI(null);
    }
});

// Cross-tab synchronization
window.addEventListener("storage", (e) => {
    if (e.key === USER_STORAGE_KEY) {
        try {
            const updated = e.newValue ? JSON.parse(e.newValue) : null;
            updateOperatorUI(updated);
        } catch (err) {}
    }
    if (e.key === GROUND_STATION_KEY) {
        try {
            const updatedStation = e.newValue ? JSON.parse(e.newValue) : null;
            if (updatedStation) updateGroundStationUI(updatedStation);
        } catch (err) {}
    }
});

requireAuthForProtectedLinks();
openAuthFromRedirect();
