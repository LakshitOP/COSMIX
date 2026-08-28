import {
    GithubAuthProvider,
    GoogleAuthProvider,
    isSignInWithEmailLink,
    onAuthStateChanged,
    sendSignInLinkToEmail,
    signInWithEmailLink,
    signInWithPopup,
    signOut
} from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import { auth } from "./firebase-config.js";


// --------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------

const overlay =
    document.getElementById("auth-overlay");

const closeBtn =
    document.getElementById("auth-close");

const googleBtn =
    document.getElementById("google-auth-btn");

const githubBtn =
    document.getElementById("github-auth-btn");

const signupForm =
    document.getElementById("signup-form");

const emailInput =
    document.getElementById("email");

const fullNameInput =
    document.getElementById("full-name");

const authStatus =
    document.getElementById("auth-status");

const submitBtn =
    document.getElementById("auth-submit-btn");

const trigger =
    document.getElementById("hero-signup-trigger");

const signinLink =
    document.getElementById("auth-signin-link");

const navAvatar =
    document.getElementById("nav-avatar");

const emailStorageKey =
    "emailForSignIn";


// --------------------------------------------------
// MODAL
// --------------------------------------------------

export function openModal() {

    if (!overlay) {

        return;

    }

    overlay.classList.add("open", "show");

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow = "hidden";
}

window.openAuthModal = openModal;


export function closeModal() {

    if (!overlay) {

        return;

    }

    overlay.classList.remove("open", "show");

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow = "";
}

window.closeAuthModal = closeModal;


// Open from "Get Started"

if (trigger) {

    trigger.addEventListener(
        "click",
        openModal
    );

}

if (navAvatar) {

    navAvatar.addEventListener(
        "click",
        openModal
    );

}


// Close button

if (closeBtn) {

    closeBtn.addEventListener(
        "click",
        closeModal
    );

}


// Sign-in switch

if (signinLink) {

    signinLink.addEventListener(
        "click",
        () => {

            setStatus(
                "Enter your email address and we will send a login link."
            );

            if (emailInput) {

                emailInput.focus();

            }

        }
    );

}


// Close when clicking outside

if (overlay) {

    overlay.addEventListener(
        "click",
        (event) => {

            if (
                event.target === overlay
            ) {

                closeModal();

            }

        }
    );

}


// Escape key

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Escape" &&
            overlay &&
            (overlay.classList.contains("show") || overlay.classList.contains("open"))
        ) {

            closeModal();

        }

    }
);


// --------------------------------------------------
// AUTH HELPERS
// --------------------------------------------------

const googleProvider =
    new GoogleAuthProvider();

const githubProvider =
    new GithubAuthProvider();


function setStatus(
    message,
    type = "info"
) {

    if (!authStatus) {

        return;

    }

    if (!message) {

        authStatus.textContent = "";

        authStatus.className = "auth-status";

        authStatus.style.display = "none";

        return;

    }

    authStatus.textContent =
        message;

    authStatus.className =
        `auth-status ${type}`;

    authStatus.dataset.type =
        type;

    authStatus.style.display =
        "block";

}


function setButtonLoading(
    button,
    isLoading,
    loadingText
) {

    if (!button) {

        return;

    }

    if (!button.dataset.originalHtml) {

        button.dataset.originalHtml =
            button.innerHTML;

    }

    button.disabled =
        isLoading;

    button.innerHTML =
        isLoading
            ? loadingText
            : button.dataset.originalHtml;

}


function logAuthenticatedUser(
    label,
    user
) {

    console.log(
        label,
        user
    );

    console.log(
        "UID:",
        user.uid
    );

    console.log(
        "Name:",
        user.displayName
    );

    console.log(
        "Email:",
        user.email
    );

    console.log(
        "Photo:",
        user.photoURL
    );

}


function applyAuthenticatedUser(
    user,
    providerLabel
) {

    logAuthenticatedUser(
        `${providerLabel} login successful:`,
        user
    );

    if (
        emailInput &&
        user.email
    ) {

        emailInput.value =
            user.email;

    }

    if (
        fullNameInput &&
        user.displayName
    ) {

        fullNameInput.value =
            user.displayName;

    }

    setStatus(
        `Signed in as ${user.email || user.displayName || user.uid}.`,
        "success"
    );

}


function describeAuthError(
    error
) {

    if (!error) return "An unknown error occurred.";

    const code = error.code || "";

    switch (code) {

        case "auth/invalid-email":
            return "Please enter a valid email address.";

        case "auth/missing-email":
            return "Email address is required.";

        case "auth/operation-not-allowed":
            return "Email link sign-in is not enabled in Firebase Console (Authentication > Sign-in method > Email/Password).";

        case "auth/unauthorized-domain":
            return "This domain is not authorized in Firebase settings (Authentication > Settings > Authorized domains).";

        case "auth/invalid-continue-uri":
        case "auth/unauthorized-continue-uri":
            return "The redirect URL is not authorized in Firebase settings.";

        case "auth/popup-closed-by-user":
            return "The sign-in popup was closed before authentication finished.";

        case "auth/popup-blocked":
            return "The browser blocked the sign-in popup. Allow popups and try again.";

        case "auth/network-request-failed":
            return "Network connection error. Please check your internet connection.";

        case "auth/quota-exceeded":
            return "Email quota exceeded for this Firebase project. Try again later.";

        default:
            return error.message || String(error);

    }

}


