import prompt from "prompt-sync";

let input = prompt({ sigint: true });

import { database } from "./init.js";

let username = process.argv[2]

if (!username) {
    username = input("Enter username: ")
}

let usernames = username.split(",")

for(let u of usernames) {
    let user = await database.ref(`/userName/${u.trim().toLowerCase()}`).get();

    if (user.val() === null) {
        console.error("username doesnt exist!")
        throw new Error()
    }

    await database.ref(`/bannedUsers/${user.val().uid}`).set(true)
}

process.exit()