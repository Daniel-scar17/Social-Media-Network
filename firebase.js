import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD3zIr2jllCyYitPnoLmTl8NoUgg4Dxh24",
    authDomain: "social-network-752eb.firebaseapp.com",
    projectId: "social-network-752eb",
    storageBucket: "social-network-752eb.firebasestorage.app",
    messagingSenderId: "456526479691",
    appId: "1:456526479691:web:b2f9430b6f751a0cd928ce",
    measurementId: "G-9FF3CL6HFP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
    db,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    getDocs
};
