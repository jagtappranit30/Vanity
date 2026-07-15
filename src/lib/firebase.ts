import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);

// Initialize Firestore with explicit database ID if provided, otherwise default
const config = firebaseConfig as any;
export const db = getFirestore(app, config.firestoreDatabaseId);

// Initialize Authentication
export const auth = getAuth(app);

// Configure Google Sign-In Provider with required Docs/Drive scopes
export const googleAuthProvider = new GoogleAuthProvider();

// Add Scopes for Google Drive & Google Docs
googleAuthProvider.addScope("https://www.googleapis.com/auth/documents");
googleAuthProvider.addScope("https://www.googleapis.com/auth/drive.file");
