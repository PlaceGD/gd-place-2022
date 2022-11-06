import { clamp } from "../utils/math"
import { x_to_time } from "./app"

let BG_CHANGES = [
    { fade: 0, x: 1, color: [0, 0, 0] },
    { fade: 3, x: 61, color: [0, 33, 51] },
    { fade: 1, x: 1411, color: [0, 0, 0] },
    { fade: 0.1, x: 1831, color: [143, 22, 43] },
    { fade: 2, x: 2041, color: [0, 0, 0] },
    { fade: 0.1, x: 2281, color: [131, 54, 147] },
    { fade: 2, x: 2491, color: [0, 0, 0] },
    { fade: 0.1, x: 2761, color: [41, 111, 77] },
    { fade: 2, x: 2971, color: [0, 0, 0] },
    { fade: 0.1, x: 3211, color: [41, 111, 77] },
    { fade: 2, x: 3421, color: [0, 0, 0] },
    { fade: 0.3, x: 4561, color: [15, 80, 45] },
    { fade: 3, x: 5565, color: [0, 0, 0] },
    { fade: 0.3, x: 6421, color: [60, 29, 9] },
    { fade: 3, x: 7425, color: [0, 0, 0] },
    { fade: 0.3, x: 8251, color: [83, 22, 52] },
    { fade: 3, x: 9255, color: [0, 0, 0] },
    { fade: 0.3, x: 10111, color: [80, 3, 0] },
    { fade: 3, x: 11115, color: [0, 0, 0] },
    { fade: 1, x: 15697, color: [14, 24, 41] },
]
let GROUND_CHANGES = [
    { fade: 0, x: 1, color: [7, 7, 7] },
    { fade: 3, x: 61, color: [0, 41, 63] },
    { fade: 1, x: 1411, color: [7, 7, 7] },
    { fade: 0.1, x: 1831, color: [93, 21, 25] },
    { fade: 2, x: 2041, color: [7, 7, 7] },
    { fade: 0.1, x: 2281, color: [101, 42, 108] },
    { fade: 2, x: 2491, color: [7, 7, 7] },
    { fade: 0.1, x: 2761, color: [63, 163, 113] },
    { fade: 2, x: 2971, color: [7, 7, 7] },
    { fade: 0.1, x: 3211, color: [63, 163, 113] },
    { fade: 2, x: 3421, color: [7, 7, 7] },
    { fade: 0.2, x: 4351, color: [165, 0, 0] },
    { fade: 0.3, x: 4561, color: [0, 165, 51] },
    { fade: 3, x: 5565, color: [7, 7, 7] },
    { fade: 0.3, x: 6421, color: [165, 96, 0] },
    { fade: 3, x: 7425, color: [7, 7, 7] },
    { fade: 0.3, x: 8251, color: [151, 33, 110] },
    { fade: 3, x: 9255, color: [7, 7, 7] },
    { fade: 0.3, x: 10111, color: [146, 0, 5] },
    { fade: 3, x: 11115, color: [7, 7, 7] },
    { fade: 3, x: 15697, color: [17, 21, 31] },
]

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
