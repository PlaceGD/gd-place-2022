// read history.json
// sort by timestamp

import fs from "fs"

const history = Object.values(JSON.parse(fs.readFileSync("history.json")))
console.log(history.length)

const sorted = history.sort((a, b) => a.timestamp - b.timestamp)

let objects = {}

sorted.forEach((item) => {
    if (item.placedObject) {
        objects[item.key] = [item.placedObject, item.timeStamp]
    } else {
        delete objects[item.key]
    }
})

// sort values by timestamp
const sortedObjects = Object.values(objects)
    .sort((a, b) => a[1] - b[1])
    .map((item) => item[0])

let z_layers = {}

sortedObjects.forEach((item) => {
    let [
        id,
        x,
        y,
        rotation,
        flip,
        scale,
        zOrder,
        mainColor,
        mainBlending,
        mainOpacity,
        detailColor,
        detailBlending,
        detailOpacity,
    ] = item.split(";")

    if (!z_layers[zOrder]) {
        z_layers[zOrder] = [item]
    } else {
        z_layers[zOrder].push(item)
    }
})

// sort z_layers by key
const sortedZLayers = Object.entries(z_layers)
    .sort((a, b) => a[0] - b[0])
    .map((item) => item[1])

// reset zOrder values
let zOrder = -60000
let all_objects = []
sortedZLayers.forEach((layer, l) => {
    layer.forEach((item, i) => {
        let [
            id,
            x,
            y,
            rotation,
            flip,
            scale,
            _,
            mainColor,
            mainBlending,
            mainOpacity,
            detailColor,
            detailBlending,
            detailOpacity,
        ] = item.split(";")

        all_objects.push(
            [
                id,
                x,
                y,
                rotation,
                flip,
                scale,
                zOrder,
                mainColor,
                mainBlending,
                mainOpacity,
                detailColor,
                detailBlending,
                detailOpacity,
            ].join(";")
        )
        if (zOrder == -1) {
            zOrder = 0
        }
        zOrder += 1
    })
})

// store objects in ordered_objects.txt
fs.writeFileSync("ordered_objects.txt", all_objects.join("\n"))
