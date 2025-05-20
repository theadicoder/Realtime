import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDVm2VwsIFmlmCHuzGzhK8SY6nKH358Iqw",
    authDomain: "loggedin-67e65.firebaseapp.com",
    projectId: "loggedin-67e65",
    storageBucket: "loggedin-67e65.firebasestorage.app",
    messagingSenderId: "1056861071116",
    appId: "1:1056861071116:web:00d52628689fe0984c4b29",
    measurementId: "G-3LQQHW34YH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
