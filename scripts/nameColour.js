import { app } from "./init.js"

import { getFunctions, httpsCallable } from "firebase/functions"

const username = process.argv[2]
const colours = process.argv.slice(0, process.argv.length)

colours.map((c) => c.replace("#", "").replace(",", "").trim())

const functions = getFunctions(app)
export const placeObject = httpsCallable(functions, "placeObject")
