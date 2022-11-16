import { onValue, ref } from "firebase/database"
import { database } from "../firebase/init"
import { clamp } from "../utils/math"
import { x_to_time } from "./app"

let BG_CHANGES = [{ fade: 0, x: 1, color: [100, 100, 100] }]
let GROUND_CHANGES = [{ fade: 0, x: 1, color: [100, 100, 100] }]

onValue(ref(database, "colors/BG_CHANGES"), (snapshot) => {
    const data: string = snapshot.val()
    // replace words with quoted words
    const changes = data
        .replace(/fade/g, '"fade"')
        .replace(/x/g, '"x"')
        .replace(/color/g, '"color"')

    BG_CHANGES = JSON.parse(changes)
})
// ok

onValue(ref(database, "colors/GROUND_CHANGES"), (snapshot) => {
    const data: string = snapshot.val()
    // replace words with quoted words
    const changes = data
        .replace(/fade/g, '"fade"')
        .replace(/x/g, '"x"')
        .replace(/color/g, '"color"')
    GROUND_CHANGES = JSON.parse(changes)
})

// sort by x
BG_CHANGES.sort((a, b) => a.x - b.x)
GROUND_CHANGES.sort((a, b) => a.x - b.x)

function getColor(time: number, changes: any) {
    let color = [0, 0, 0]
    for (let i = 0; i <= changes.length; i++) {
        const colorChange = changes[i]
        const nextTime = x_to_time(changes[i + 1]?.x ?? Infinity)

        let current_time = Math.min(time, nextTime)

        let blend
        if (colorChange.fade === 0) blend = 1
        else
            blend = (current_time - x_to_time(colorChange.x)) / colorChange.fade
        blend = clamp(blend, 0, 1)

        color = [
            color[0] * (1 - blend) + colorChange.color[0] * blend,
            color[1] * (1 - blend) + colorChange.color[1] * blend,
            color[2] * (1 - blend) + colorChange.color[2] * blend,
        ]
        if (time < nextTime) break
    }

    return [color[0] / 255, color[1] / 255, color[2] / 255]
}

export function getColors(time: number) {
    const a = {
        bg: getColor(time, BG_CHANGES),
        ground: getColor(time, GROUND_CHANGES),
    }

    return a
}

function hexToRgb(hex: string) {
    const bigint = parseInt(hex, 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255

    return [r / 255, g / 255, b / 255]
}
