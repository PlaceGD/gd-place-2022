import prompt from "prompt-sync";

let input = prompt({ sigint: true });

import { database } from "./init.js";

const username = process.argv[2]
let colours = input("Enter colours: ")

colours = colours.replaceAll("#", "").replaceAll(", ", " ").replaceAll(",", " ").trim()

let exists = await database.ref(`userName/${username.toLowerCase()}`).get();

if (exists.val() === null) {
    console.error("username doesnt exist!")
    throw new Error()
}

await database.ref(`userName/${username.toLowerCase()}/displayColor`).set(colours)

process.exit()