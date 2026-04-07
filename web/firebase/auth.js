import { auth } from "./firebaseConfig";
import { doCreateUserWithEmailAndPassword, GoogleAuthProvider, signInWithEmailAndPassword, updatePassword} from "firebase/auth";

export const doCreateUserWithEmailAndPassword = async (email, password) => {
    return doCreateUserWithEmailAndPassword(auth, email, password);
};

export const doSignInWithEmailAndPassword = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
};

export const doSignInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    result.user;
    return result;
};

export const doSignOut = () => {
    return auth.signOut();
};

/*
export const doPasswordReset = (email) => {
    return updatePassword(auth.currentUser, password);
};

export const doPasswordChange = (password) => {
    return updatePassword(auth.currentUser, password);
};

export const doSendEmailVerification = () => {
    return auth.currentUser.sendEmailVerification();
};
*/