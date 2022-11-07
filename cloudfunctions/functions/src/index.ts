import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import { initializeApp } from "firebase-admin/app"

export * from "./gd"

const CHUNK_SIZE = { x: 20 * 30, y: 20 * 30 }

function vec(x: number, y: number) {
    return { x, y }
}

const LEVEL_BOUNDS = {
    start: vec(0, 0),
    end: vec(30 * 3000, 30 * 80),
}

initializeApp()

const timer = 1 * 60

export const placeObject = functions.https.onCall(async (data, request) => {
    // check that user is authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "User is not authenticated"
        )
    }

    const db = admin.database()

    // get user last timestamp /userData/$uid/lastPlaced
    const uid = request.auth.uid
    const lastPlacedRef = db.ref(`/userData/${uid}/lastPlaced`)
    const lastPlaced = (await lastPlacedRef.once("value")).val()
    const now = Date.now()
    if (lastPlaced && now - lastPlaced < (timer - 5) * 1000) {
        throw new functions.https.HttpsError(
            "resource-exhausted",
            "Object placed before cooldown"
        )
    }

    functions.logger.log(`placeObject ${data}`)

    const object = data.text

    let props = object.toString().split(";")

    validateObject(props)

    let chunkX = Math.floor(parseFloat(props[1]) / CHUNK_SIZE.x)
    let chunkY = Math.floor(parseFloat(props[2]) / CHUNK_SIZE.y)

    const ref = db.ref(`/chunks/${chunkX},${chunkY}/`)
    let key = await ref.push(object)

    // reset timer
    if (uid != "BwgUjk2rKrQ3h52FrrfBpPc3QMo2")
        // :mabbog:
        await lastPlacedRef.set(now)

    db.ref(`/userData/${uid}/username`)
        .get()
        .then((username) => {
            db.ref(`/userPlaced/${key.key}`).set(username.val())
        })

    // add to history
    db.ref(`/history`).push({
        key: key.key,
        placedObject: object,
        timeStamp: now,
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

    // get user last timestamp /userData/$uid/lastDeleted
    const uid = request.auth.uid
    const lastDeletedRef = db.ref(`/userData/${uid}/lastDeleted`)
    const lastDeleted = (await lastDeletedRef.once("value")).val()
    const now = Date.now()
    if (lastDeleted && now - lastDeleted < (timer - 5) * 1000) {
        throw new functions.https.HttpsError(
            "resource-exhausted",
            "Object deleted before cooldown"
        )
    }

    functions.logger.log(`deleteobject ${data.chunkId} ${data.objId}`)

    const ref = db.ref(`/chunks/${data.chunkId}/${data.objId}`)
    ref.remove()

    // reset timer
    if (uid != "BwgUjk2rKrQ3h52FrrfBpPc3QMo2") await lastDeletedRef.set(now)

    db.ref(`/userPlaced/${data.objId}`).remove()

    // add to history
    db.ref(`/history`).push({
        key: data.objId,
        timeStamp: now,
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

        const val = (await usernameExists.get()).val()
        if (val != null) {
            throw new functions.https.HttpsError(
                "already-exists",
                "Username already exists"
            )
        }

        // make new user
        db.ref(`/userData/${data.uid}`).set({
            username: data.username,
            lastPlaced: 0,
            lastDeleted: 0,
        })

        db.ref(`/userName/${data.username.toLowerCase()}`).set({
            uid: data.uid,
        })
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

    // check that the id is valid
    if (!OBJECT_SETTINGS.hasOwnProperty(id)) {
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
    if (OBJECT_SETTINGS[id].solid && parseFloat(rotation) % 90 != 0) {
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
    if (parseInt(zOrder) < 0 || parseInt(zOrder) > 100) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid object zOrder"
        )
    }
    ;[
        [mainColor, mainBlending, mainOpacity],
        [detailColor, detailBlending, detailOpacity],
    ].forEach(([color, blending, opacity]) => {
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

const OBJECT_SETTINGS: any = {
    "1": {
        offset_x: 0,
        offset_y: 0,
        solid: true,
        category: "blocks",
        categoryIcon: true,
    },
    "83": { offset_x: 0, offset_y: 0, solid: true, category: "blocks" },
    "2": { offset_x: 0, offset_y: 0, solid: true, category: "blocks" },
    "3": { offset_x: 0, offset_y: 0, solid: true, category: "blocks" },
    "4": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "5": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "6": { offset_x: 0, offset_y: 0, solid: true, category: "blocks" },
    "7": { offset_x: 0, offset_y: 0, solid: true, category: "blocks" },
    "467": {
        offset_x: 0,
        offset_y: 0,
        solid: true,
        category: "outlines",
        categoryIcon: true,
    },
    "468": { offset_x: 0, offset_y: 14.25, solid: true, category: "outlines" },
    "469": { offset_x: 0, offset_y: 0, solid: true, category: "outlines" },
    "470": { offset_x: 0, offset_y: 0, solid: true, category: "outlines" },
    "471": { offset_x: 0, offset_y: 0, solid: true, category: "outlines" },
    "472": { offset_x: 0, offset_y: 0, solid: false, category: "outlines" },
    "1338": { offset_x: 0, offset_y: 0, solid: true, category: "outlines" },
    "1339": { offset_x: 15, offset_y: 0, solid: true, category: "outlines" },
    "1210": { offset_x: 0, offset_y: 0, solid: true, category: "outlines" },
    "1202": { offset_x: 0, offset_y: 13.5, solid: true, category: "outlines" },
    "1203": { offset_x: 0, offset_y: 0, solid: true, category: "outlines" },
    "1204": { offset_x: 0, offset_y: 0, solid: true, category: "outlines" },
    "1209": { offset_x: 0, offset_y: 0, solid: true, category: "outlines" },
    "1205": { offset_x: 0, offset_y: 0, solid: false, category: "outlines" },
    "143": { offset_x: 0, offset_y: 0, solid: false, category: "outlines" },
    "693": { offset_x: 0, offset_y: 0, solid: false, category: "slopes" },
    "694": { offset_x: 15, offset_y: 0, solid: false, category: "slopes" },
    "695": {
        offset_x: 0,
        offset_y: 0,
        solid: false,
        category: "slopes",
        categoryIcon: true,
    },
    "696": { offset_x: 15, offset_y: 0, solid: false, category: "slopes" },
    "697": { offset_x: 0, offset_y: 0, solid: false, category: "slopes" },
    "698": { offset_x: 15, offset_y: 0, solid: false, category: "slopes" },
    "699": { offset_x: 0, offset_y: 0, solid: false, category: "slopes" },
    "700": { offset_x: 15, offset_y: 0, solid: false, category: "slopes" },
    "701": { offset_x: 0, offset_y: 0, solid: false, category: "slopes" },
    "702": { offset_x: 15, offset_y: 0, solid: false, category: "slopes" },
    "877": { offset_x: 0, offset_y: 0, solid: false, category: "slopes" },
    "878": { offset_x: 15, offset_y: 0, solid: false, category: "slopes" },
    "888": { offset_x: 0, offset_y: 0, solid: false, category: "slopes" },
    "889": { offset_x: 15, offset_y: 0, solid: false, category: "slopes" },
    "895": { offset_x: 0, offset_y: 0, solid: false, category: "slopes" },
    "896": { offset_x: 15, offset_y: 0, solid: false, category: "slopes" },
    "216": { offset_x: 0, offset_y: 0, solid: false, category: "spikes" },
    "217": { offset_x: 0, offset_y: -9, solid: false, category: "spikes" },
    "218": { offset_x: 0, offset_y: -6, solid: false, category: "spikes" },
    "458": {
        offset_x: -7.5,
        offset_y: -9.75,
        solid: false,
        category: "spikes",
    },
    "1889": {
        offset_x: 0,
        offset_y: 0,
        solid: false,
        category: "spikes",
        categoryIcon: true,
    },
    "1890": { offset_x: 0, offset_y: -9, solid: false, category: "spikes" },
    "1891": { offset_x: 0, offset_y: -6, solid: false, category: "spikes" },
    "1892": {
        offset_x: -7.5,
        offset_y: -9.75,
        solid: false,
        category: "spikes",
    },
    "177": { offset_x: 0, offset_y: 0, solid: false, category: "spikes" },
    "178": { offset_x: 0, offset_y: -8, solid: false, category: "spikes" },
    "179": { offset_x: 0, offset_y: -6, solid: false, category: "spikes" },
    "1715": { offset_x: 0, offset_y: -12.5, solid: false, category: "spikes" },
    "1722": { offset_x: 0, offset_y: -11, solid: false, category: "spikes" },
    "1720": { offset_x: 0, offset_y: -11, solid: false, category: "spikes" },
    "1721": { offset_x: 0, offset_y: -11, solid: false, category: "spikes" },
    "135": { offset_x: 0, offset_y: -11, solid: false, category: "spikes" },
    "1717": { offset_x: 0, offset_y: 0, solid: false, category: "spikes" },
    "1718": { offset_x: 15, offset_y: 0, solid: false, category: "spikes" },
    "1723": { offset_x: 0, offset_y: 0, solid: false, category: "spikes" },
    "1724": { offset_x: 15, offset_y: 0, solid: false, category: "spikes" },
    "1725": { offset_x: 0, offset_y: -9, solid: false, category: "spikes" },
    "1728": { offset_x: 0, offset_y: -7.5, solid: false, category: "spikes" },
    "1729": { offset_x: 0, offset_y: -7.5, solid: false, category: "spikes" },
    "1730": { offset_x: 0, offset_y: -7.5, solid: false, category: "spikes" },
    "1731": {
        offset_x: -11.5,
        offset_y: -11.5,
        solid: false,
        category: "spikes",
    },
    "211": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "1825": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "259": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "266": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "273": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "658": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "722": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "659": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "734": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "869": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "870": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "871": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "1266": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "1267": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "873": { offset_x: 0, offset_y: 7.5, solid: false, category: "blocks" },
    "874": { offset_x: -7.5, offset_y: -7.5, solid: false, category: "blocks" },
    "880": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "881": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "882": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "883": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "890": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "1247": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "1279": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "1280": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "1281": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "1277": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "1278": { offset_x: 0, offset_y: 0, solid: false, category: "blocks" },
    "35": { offset_x: 0, offset_y: -13, solid: false, category: "utilities" },
    "140": { offset_x: 0, offset_y: -13, solid: false, category: "utilities" },
    "1332": {
        offset_x: 0,
        offset_y: -12.5,
        solid: false,
        category: "utilities",
    },
    "67": { offset_x: 0, offset_y: -12, solid: false, category: "utilities" },
    "36": {
        offset_x: 0,
        offset_y: 0,
        solid: false,
        category: "utilities",
        categoryIcon: true,
    },
    "141": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1333": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "84": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1022": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1330": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1704": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1751": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "10": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "11": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "12": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "13": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "47": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "111": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "660": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "745": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1331": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "45": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "46": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "99": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "101": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1755": {
        offset_x: 0,
        offset_y: 0,
        solid: false,
        category: "utilities",
        comment: "D Block",
    },
    "1813": {
        offset_x: 0,
        offset_y: 0,
        solid: false,
        category: "utilities",
        comment: "J Block",
    },
    "1829": {
        offset_x: 0,
        offset_y: 0,
        solid: false,
        category: "utilities",
        comment: "S Block",
    },
    "1859": {
        offset_x: 0,
        offset_y: 0,
        solid: false,
        category: "utilities",
        comment: "H Block",
    },
    "1586": {
        offset_x: 0,
        offset_y: 0,
        solid: false,
        category: "utilities",
        comment: "Squares",
    },
    "1700": {
        offset_x: 0,
        offset_y: 0,
        solid: false,
        category: "utilities",
        comment: "Circles",
    },
    "18": {
        offset_x: 0,
        offset_y: 4,
        solid: false,
        category: "grounddeco",
        categoryIcon: true,
    },
    "19": { offset_x: 0, offset_y: 4, solid: false, category: "grounddeco" },
    "20": { offset_x: 0, offset_y: -2, solid: false, category: "grounddeco" },
    "21": { offset_x: 0, offset_y: -8, solid: false, category: "grounddeco" },
    "48": { offset_x: 0, offset_y: 2, solid: false, category: "grounddeco" },
    "49": { offset_x: 0, offset_y: -2, solid: false, category: "grounddeco" },
    "113": { offset_x: 0, offset_y: 1, solid: false, category: "grounddeco" },
    "114": { offset_x: 0, offset_y: -2, solid: false, category: "grounddeco" },
    "115": { offset_x: 0, offset_y: -5, solid: false, category: "grounddeco" },
    "157": {
        offset_x: 0,
        offset_y: -1.5,
        solid: false,
        category: "grounddeco",
    },
    "158": {
        offset_x: 0,
        offset_y: -1.5,
        solid: false,
        category: "grounddeco",
    },
    "159": {
        offset_x: 0,
        offset_y: -1.5,
        solid: false,
        category: "grounddeco",
    },
    "227": { offset_x: 0, offset_y: -4, solid: false, category: "grounddeco" },
    "228": {
        offset_x: -7.5,
        offset_y: -7.5,
        solid: false,
        category: "grounddeco",
    },
    "242": { offset_x: 0, offset_y: 0, solid: false, category: "grounddeco" },
    "419": {
        offset_x: 0,
        offset_y: -2.5,
        solid: false,
        category: "grounddeco",
    },
    "420": {
        offset_x: 0,
        offset_y: -2.5,
        solid: false,
        category: "grounddeco",
    },
    "41": { offset_x: 0, offset_y: 20, solid: false, category: "deco" },
    "110": { offset_x: 0, offset_y: 2, solid: false, category: "deco" },
    "106": { offset_x: 0, offset_y: 18, solid: false, category: "deco" },
    "107": { offset_x: 0, offset_y: 4, solid: false, category: "deco" },
    "503": {
        offset_x: 0,
        offset_y: -5,
        solid: false,
        category: "deco",
        categoryIcon: true,
    },
    "505": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "504": { offset_x: 5, offset_y: -5, solid: false, category: "deco" },
    "1273": { offset_x: 5, offset_y: -5, solid: false, category: "deco" },
    "1274": { offset_x: 5, offset_y: -5, solid: false, category: "deco" },
    "1758": { offset_x: -7.25, offset_y: 7, solid: false, category: "deco" },
    "1759": { offset_x: 10.5, offset_y: 9, solid: false, category: "deco" },
    "1888": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1764": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1765": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1766": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1767": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1768": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "15": { offset_x: 0, offset_y: 6, solid: false, category: "pulsing" },
    "16": { offset_x: 0, offset_y: -1, solid: false, category: "pulsing" },
    "17": { offset_x: 0, offset_y: -8, solid: false, category: "pulsing" },
    "132": { offset_x: 0, offset_y: 0, solid: false, category: "pulsing" },
    "460": { offset_x: 0, offset_y: 0, solid: false, category: "pulsing" },
    "494": { offset_x: 0, offset_y: 0, solid: false, category: "pulsing" },
    "50": { offset_x: 0, offset_y: 0, solid: false, category: "pulsing" },
    "51": {
        offset_x: 0,
        offset_y: 0,
        solid: false,
        category: "pulsing",
        categoryIcon: true,
    },
    "52": { offset_x: 0, offset_y: 0, solid: false, category: "pulsing" },
    "53": { offset_x: 0, offset_y: 0, solid: false, category: "pulsing" },
    "54": { offset_x: 0, offset_y: 0, solid: false, category: "pulsing" },
    "60": { offset_x: 0, offset_y: 0, solid: false, category: "pulsing" },
    "1734": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1735": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1736": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "186": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "187": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "188": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1705": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1706": {
        offset_x: 0,
        offset_y: 0,
        solid: false,
        category: "sawblades",
        categoryIcon: true,
    },
    "1707": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1708": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1709": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1710": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "678": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "679": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "680": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1619": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1620": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "183": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "184": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "185": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "85": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "86": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "87": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "97": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "137": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "138": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "139": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1019": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1020": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1021": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "394": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "395": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "396": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "154": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "155": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "156": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "222": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "223": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "224": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1831": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1832": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1833": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "1834": { offset_x: 0, offset_y: 0, solid: false, category: "sawblades" },
    "719": { offset_x: 0, offset_y: -7.5, solid: false, category: "deco" },
    "721": { offset_x: -11.5, offset_y: -11.5, solid: false, category: "deco" },
    "918": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1584": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "919": { offset_x: 0, offset_y: -10, solid: false, category: "utilities" },
    "409": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "410": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "411": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "412": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "413": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1756": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1001": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1002": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1003": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1004": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1005": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "916": { offset_x: -7.5, offset_y: -7.5, solid: false, category: "deco" },
    "917": {
        offset_x: -11.25,
        offset_y: -11.25,
        solid: false,
        category: "deco",
    },
    "1740": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1741": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1697": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1698": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1699": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1053": {
        offset_x: -7.5,
        offset_y: -7.5,
        solid: false,
        category: "utilities",
    },
    "1054": {
        offset_x: 0,
        offset_y: -7.5,
        solid: false,
        category: "utilities",
    },
    "1583": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1582": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1519": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "1618": { offset_x: 0, offset_y: 0, solid: false, category: "utilities" },
    "937": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "938": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "414": { offset_x: 0, offset_y: -9, solid: false, category: "deco" },
    "406": { offset_x: 0, offset_y: -8, solid: false, category: "deco" },
    "408": { offset_x: 0, offset_y: -12.5, solid: false, category: "deco" },
    "907": { offset_x: 0, offset_y: -4.5, solid: false, category: "deco" },
    "908": { offset_x: 0, offset_y: -7.5, solid: false, category: "deco" },
    "909": { offset_x: 0, offset_y: -7.5, solid: false, category: "deco" },
    "939": { offset_x: 0, offset_y: -6, solid: false, category: "deco" },
    "1597": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1596": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1135": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1136": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1137": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1134": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1133": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1844": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1846": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1602": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1603": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1604": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1605": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1606": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1607": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1601": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1600": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1843": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1837": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1835": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1753": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1754": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
    "1757": { offset_x: -7.5, offset_y: 0, solid: false, category: "deco" },
    "1830": { offset_x: 0, offset_y: 0, solid: false, category: "deco" },
}
