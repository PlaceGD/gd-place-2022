import * as functions from "firebase-functions"
import * as admin from "firebase-admin"

// import { CHUNK_SIZE } from "../../../src/firebase/database"

// import { GDObject } from "../../../src/editor/object"

const CHUNK_SIZE = { x: 20 * 30, y: 20 * 30 }

admin.initializeApp()

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = functions.https.onRequest((request, response) => {
//     functions.logger.info("Hello logs!", { structuredData: true })
//     response.send("Hello from Firebase!")
// })

// export const onObjectPlaced = functions.database.ref("/chunks/{chunkId}/{objectId}").onCreate((snapshot, context) => {
//     const chunkId = context.params.chunkId
//     const objectId = context.params.objectId
// })

export const placeObject = functions.https.onCall(async (data, request) => {
    // check that user is authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated")
    }

    // get user last timestamp /userData/$uid/lastPlaced
    const uid = request.auth.uid
    const lastPlacedRef = admin.database().ref(`/userData/${uid}/lastPlaced`)
    const lastPlaced = (await lastPlacedRef.once("value")).val()
    const now = Date.now()
    if (lastPlaced && now - lastPlaced < 295000) {
        throw new functions.https.HttpsError("resource-exhausted", "Object placed before cooldown")
    }

    // reset timer
    await lastPlacedRef.set(now)

    functions.logger.log(`placeObject ${data}`)

    const object = data.text

    let props = object.toString().split(";")

    let chunkX = Math.floor(parseFloat(props[1]) / CHUNK_SIZE.x)
    let chunkY = Math.floor(parseFloat(props[2]) / CHUNK_SIZE.y)

    const db = admin.database()
    const ref = db.ref(`/chunks/${chunkX},${chunkY}/`)
    ref.push(object)
})

export const deleteObject = functions.https.onCall(async (data, request) => {
    // check that user is authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User is not authenticated")
    }

    // get user last timestamp /userData/$uid/lastDeleted
    const uid = request.auth.uid
    const lastDeletedRef = admin.database().ref(`/userData/${uid}/lastDeleted`)
    const lastDeleted = (await lastDeletedRef.once("value")).val()
    const now = Date.now()
    if (lastDeleted && now - lastDeleted < 295000) {
        throw new functions.https.HttpsError("resource-exhausted", "Object deleted before cooldown")
    }

    // reset timer
    await lastDeletedRef.set(now)

    functions.logger.log(`deleteobject ${data.chunkId} ${data.objId}`)

    // // check that data.chunkId is number,number
    // if (!data.chunkId.match(/^\d+,\d+$/)) {
    //     throw new functions.https.HttpsError("invalid-argument", "Invalid chunkId")
    // }

    // // check that data.objectId is a valid firebase key
    // if (!data.objId.match(/^[a-zA-Z0-9_-]+$/)) {
    //     throw new functions.https.HttpsError("invalid-argument", "Invalid objectId")
    // }

    const db = admin.database()
    const ref = db.ref(`/chunks/${data.chunkId}/${data.objId}`)
    ref.remove()
})
