import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import { initializeApp } from "firebase-admin/app"

import objects from "./objects.json"

import { BAD_WORDS } from "./badwords"

export * from "./gd"

const CHUNK_SIZE = { x: 20 * 30, y: 20 * 30 }

function vec(x: number, y: number) {
    return { x, y }
}
const SONG_LENGTH = 250

const LEVEL_BOUNDS = {
    start: vec(0, 0),
    end: vec(30 * Math.round(SONG_LENGTH * 10.3761348898), 30 * 80),
}

let idMapping: Record<number, any> = {}
for (let i in objects) {
    idMapping[objects[i].id] = i
}

export const getObjSettings = (id: number) => objects[idMapping[id]]

initializeApp()

export const placeObject = functions.https.onCall(async (data, request) => {
    // check that user is authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "User is not authenticated"
        )
    }

    const db = admin.database()
    const uid = request.auth.uid

    // get object limit and object count
    const object = data.text

    let props = object.toString().split(";")

    validateObject(props)

    let chunkX = Math.floor(parseFloat(props[1]) / CHUNK_SIZE.x)
    let chunkY = Math.floor(parseFloat(props[2]) / CHUNK_SIZE.y)

    // get the stuff
    let [obj_limit, obj_count, { eventStart, placeTimer: timer }, userData] = (
        await Promise.all([
            db.ref("chunkObjectLimit").get(),
            db.ref(`objectCount/${chunkX},${chunkY}`).get(),
            db.ref("editorState").get(),
            db.ref(`/userData/${uid}`).get(),
        ])
    ).map((a) => a.val())

    if (eventStart > Date.now() / 1000 && !userData?.admin) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Object placed before event start"
        )
    }
    if (userData.placeTimer) timer = userData.placeTimer

    // get user last timestamp /userData/$uid/lastPlaced
    const now = Date.now()

    if (userData.lastPlaced && now - userData.lastPlaced < (timer - 5) * 1000) {
        throw new functions.https.HttpsError(
            "resource-exhausted",
            "Object placed before cooldown"
        )
    }

    if (obj_count >= obj_limit) {
        throw new functions.https.HttpsError(
            "resource-exhausted",
            "There are too many objects in this area! Maybe delete one instead?"
        )
    }

    const ref = db.ref(`/chunks/${chunkX},${chunkY}/`)
    let key = await ref.push(object)

    // reset timer
    //if (uid != "BwgUjk2rKrQ3h52FrrfBpPc3QMo2")
    // :mabbog:
    await db.ref(`/userData/${uid}/lastPlaced`).set(now)

    db.ref(`/userPlaced/${key.key}`).set(userData.username)

    // add to history
    db.ref(`/history`).push({
        key: key.key,
        placedObject: object,
        timeStamp: now,
        username: userData.username,
    })

    // add to object count
    db.ref(`/objectCount/${chunkX},${chunkY}`).transaction((count) => {
        return (count || 0) + 1
    })
})

export const deleteObject = functions.https.onCall(async (data, request) => {
    // check that user is authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "User is not authenticated"
        )
    }

    const db = admin.database()
    const uid = request.auth.uid

    // make sure the event has started before deleting

    let [{ eventStart, deleteTimer: timer }, userData] = (
        await Promise.all([
            db.ref("editorState").get(),
            db.ref(`/userData/${uid}`).get(),
        ])
    ).map((a) => a.val())

    if (eventStart > Date.now() / 1000 && !userData?.admin) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Object placed before event start"
        )
    }

    if (userData.deleteTimer) timer = userData.deleteTimer

    // get user last timestamp /userData/$uid/lastDeleted
    const lastDeleted = userData.lastDeleted
    const now = Date.now()

    if (lastDeleted && now - lastDeleted < (timer - 5) * 1000) {
        throw new functions.https.HttpsError(
            "resource-exhausted",
            "Object deleted before cooldown"
        )
    }

    // validate data.objId
    if (!data.objId) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Object id not provided"
        )
    }

    const ref = db.ref(`/chunks/${data.chunkId}/${data.objId}`)
    ref.set(userData.username).then(() => ref.remove())

    // reset timer
    //if (uid != "BwgUjk2rKrQ3h52FrrfBpPc3QMo2")
    await db.ref(`/userData/${uid}/lastDeleted`).set(now)

    db.ref(`/userPlaced/${data.objId}`).remove()
    // add to history
    db.ref(`/history`).push({
        key: data.objId,
        chunk: data.chunkId,
        timeStamp: now,
    })

    // subtract from object count
    db.ref(`/objectCount/${data.chunkId}`).transaction((count) => {
        return count - 1
    })
})

