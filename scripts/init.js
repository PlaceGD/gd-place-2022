import { initializeApp, applicationDefault } from "firebase-admin/app"

process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "./googleCredentials.json"

export const app = initializeApp({
    credential: applicationDefault(),
    databaseURL: "https://geometrydash-place-default-rtdb.firebaseio.com/",
})
