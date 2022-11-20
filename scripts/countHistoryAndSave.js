import { database } from "./init.js"
import fs from "fs";

let totalDeleted = 0
let totalPlaced = 0

await database.ref(`/history/`).once("value", (snapshot) => {
    fs.writeFileSync("history.json", JSON.stringify(snapshot.toJSON()), (err) => {
        if (err) {
            console.error(err)
        }
    })

    for(let [_, v] of Object.entries(snapshot.val())) {
        if(v.hasOwnProperty("placedObject")) {
            totalPlaced += 1
        }
        else {
            totalDeleted += 1
        }
    }
})

await database.ref(`/totalPlaced/`).set(totalPlaced)
await database.ref(`/totalDeleted/`).set(totalDeleted)

process.exit()