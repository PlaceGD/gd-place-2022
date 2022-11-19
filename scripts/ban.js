import { database } from "./init.js";

const username = process.argv[2]

let user = await database.ref(`/userName/${username.toLowerCase()}`).get();

if (user.val() === null) {
    console.error("username doesnt exist!")
    throw new Error()
}

await database.ref(`/bannedUsers/${user.val().uid}`).set(true)

process.exit()