export const initUserWithUsername = functions.https.onCall(
    async (data, request) => {
        if (!request.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User is not authenticated"
            )
        }

        if (!data.username.match(/^[A-Za-z0-9_-]{3,16}$/)) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Username is invalid"
            )
        }

        const db = admin.database()

        // check if /userName/$username exists

        const usernameExists = db.ref(
            `/userName/${data.username.toLowerCase()}`
        )

        // check username for bad words
        BAD_WORDS.forEach((word) => {
            if (data.username.toLowerCase().includes(word)) {
                throw new functions.https.HttpsError(
                    "invalid-argument",
                    "Invalid username"
                )
            }
        })

        const val = (await usernameExists.get()).val()
        if (val != null) {
            throw new functions.https.HttpsError(
                "already-exists",
                "Username already exists"
            )
        }

        let user = {
            username: data.username,
            lastPlaced: 0,
            lastDeleted: 0,
        }

        // make new user
        db.ref(`/userData/${data.uid}`).set(user)

        db.ref(`/userName/${data.username.toLowerCase()}`).set({
            uid: data.uid,
        })

        db.ref("/userCount").transaction((count) => {
            return count + 1
        })

        return user
    }
)

function validateObject(props: string[]) {
    const [
        id,
        x,
        y,
        rotation,
        flip,
        scale,
        zOrder,
        mainColor,
        mainBlending,
        mainOpacity,
        detailColor,
        detailBlending,
        detailOpacity,
    ] = props

    const foundObject: any = getObjSettings(parseInt(id)) // breaks with .default(?)

    // check that the id is valid
    if (!foundObject) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid object id"
        )
    }

    // check that the x and y are valid
    if (
        parseFloat(x) < LEVEL_BOUNDS.start.x ||
        parseFloat(x) > LEVEL_BOUNDS.end.x ||
        parseFloat(y) < LEVEL_BOUNDS.start.y ||
        parseFloat(y) > LEVEL_BOUNDS.end.y
    ) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid object position"
        )
    }

    // check that the rotation is valid
    if (parseFloat(rotation) != Math.round(parseFloat(rotation))) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid object rotation"
        )
    }

    // check that the rotation is valid
    if (foundObject.solid && parseFloat(rotation) % 90 != 0) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid object rotation"
        )
    }

    // check that the flip is valid
    if (flip != "0" && flip != "1") {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid object flip"
        )
    }

    // check that the scale is valid
    if (parseFloat(scale) < 0.5 || parseFloat(scale) > 2) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid object scale"
        )
    }

    // check that the zOrder is valid
    if (parseInt(zOrder) < -1 || parseInt(zOrder) > 121) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid object zOrder"
        )
    }
    ;[
        [mainColor, mainBlending, mainOpacity],
        [detailColor, detailBlending, detailOpacity],
    ].forEach(([color, blending, opacity]) => {
        if (
            !foundObject.tintable &&
            (color != "ffffff" || blending != "0" || opacity != "1")
        ) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Invalid object mainColor"
            )
        }
        // check that the mainColor is valid
        if (!/^[0-9a-f]{6}$/i.test(color)) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Invalid object mainColor"
            )
        }

        // check that the mainBlending is valid
        if (blending != "0" && blending != "1") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Invalid object mainBlending"
            )
        }

        // check for invisible
        if (blending == "1" && color == "000000") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Invalid object mainColor (invisible)"
            )
        }

        // check that the mainOpacity is valid
        if (parseFloat(opacity) < 0.2 || parseFloat(opacity) > 1) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Invalid object mainOpacity"
            )
        }
    })
}