async function signInWithProvider(
    provider,
    providerLabel,
    button
) {

    try {

        setButtonLoading(
            button,
            true,
            `Connecting to ${providerLabel}...`
        );

        setStatus(
            `Opening ${providerLabel} sign-in...`,
            "info"
        );

        const result =
            await signInWithPopup(
                auth,
                provider
            );

        applyAuthenticatedUser(
            result.user,
            providerLabel
        );

    } catch (error) {

        console.error(
            `${providerLabel} login error:`,
            error
        );

        setStatus(
            `${providerLabel} sign-in failed: ${describeAuthError(error)}`,
            "error"
        );

    } finally {

        setButtonLoading(
            button,
            false
        );

    }

}


function getActionCodeSettings() {

    let returnUrl = window.location.href.split('#')[0].split('?')[0];

    if (!window.location.protocol.startsWith("http") || !window.location.origin || window.location.origin === "null") {
        returnUrl = "https://cosmix-74bbe.firebaseapp.com/";
    }

    return {
        url: returnUrl,
        handleCodeInApp: true
    };

}


async function completeEmailLinkSignIn() {

    if (
        !isSignInWithEmailLink(
            auth,
            window.location.href
        )
    ) {

        return;

    }

    openModal();

    let email =
        window.localStorage.getItem(
            emailStorageKey
        );

    if (!email) {

        email =
            window.prompt(
                "Please enter the email address you used to request this sign-in link."
            );

    }

    if (!email) {

        setStatus(
            "Email sign-in could not finish without your email address.",
            "error"
        );

        return;

    }

    try {

        setStatus(
            "Completing email sign-in..."
        );

        const result =
            await signInWithEmailLink(
                auth,
                email,
                window.location.href
            );

        window.localStorage.removeItem(
            emailStorageKey
        );

        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );

        applyAuthenticatedUser(
            result.user,
            "Email link"
        );

    } catch (error) {

        console.error(
            "Email link sign-in error:",
            error
        );

        setStatus(
            `Email sign-in failed: ${describeAuthError(error)}`,
            "error"
        );

    }

}


completeEmailLinkSignIn();


// --------------------------------------------------
// GOOGLE LOGIN
// --------------------------------------------------

if (googleBtn) {

    googleBtn.addEventListener(
        "click",
        () => signInWithProvider(
            googleProvider,
            "Google",
            googleBtn
        )
    );

}


// --------------------------------------------------
// GITHUB LOGIN
// --------------------------------------------------

if (githubBtn) {

    githubBtn.addEventListener(
        "click",
        () => signInWithProvider(
            githubProvider,
            "GitHub",
            githubBtn
        )
    );

}


// --------------------------------------------------
// CHECK LOGIN STATE
// --------------------------------------------------

onAuthStateChanged(
    auth,
    (user) => {

        if (user) {

            console.log(
                "Currently logged in:",
                user.email
            );

            console.log(
                "UID:",
                user.uid
            );

        } else {

            console.log(
                "No user logged in."
            );

        }

    }
);


// --------------------------------------------------
// PASSWORDLESS EMAIL LOGIN
// --------------------------------------------------

if (signupForm) {

    signupForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            if (
                !emailInput ||
                !emailInput.value.trim()
            ) {

                setStatus(
                    "Please enter your email address to continue.",
                    "error"
                );

                if (emailInput) emailInput.focus();

                return;

            }

            const email =
                emailInput.value.trim();

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {

                setStatus(
                    "Please enter a valid email address (e.g. user@example.com).",
                    "error"
                );

                emailInput.focus();

                return;

            }

            const agreeTerms =
                document.getElementById("agree-terms");

            if (agreeTerms && !agreeTerms.checked) {

                setStatus(
                    "Please agree to the Terms of Service and Privacy Policy.",
                    "error"
                );

                agreeTerms.focus();

                return;

            }

            try {

                setButtonLoading(
                    submitBtn,
                    true,
                    "Sending login link..."
                );

                setStatus(
                    "Sending passwordless sign-in link...",
                    "info"
                );

                await sendSignInLinkToEmail(
                    auth,
                    email,
                    getActionCodeSettings()
                );

                window.localStorage.setItem(
                    emailStorageKey,
                    email
                );

                setStatus(
                    `Login link sent to ${email}! Please check your email inbox to complete sign-in.`,
                    "success"
                );

            } catch (error) {

                console.error(
                    "Email link send error:",
                    error
                );

                setStatus(
                    `Could not send login link: ${describeAuthError(error)}`,
                    "error"
                );

            } finally {

                setButtonLoading(
                    submitBtn,
                    false
                );

            }

        }
    );

}


// --------------------------------------------------
// SIGN OUT FUNCTION
// --------------------------------------------------

export async function logoutUser() {

    try {

        await signOut(auth);

        console.log(
            "User logged out."
        );

    } catch (error) {

        console.error(
            "Logout failed:",
            error
        );

    }

}
