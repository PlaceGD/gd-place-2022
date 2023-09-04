import { initializeApp } from "firebase/app"
import { getDatabase, ref, onValue } from "firebase/database"
import { getAuth } from "firebase/auth"
import { getAnalytics } from "firebase/analytics"

import { getFunctions, httpsCallable } from "firebase/functions"

const firebaseConfig = {} // config here

export const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)
export const auth = getAuth(app)
const functions = getFunctions(app)
export const placeObject = httpsCallable(functions, "placeObject")
export const deleteObject = httpsCallable(functions, "deleteObject")
export const sendMessage = httpsCallable(functions, "sendMessage")
export const verifyCode = httpsCallable(functions, "verifyCode")
export const initUserWithUsername = httpsCallable(
    functions,
    "initUserWithUsername"
)
export const newView = httpsCallable(functions, "newView")
export const userViewing = httpsCallable(functions, "userViewing")
