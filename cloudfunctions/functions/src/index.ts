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

const OBJECT_SETTINGS = {
    "1": { offset_x: 0, offset_y: 0, solid: true },
    "83": { offset_x: 0, offset_y: 0, solid: true },
    "2": { offset_x: 0, offset_y: 0, solid: true },
    "3": { offset_x: 0, offset_y: 0, solid: true },
    "4": { offset_x: 0, offset_y: 0, solid: false },
    "5": { offset_x: 0, offset_y: 0, solid: false },
    "6": { offset_x: 0, offset_y: 0, solid: true },
    "7": { offset_x: 0, offset_y: 0, solid: true },
    "467": { offset_x: 0, offset_y: 0, solid: true },
    "468": { offset_x: 0, offset_y: 14.25, solid: true },
    "469": { offset_x: 0, offset_y: 0, solid: true },
    "470": { offset_x: 0, offset_y: 0, solid: true },
    "471": { offset_x: 0, offset_y: 0, solid: true },
    "472": { offset_x: 0, offset_y: 0, solid: false },
    "1338": { offset_x: 0, offset_y: 0, solid: true },
    "1339": { offset_x: 15, offset_y: 0, solid: true },
    "1210": { offset_x: 0, offset_y: 0, solid: true },
    "1202": { offset_x: 0, offset_y: 13.5, solid: true },
    "1203": { offset_x: 0, offset_y: 0, solid: true },
    "1204": { offset_x: 0, offset_y: 0, solid: true },
    "1209": { offset_x: 0, offset_y: 0, solid: true },
    "1205": { offset_x: 0, offset_y: 0, solid: false },
    "216": { offset_x: 0, offset_y: 0, solid: false },
    "217": { offset_x: 0, offset_y: -9, solid: false },
    "218": { offset_x: 0, offset_y: -6, solid: false },
    "458": { offset_x: -7.5, offset_y: -9.75, solid: false },
    "1889": { offset_x: 0, offset_y: 0, solid: false },
    "1890": { offset_x: 0, offset_y: -9, solid: false },
    "1891": { offset_x: 0, offset_y: -6, solid: false },
    "1892": { offset_x: -7.5, offset_y: -9.75, solid: false },
    "177": { offset_x: 0, offset_y: 0, solid: false },
    "178": { offset_x: 0, offset_y: -8, solid: false },
    "179": { offset_x: 0, offset_y: -6, solid: false },
    "1715": { offset_x: 0, offset_y: -12.5, solid: false },
    "1722": { offset_x: 0, offset_y: -11, solid: false },
    "1720": { offset_x: 0, offset_y: -11, solid: false },
    "1721": { offset_x: 0, offset_y: -11, solid: false },
    "135": { offset_x: 0, offset_y: -11, solid: false },
    "1717": { offset_x: 0, offset_y: 0, solid: false },
    "1718": { offset_x: 15, offset_y: 0, solid: false },
    "1723": { offset_x: 0, offset_y: 0, solid: false },
    "1724": { offset_x: 15, offset_y: 0, solid: false },
    "1725": { offset_x: 0, offset_y: -9, solid: false },
    "1728": { offset_x: 0, offset_y: -7.5, solid: false },
    "1729": { offset_x: 0, offset_y: -7.5, solid: false },
    "1730": { offset_x: 0, offset_y: -7.5, solid: false },
    "1731": { offset_x: -11.5, offset_y: -11.5, solid: false },
    "211": { offset_x: 0, offset_y: 0, solid: false },
    "1825": { offset_x: 0, offset_y: 0, solid: false },
    "259": { offset_x: 0, offset_y: 0, solid: false },
    "266": { offset_x: 0, offset_y: 0, solid: false },
    "273": { offset_x: 0, offset_y: 0, solid: false },
    "658": { offset_x: 0, offset_y: 0, solid: false },
    "722": { offset_x: 0, offset_y: 0, solid: false },
    "659": { offset_x: 0, offset_y: 0, solid: false },
    "734": { offset_x: 0, offset_y: 0, solid: false },
    "869": { offset_x: 0, offset_y: 0, solid: false },
    "870": { offset_x: 0, offset_y: 0, solid: false },
    "871": { offset_x: 0, offset_y: 0, solid: false },
    "1266": { offset_x: 0, offset_y: 0, solid: false },
    "1267": { offset_x: 0, offset_y: 0, solid: false },
    "873": { offset_x: 0, offset_y: 7.5, solid: false },
    "874": { offset_x: -7.5, offset_y: -7.5, solid: false },
    "880": { offset_x: 0, offset_y: 0, solid: false },
    "881": { offset_x: 0, offset_y: 0, solid: false },
    "882": { offset_x: 0, offset_y: 0, solid: false },
    "883": { offset_x: 0, offset_y: 0, solid: false },
    "890": { offset_x: 0, offset_y: 0, solid: false },
    "1247": { offset_x: 0, offset_y: 0, solid: false },
    "1279": { offset_x: 0, offset_y: 0, solid: false },
    "1280": { offset_x: 0, offset_y: 0, solid: false },
    "1281": { offset_x: 0, offset_y: 0, solid: false },
    "1277": { offset_x: 0, offset_y: 0, solid: false },
    "1278": { offset_x: 0, offset_y: 0, solid: false },
    "693": { offset_x: 0, offset_y: 0, solid: false },
    "694": { offset_x: 15, offset_y: 0, solid: false },
    "695": { offset_x: 0, offset_y: 0, solid: false },
    "696": { offset_x: 15, offset_y: 0, solid: false },
    "697": { offset_x: 0, offset_y: 0, solid: false },
    "698": { offset_x: 15, offset_y: 0, solid: false },
    "699": { offset_x: 0, offset_y: 0, solid: false },
    "700": { offset_x: 15, offset_y: 0, solid: false },
    "701": { offset_x: 0, offset_y: 0, solid: false },
    "702": { offset_x: 15, offset_y: 0, solid: false },
    "877": { offset_x: 0, offset_y: 0, solid: false },
    "878": { offset_x: 15, offset_y: 0, solid: false },
    "888": { offset_x: 0, offset_y: 0, solid: false },
    "889": { offset_x: 15, offset_y: 0, solid: false },
    "895": { offset_x: 0, offset_y: 0, solid: false },
    "896": { offset_x: 15, offset_y: 0, solid: false },
    "35": { offset_x: 0, offset_y: -13, solid: false },
    "140": { offset_x: 0, offset_y: -13, solid: false },
    "1332": { offset_x: 0, offset_y: -12.5, solid: false },
    "67": { offset_x: 0, offset_y: -12, solid: false },
    "36": { offset_x: 0, offset_y: 0, solid: false },
    "141": { offset_x: 0, offset_y: 0, solid: false },
    "1333": { offset_x: 0, offset_y: 0, solid: false },
    "84": { offset_x: 0, offset_y: 0, solid: false },
    "1022": { offset_x: 0, offset_y: 0, solid: false },
    "1330": { offset_x: 0, offset_y: 0, solid: false },
    "1704": { offset_x: 0, offset_y: 0, solid: false },
    "1751": { offset_x: 0, offset_y: 0, solid: false },
    "10": { offset_x: 0, offset_y: 0, solid: false },
    "11": { offset_x: 0, offset_y: 0, solid: false },
    "12": { offset_x: 0, offset_y: 0, solid: false },
    "13": { offset_x: 0, offset_y: 0, solid: false },
    "47": { offset_x: 0, offset_y: 0, solid: false },
    "111": { offset_x: 0, offset_y: 0, solid: false },
    "660": { offset_x: 0, offset_y: 0, solid: false },
    "745": { offset_x: 0, offset_y: 0, solid: false },
    "1331": { offset_x: 0, offset_y: 0, solid: false },
    "45": { offset_x: 0, offset_y: 0, solid: false },
    "46": { offset_x: 0, offset_y: 0, solid: false },
    "99": { offset_x: 0, offset_y: 0, solid: false },
    "101": { offset_x: 0, offset_y: 0, solid: false },
    "1755": { offset_x: 0, offset_y: 0, solid: false },
    "1813": { offset_x: 0, offset_y: 0, solid: false },
    "1829": { offset_x: 0, offset_y: 0, solid: false },
    "1859": { offset_x: 0, offset_y: 0, solid: false },
    "1586": { offset_x: 0, offset_y: 0, solid: false },
    "1700": { offset_x: 0, offset_y: 0, solid: false },
    "503": { offset_x: 0, offset_y: -5, solid: false },
    "505": { offset_x: 0, offset_y: 0, solid: false },
    "504": { offset_x: 5, offset_y: -5, solid: false },
    "1273": { offset_x: 5, offset_y: -5, solid: false },
    "1274": { offset_x: 5, offset_y: -5, solid: false },
    "1758": { offset_x: -7.25, offset_y: 7, solid: false },
    "1759": { offset_x: 10.5, offset_y: 9, solid: false },
    "1888": { offset_x: 0, offset_y: 0, solid: false },
    "1734": { offset_x: 0, offset_y: 0, solid: false },
    "1735": { offset_x: 0, offset_y: 0, solid: false },
    "1736": { offset_x: 0, offset_y: 0, solid: false },
    "186": { offset_x: 0, offset_y: 0, solid: false },
    "187": { offset_x: 0, offset_y: 0, solid: false },
    "188": { offset_x: 0, offset_y: 0, solid: false },
    "1705": { offset_x: 0, offset_y: 0, solid: false },
    "1706": { offset_x: 0, offset_y: 0, solid: false },
    "1707": { offset_x: 0, offset_y: 0, solid: false },
    "1708": { offset_x: 0, offset_y: 0, solid: false },
    "1709": { offset_x: 0, offset_y: 0, solid: false },
    "1710": { offset_x: 0, offset_y: 0, solid: false },
    "678": { offset_x: 0, offset_y: 0, solid: false },
    "679": { offset_x: 0, offset_y: 0, solid: false },
    "680": { offset_x: 0, offset_y: 0, solid: false },
    "1619": { offset_x: 0, offset_y: 0, solid: false },
    "1620": { offset_x: 0, offset_y: 0, solid: false },
    "183": { offset_x: 0, offset_y: 0, solid: false },
    "184": { offset_x: 0, offset_y: 0, solid: false },
    "185": { offset_x: 0, offset_y: 0, solid: false },
    "85": { offset_x: 0, offset_y: 0, solid: false },
    "86": { offset_x: 0, offset_y: 0, solid: false },
    "87": { offset_x: 0, offset_y: 0, solid: false },
    "97": { offset_x: 0, offset_y: 0, solid: false },
    "137": { offset_x: 0, offset_y: 0, solid: false },
    "138": { offset_x: 0, offset_y: 0, solid: false },
    "139": { offset_x: 0, offset_y: 0, solid: false },
    "1019": { offset_x: 0, offset_y: 0, solid: false },
    "1020": { offset_x: 0, offset_y: 0, solid: false },
    "1021": { offset_x: 0, offset_y: 0, solid: false },
    "394": { offset_x: 0, offset_y: 0, solid: false },
    "395": { offset_x: 0, offset_y: 0, solid: false },
    "396": { offset_x: 0, offset_y: 0, solid: false },
    "154": { offset_x: 0, offset_y: 0, solid: false },
    "155": { offset_x: 0, offset_y: 0, solid: false },
    "156": { offset_x: 0, offset_y: 0, solid: false },
    "222": { offset_x: 0, offset_y: 0, solid: false },
    "223": { offset_x: 0, offset_y: 0, solid: false },
    "224": { offset_x: 0, offset_y: 0, solid: false },
    "1831": { offset_x: 0, offset_y: 0, solid: false },
    "1832": { offset_x: 0, offset_y: 0, solid: false },
    "1833": { offset_x: 0, offset_y: 0, solid: false },
    "1834": { offset_x: 0, offset_y: 0, solid: false },
    "48": { offset_x: 0, offset_y: 2, solid: false },
    "49": { offset_x: 0, offset_y: -2, solid: false },
    "113": { offset_x: 0, offset_y: 1, solid: false },
    "114": { offset_x: 0, offset_y: -2, solid: false },
    "115": { offset_x: 0, offset_y: -5, solid: false },
    "18": { offset_x: 0, offset_y: 4, solid: false },
    "19": { offset_x: 0, offset_y: 4, solid: false },
    "20": { offset_x: 0, offset_y: -2, solid: false },
    "21": { offset_x: 0, offset_y: -8, solid: false },
    "157": { offset_x: 0, offset_y: -1.5, solid: false },
    "158": { offset_x: 0, offset_y: -1.5, solid: false },
    "159": { offset_x: 0, offset_y: -1.5, solid: false },
    "227": { offset_x: 0, offset_y: -4, solid: false },
    "228": { offset_x: -7.5, offset_y: -7.5, solid: false },
    "242": { offset_x: 0, offset_y: 0, solid: false },
    "419": { offset_x: 0, offset_y: -2.5, solid: false },
    "420": { offset_x: 0, offset_y: -2.5, solid: false },
    "719": { offset_x: 0, offset_y: -7.5, solid: false },
    "721": { offset_x: -11.5, offset_y: -11.5, solid: false },
    "918": { offset_x: 0, offset_y: 0, solid: false },
    "1584": { offset_x: 0, offset_y: 0, solid: false },
    "919": { offset_x: 0, offset_y: -10, solid: false },
    "409": { offset_x: 0, offset_y: 0, solid: false },
    "410": { offset_x: 0, offset_y: 0, solid: false },
    "411": { offset_x: 0, offset_y: 0, solid: false },
    "412": { offset_x: 0, offset_y: 0, solid: false },
    "413": { offset_x: 0, offset_y: 0, solid: false },
    "1756": { offset_x: 0, offset_y: 0, solid: false },
    "1001": { offset_x: 0, offset_y: 0, solid: false },
    "1002": { offset_x: 0, offset_y: 0, solid: false },
    "1003": { offset_x: 0, offset_y: 0, solid: false },
    "1004": { offset_x: 0, offset_y: 0, solid: false },
    "1005": { offset_x: 0, offset_y: 0, solid: false },
    "916": { offset_x: -7.5, offset_y: -7.5, solid: false },
    "917": { offset_x: -11.25, offset_y: -11.25, solid: false },
    "1740": { offset_x: 0, offset_y: 0, solid: false },
    "1741": { offset_x: 0, offset_y: 0, solid: false },
    "1697": { offset_x: 0, offset_y: 0, solid: false },
    "1698": { offset_x: 0, offset_y: 0, solid: false },
    "1699": { offset_x: 0, offset_y: 0, solid: false },
    "1053": { offset_x: -7.5, offset_y: -7.5, solid: false },
    "1054": { offset_x: 0, offset_y: -7.5, solid: false },
    "1583": { offset_x: 0, offset_y: 0, solid: false },
    "1582": { offset_x: 0, offset_y: 0, solid: false },
    "937": { offset_x: 0, offset_y: 0, solid: false },
    "938": { offset_x: 0, offset_y: 0, solid: false },
    "414": { offset_x: 0, offset_y: -9, solid: false },
    "406": { offset_x: 0, offset_y: -8, solid: false },
    "408": { offset_x: 0, offset_y: -12.5, solid: false },
    "907": { offset_x: 0, offset_y: -4.5, solid: false },
    "908": { offset_x: 0, offset_y: -7.5, solid: false },
    "909": { offset_x: 0, offset_y: -7.5, solid: false },
    "939": { offset_x: 0, offset_y: -6, solid: false },
    "1597": { offset_x: 0, offset_y: 0, solid: false },
    "1596": { offset_x: 0, offset_y: 0, solid: false },
    "1135": { offset_x: 0, offset_y: 0, solid: false },
    "1136": { offset_x: 0, offset_y: 0, solid: false },
    "1137": { offset_x: 0, offset_y: 0, solid: false },
    "1134": { offset_x: 0, offset_y: 0, solid: false },
    "1133": { offset_x: 0, offset_y: 0, solid: false },
    "1844": { offset_x: 0, offset_y: 0, solid: false },
    "1846": { offset_x: 0, offset_y: 0, solid: false },
    "1602": { offset_x: 0, offset_y: 0, solid: false },
    "1603": { offset_x: 0, offset_y: 0, solid: false },
    "1604": { offset_x: 0, offset_y: 0, solid: false },
    "1605": { offset_x: 0, offset_y: 0, solid: false },
    "1606": { offset_x: 0, offset_y: 0, solid: false },
    "1607": { offset_x: 0, offset_y: 0, solid: false },
    "1601": { offset_x: 0, offset_y: 0, solid: false },
    "1600": { offset_x: 0, offset_y: 0, solid: false },
    "1843": { offset_x: 0, offset_y: 0, solid: false },
    "1519": { offset_x: 0, offset_y: 0, solid: false },
    "1618": { offset_x: 0, offset_y: 0, solid: false },
    "1837": { offset_x: 0, offset_y: 0, solid: false },
    "1835": { offset_x: 0, offset_y: 0, solid: false },
    "1753": { offset_x: 0, offset_y: 0, solid: false },
    "1754": { offset_x: 0, offset_y: 0, solid: false },
    "1757": { offset_x: -7.5, offset_y: 0, solid: false },
    "1830": { offset_x: 0, offset_y: 0, solid: false },
    "1764": { offset_x: 0, offset_y: 0, solid: false },
    "1765": { offset_x: 0, offset_y: 0, solid: false },
    "1766": { offset_x: 0, offset_y: 0, solid: false },
    "1767": { offset_x: 0, offset_y: 0, solid: false },
    "1768": { offset_x: 0, offset_y: 0, solid: false },
    "15": { offset_x: 0, offset_y: 6, solid: false },
    "16": { offset_x: 0, offset_y: -1, solid: false },
    "17": { offset_x: 0, offset_y: -8, solid: false },
    "132": { offset_x: 0, offset_y: 0, solid: false },
    "460": { offset_x: 0, offset_y: 0, solid: false },
    "494": { offset_x: 0, offset_y: 0, solid: false },
    "50": { offset_x: 0, offset_y: 0, solid: false },
    "51": { offset_x: 0, offset_y: 0, solid: false },
    "52": { offset_x: 0, offset_y: 0, solid: false },
    "53": { offset_x: 0, offset_y: 0, solid: false },
    "54": { offset_x: 0, offset_y: 0, solid: false },
    "60": { offset_x: 0, offset_y: 0, solid: false },
}
