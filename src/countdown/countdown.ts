import type { Sprite } from "pixi.js"
import * as PIXI from "pixi.js"

export const OBJECTS = [1, 2, 3, 4, 5, 6, 7]

export function randomTexture() {
    let num = Math.floor(Math.random() * (OBJECTS.length - 1) + 1) // The maximum is exclusive and the minimum is inclusive
    return PIXI.Texture.from(`/gd/objects/main/${num}.png`)
}

// export class Line extends PIXI.Container {
//     public size: number = 0
//     orientation: 0 | 1 = 0 // 0 = horizontal, 1 = vertical
//     sprites: Sprite[] = []

//     constructor(app, size, orientation) {
//         super()

//         this.size = size
//         this.orientation = orientation

//         for (let i = 0; i <= size; i++) {
//             this.sprites[i] = new PIXI.Sprite(randomTexture())
//             //this.addChild(sprites[i])
//         }
//     }

//     updateSprites(app) {
//         this.sprites.map((s) => {
//             s.texture = randomTexture()
//         })
//     }

//     draw(x, y) {
//         this.sprites.map((s) => {
//             s.position.set(x, y)
//         })
//     }
// }
