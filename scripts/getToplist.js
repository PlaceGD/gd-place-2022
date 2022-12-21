import fs from "fs"

const history = Object.values(JSON.parse(fs.readFileSync("history.json")))
console.log(history.length)

let deleted = {}
let placed = {}

history.forEach((item) => {
    if (item.placedObject) {
        if (placed[item.username]) {
            placed[item.username] += 1
        } else {
            placed[item.username] = 1
        }
    } else {
        if (deleted[item.username]) {
            deleted[item.username] += 1
        } else {
            deleted[item.username] = 1
        }
    }
})

const sortedPlaced = Object.entries(placed)
    .sort((a, b) => b[1] - a[1])


// print top 10
sortedPlaced.slice(0, 100).forEach((item) => {
    console.log(item[0], item[1])
})

// count how many people placed 1 object, 2 objects, 3 objects, etc.
const placedCount = {}
sortedPlaced.forEach((item) => {
    if (placedCount[item[1]]) {
        placedCount[item[1]] += 1
    } else {
        placedCount[item[1]] = 1
    }
})

console.log("0", 14010 - sortedPlaced.length)

// print how many people placed 1 object, 2 objects, 3 objects, etc.
for (let i = 1; i < 20; i++) {
    console.log(i, placedCount[i] || 0)
}

let sum = 0
Object.entries(placedCount).forEach((item) => {
    if (item[0] >= 20)
        sum += item[1]
})

console.log("20+", sum)
