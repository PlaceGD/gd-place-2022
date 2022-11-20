import { database } from "./init.js"

await database.ref(`/editorState/eventEnded`).set(true)

// some time 1 year in the future
await database.ref(`/editorState/eventStart`).set(1700482488)

process.exit()
