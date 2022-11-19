import { database } from "./init.js"

import prompt from "prompt-sync"

let input = prompt({ sigint: true })

let stream = input("Enter stream link: ")

await database.ref(`/officialStreamLink/`).set(stream)

process.exit()
