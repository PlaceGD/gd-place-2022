import { toast } from "@zerodevx/svelte-toast"
import type { FirebaseApp } from "firebase/app"
import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    type User,
    signOut as logOut,
    type UserCredential,
    GithubAuthProvider,
    signInWithEmailAndPassword,
    signInWithCredential,
    AuthCredential,
    signInWithCustomToken,
    EmailAuthCredential,
    EmailAuthProvider,
    type AuthProvider,
    TwitterAuthProvider,
    createUserWithEmailAndPassword,
    inMemoryPersistence,
    setPersistence,
    sendSignInLinkToEmail,
    browserLocalPersistence,
    isSignInWithEmailLink,
    signInWithEmailLink,
    onIdTokenChanged,
} from "firebase/auth"

import { get, getDatabase, onValue, ref, set } from "firebase/database"
import { getFirestore, doc } from "firebase/firestore"
import type { HttpsCallableResult } from "firebase/functions"

import { toastErrorTheme } from "../const"
import { derived, writable, type Writable } from "svelte/store"
import { auth, database, initUserWithUsername } from "./init"

export const isEmailVerification = isSignInWithEmailLink(
    auth,
    window.location.href
)

setPersistence(auth, inMemoryPersistence)

let googleProvider = new GoogleAuthProvider()
let githubProvider = new GithubAuthProvider()
let twitterProvider = new TwitterAuthProvider()

export type UserProperties = {
    username: string
    lastPlaced: number
    lastDeleted: number
}
export type UserData = {
    user: User
    data: UserProperties | null // no user data
}

export const currentUserData: Writable<UserData | null> = writable(null)
export const currentUserDisplayColor: Writable<string> = writable(null)

export const signInGoogle = () => signInWithPopup(auth, googleProvider)
export const signInGithub = () => signInWithPopup(auth, githubProvider)
export const signInTwitter = () => signInWithPopup(auth, twitterProvider)

export const signInEmailLink = (email: string) => {
    const actionCodeSettings = {
        url: window.location.href,
        handleCodeInApp: true,
    }
    return sendSignInLinkToEmail(auth, email, actionCodeSettings)
}

export const signOut = () => logOut(auth)

export const initUserData = (uid: string, username: string) => {
    return initUserWithUsername({ uid, username }) as Promise<
        HttpsCallableResult<UserProperties>
    >
}

export const canEdit = derived(
    currentUserData,
    (value) =>
        value != null &&
        typeof value != "string" &&
        value.data != null &&
        typeof value.data != "string"
)

let userDataListener = null
let userDisplayColorListener = null

onAuthStateChanged(auth, async (user) => {
    console.log("hi")
    if (user != null) {
        console.log("signed in")
        let userDataValue = {
            user,
            data: null,
        }

        currentUserData.set(userDataValue)
        if (userDataListener != null) {
            userDataListener()
        }
        userDataListener = onValue(
            ref(database, `userData/${user.uid}`),
            (snapshot) => {
                userDataValue.data = snapshot.val()
                currentUserData.set(userDataValue)

                if (userDataValue.data !== null) {
                    setPersistence(auth, browserLocalPersistence)
                }
            }
        )
    } else {
        console.log("signed out")
        if (userDataListener != null) {
            userDataListener()
        }
        currentUserData.set(null)
    }
})
