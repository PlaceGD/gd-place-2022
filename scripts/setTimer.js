import { database } from "./init.js"

const username = process.argv[2]
const timer = process.argv[3]
const newTimer = process.argv[4]

if (!["placeTimer", "deleteTimer"].includes(timer)) {
    console.error("timer doesnt exist!")
    throw new Error()
}

if (username === "*") {
    await database.ref(`/editorState/${timer}`).set(newTimer)
} else {
    let user = await database.ref(`/userName/${username.toLowerCase()}`).get()
    if (user.val() === null) {
        console.error("username doesnt exist!")
        throw new Error()
    }
    await database.ref(`/userData/${user.val().uid}/${timer}`).set(newTimer)
}

process.exit()
