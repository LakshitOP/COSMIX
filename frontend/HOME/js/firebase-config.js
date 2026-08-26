import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";


import { getAuth } from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


// Replace these values with YOUR Firebase configuration.

const firebaseConfig = {

    apiKey: "AIzaSyCpaF5GCGOVoMTnD3teFOl-yus6o7wrlRw",

    authDomain:
        "cosmix-74bbe.firebaseapp.com",

    projectId:
        "cosmix-74bbe",

    storageBucket:
        "cosmix-74bbe.firebasestorage.app",

    messagingSenderId:
        "484785253644",

    appId:
        "1:484785253644:web:692795b8b410319ed02d29"

};


// Initialize Firebase

const app = initializeApp(firebaseConfig);


// Initialize Authentication

export const auth = getAuth(app);