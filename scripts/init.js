import { getAuth } from "firebase-admin/auth"
import { initializeApp, applicationDefault } from "firebase-admin/app"
import { signInWithCustomToken } from "firebase/auth"

process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "./googleCredentials.json"

const ADMIN_UID = "BwgUjk2rKrQ3h52FrrfBpPc3QMo2"

const firebaseApp = async (userId) => {
    const firebaseApp = initializeApp({
        credential: applicationDefault(),
        databaseURL: "https://geometrydash-place-default-rtdb.firebaseio.com/",
    })

    const customToken = await getAuth().createCustomToken(userId)

    await signInWithCustomToken(await getAuth(), customToken)

    return firebaseApp
}

// const firebaseConfig = {
//     apiKey: "AIzaSyAjDrDDgnLR6P5c8SANZhfe1v_NS8w_L2w",
//     authDomain: "geometrydash-place.firebaseapp.com",
//     databaseURL: "https://geometrydash-place-default-rtdb.firebaseio.com/",
//     projectId: "geometrydash-place",
//     storageBucket: "geometrydash-place.appspot.com",
//     messagingSenderId: "834241355775",
//     appId: "1:834241355775:web:9fa08865bd618995b651ca",
//     measurementId: "G-DREX7FG1NR",
// }

// export const app = initializeApp({
//     credential: applicationDefault(),
//     databaseURL: "https://geometrydash-place-default-rtdb.firebaseio.com/",
// })

export const app = await firebaseApp(ADMIN_UID)

// export const app = initializeApp(firebaseConfig)
