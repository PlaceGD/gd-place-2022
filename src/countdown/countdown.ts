import type { Sprite } from "pixi.js"
import * as PIXI from "pixi.js"
import { vec } from "../utils/vector"

import type { EditorNode } from "../editor/nodes"
import { onValue, ref } from "firebase/database"
import { database } from "../firebase/init"
import { getObjSettings } from "../editor/object"
import { writable } from "svelte/store"

export const OBJECTS = [1, 2, 3, 4, 5, 6, 7]

export function randomTexture() {
    let num = Math.floor(Math.random() * (OBJECTS.length - 1) + 1) // The maximum is exclusive and the minimum is inclusive
    return PIXI.Texture.from(`/gd/objects/main/${num}.png`)
}

export let eventStart = null
export let eventStartWritable = writable(null)
onValue(ref(database, "editorState/eventStart"), (snapshot) => {
    eventStart = snapshot.val()

    if (eventStart > Date.now() / 1000) {
        countingDown.set(true)
    }

    eventStartWritable.set(eventStart)
})
// export let eventStart = true
// export let eventStartWritable = writable(true)


export let eventEnded = writable(null)
onValue(ref(database, "editorState/eventEnded"), (snapshot) => {
    eventEnded.set(snapshot.val())
})

export let countingDown = writable(null)
setInterval(() => {
    if (eventStart && eventStart > Date.now() / 1000) {
        countingDown.set(true)
    } else {
        countingDown.set(false)
    }
}, 1000)

//export let countingDown = writable(false)


const DIGITS = [
    [
        "######",
        "######",
        "##  ##",
        "##  ##",
        "##  ##",
        "##  ##",
        "##  ##",
        "##  ##",
        "######",
        "######",
    ],

    [
        "    ##",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
    ],

    [
        "######",
        "######",
        "    ##",
        "    ##",
        "######", 
        "######",
        "##    ",
        "##    ",
        "######",
        "######",
    ],


    [
        "######",
        "######",
        "    ##",
        "    ##",
        "######",
        "######",
        "    ##",
        "    ##",
        "######",
        "######",
    ],

    [
        "##  ##",
        "##  ##",
        "##  ##",
        "##  ##",
        "######",
        "######",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
    ],

    [
        "######",
        "######",
        "##    ",
        "##    ",
        "######",
        "######",
        "    ##",
        "    ##",
        "######",
        "######",
    ],

    [
        "######",
        "######",
        "##    ",
        "##    ",
        "######",
        "######",
        "##  ##",
        "##  ##",
        "######",
        "######",
    ],

    [
        "######",
        "######",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
        "    ##",
    ],

    [
        "######",
        "######",
        "##  ##",
        "##  ##",
        "######",
        "######",
        "##  ##",
        "##  ##",
        "######",
        "######",
    ],

    [
        "######",
        "######",
        "##  ##",
        "##  ##",
        "######",
        "######",
        "    ##",
        "    ##",
        "######",
        "######",
    ],
    
]

const CLEAR = [
    "      ",
    "      ",
    "      ",
    "      ",
    "      ",
    "      ",
    "      ",
    "      ",
    "      ",
    "      ",
]

const objects = [1825, 259, 266, 273]

const edges = [
    // corner (up left), edge (up), center, concave corner (up left)
    //3, 2, 5, 4
    1203, 1202, 5, 1205
]
const shuffle = (arr) => {
    let i = arr.length, j, temp;
    if ( i == 0 ) return arr;
    while ( --i ) {
        j = Math.floor( Math.random() * ( i + 1 ) );
        temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
    return arr;
}


const PALLETES = shuffle([[0x01949A, 0x004369, 0xDB1F48], [0xD43790, 0xEC8FD0, 0x870A30], [0x3D550C, 0x81B622, 0xECF87F, 0x59981A], [0x21B6A8, 0xA3EBB1, 0x18A558]])

export class CountDownNode extends PIXI.Container {
    public digits = [null, null, null, null, null, null]

    public state = [null, null, null, null, null, null]

    public textures

    public edgeTextures: Record<number, PIXI.Texture>

    public blockTexture

    public palleteState = [2,2,3,3,1,1]

    public colons = []

    public offsets

    constructor(app: PIXI.Application, public editorNode: EditorNode, x_pos: number) {
        super()

        this.offsets = [
            vec(x_pos + 195, 315), 
            vec(x_pos + 195 + DIGITS[0][0].length * 30 + 30, 315), 
            vec(x_pos + 195 + DIGITS[0][0].length * 60 + 120, 315), 
            vec(x_pos + 195 + DIGITS[0][0].length * 90 + 150, 315), 
            vec(x_pos + 195 + DIGITS[0][0].length * 120 + 240, 315), 
            vec(x_pos + 195 + DIGITS[0][0].length * 150 + 270, 315)
        ]
        
        this.textures = objects.map(o => PIXI.Texture.from(`/gd/objects/main/${o}.png`))
        this.edgeTextures = edges.reduce((acc, o) => {
            acc[o] = PIXI.Texture.from(`/gd/objects/main/${o}.png`)
            return acc
        }, {})
        this.blockTexture = PIXI.Texture.from(`/gd/objects/main/1.png`)
        for (let i = 0; i < 6; i++) {
            this.digits[i] = this.makeDigit(editorNode, i)
        }

        let colons = false

        
        const i = setInterval(() => {
            if (eventStart == 0) return
            let n =  eventStart - Math.floor(Date.now()/1000)
            if (n > 0) {
                if (!colons) {this.addColons(); colons = true}
                this.update(n)
            }
            else if (n <= 0) {
                if (colons) {this.removColons(); colons = false}
                this.update(n, true)
            }
        }, 1000) 

        
    }

    public addColons() {
        this.addDot(this.editorNode, choose(this.textures), this.offsets[2].plus(vec(-60, -90)), choose(PALLETES[0]), 0.5)
        this.addDot(this.editorNode, choose(this.textures), this.offsets[2].plus(vec(-60, -180)), choose(PALLETES[0]), 0.5)
        this.addDot(this.editorNode, choose(this.textures), this.offsets[4].plus(vec(-60, -90)), choose(PALLETES[0]), 0.5)
        this.addDot(this.editorNode, choose(this.textures), this.offsets[4].plus(vec(-60, -180)), choose(PALLETES[0]), 0.5)

        this.addDot(this.editorNode, PIXI.Texture.from(`/gd/objects/main/1210.png`), this.offsets[2].plus(vec(-60, -90)))
        this.addDot(this.editorNode, PIXI.Texture.from(`/gd/objects/main/1210.png`), this.offsets[2].plus(vec(-60, -180)))
        this.addDot(this.editorNode, PIXI.Texture.from(`/gd/objects/main/1210.png`), this.offsets[4].plus(vec(-60, -90)))
        this.addDot(this.editorNode, PIXI.Texture.from(`/gd/objects/main/1210.png`), this.offsets[4].plus(vec(-60, -180)))
    }

    public removColons() {
        this.colons.forEach(c => c.destroy())
        this.colons = []
    }

    public update(time: number, clear = false) {
        const hours = Math.floor(time / 3600)
        const minutes = Math.floor((time - hours * 3600) / 60)
        const seconds = Math.floor(time - hours * 3600 - minutes * 60)

        const target = [Math.floor(hours / 10), hours % 10,
                        Math.floor(minutes / 10), minutes % 10,
                        Math.floor(seconds / 10), seconds % 10]
        
        for (let i = 0; i < 6; i++) {
            const current = this.state[i] != null ? DIGITS[this.state[i]] : CLEAR
            const next = clear ? CLEAR : DIGITS[target[i]]

            for (let y = 0; y < current.length; y ++) {
                for (let x = 0; x < current[y].length; x++) {

                    const remove = () => {
                        this.digits[i][0].getChildByName(`${x},${y}`).destroy()
                    }

                    const removeDeco = () => {
                        this.digits[i][1].getChildByName(`${x},${y}`).destroy()
                    }

                    const add = (id, rot) => {
                        const s = new PIXI.Sprite(this.edgeTextures[id])
                        s.anchor.set(0.5)
                        const angle = (rot - 90) * Math.PI / 180
                        s.rotation = angle
                        s.name = `${x},${y}`
                        s.scale.set(0.25)

                        const settings = getObjSettings(id)
                        
                        s.x = x * 30 + this.offsets[i].x + Math.cos(angle) * settings.offset_x + Math.sin(angle) * settings.offset_y
                        s.y = -y * 30 + this.offsets[i].y + Math.sin(angle) * settings.offset_x - Math.cos(angle) * settings.offset_y
                        this.digits[i][0].addChild(s)
                    }

                    const addDeco = () => {
                        const s2 = new PIXI.Sprite(choose(this.textures))
                        s2.anchor.set(0.5)
                        s2.name = `${x},${y}`
                        s2.scale.set(0.25, -0.25)
                        s2.x = x * 30 + this.offsets[i].x
                        s2.y = -y * 30 + this.offsets[i].y
                        s2.tint = choose(PALLETES[this.palleteState[i]])
                        s2.alpha = 0.5
                        this.digits[i][1].addChild(s2)
                    }


                    const n1 = this.countAliveNeighbours(x, y, current)
                    const n2 = this.countAliveNeighbours(x, y, next)
                    
                    
                    if (current[y][x] === '#' && next[y][x] !== '#') {
                        let t = 120 * n1 + 100 * Math.random()
                        setTimeout(() => this.digits[i][0].getChildByName(`${x},${y}`).tint = 0x00ff00, t * Math.random() * 0.7)
                        setTimeout(remove, t)

                        t = 100 * n1 + 70 * Math.random()
                        setTimeout(() => {
                            this.digits[i][1].getChildByName(`${x},${y}`).tint = 0x00ff00
                            this.digits[i][1].getChildByName(`${x},${y}`).alpha = 1
                        }, t * Math.random() * 0.7)
                        setTimeout(removeDeco, t)
                    } else if (current[y][x] !== '#' && next[y][x] === '#') {
                        const [id, rot] = this.getBestPiece(x, y, next)
                        setTimeout(() => add(id, rot), 120 * n2 + 100 * Math.random())
                        setTimeout(addDeco, 150 * n2 + 100 * Math.random())
                    } else if (current[y][x] === '#' && next[y][x] === '#') {
                        const [id, rot] = this.getBestPiece(x, y, next)
                        const [id2, rot2] = this.getBestPiece(x, y, current)
                        if (id === id2 && rot !== rot2) {
                            const t = 50 * Math.random()
                            const t2 = t + 50 * n2 + 300 * Math.random()
                            const t3 = t2 + 300 * Math.random()
                            setTimeout(() => this.digits[i][0].getChildByName(`${x},${y}`).tint = 0x00ff00, t)
                            setTimeout(() => {
                                const s = this.digits[i][0].getChildByName(`${x},${y}`)
                                const angle = (rot - 90) * Math.PI / 180
                                s.rotation = angle
                                const settings = getObjSettings(id)
                                s.x = x * 30 + this.offsets[i].x + Math.cos(angle) * settings.offset_x + Math.sin(angle) * settings.offset_y
                                s.y = -y * 30 + this.offsets[i].y + Math.sin(angle) * settings.offset_x - Math.cos(angle) * settings.offset_y
                            }, t2)
                            setTimeout(() => this.digits[i][0].getChildByName(`${x},${y}`).tint = 0xffffff, t3)
                        } else if (id !== id2 || rot !== rot2) {
                            const t = 50 * n1 + 100 * Math.random()
                            setTimeout(remove, t)
                            setTimeout(() => add(id, rot), t + 50 * n2 + 100 * Math.random())
                        }
                    }
                    
                    
                }
            }

        }

        this.state = clear ? [null, null, null, null, null, null] : target

    }

    countAliveNeighbours(x: number, y: number, current: string[]) {
        let count = 0
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue
                if (current[y + j] && current[y + j][x + i] === '#') count++
            }
        }
        return count
    }

    getBestPiece(x: number, y: number, current: string[]): [number, number] {
        let n: any = [[false, false, false], [false, false, false], [false, false, false]]
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue
                if (current[y + j] && current[y + j][x + i] === '#') n[j + 1][i + 1] = true
            }
        }
        
        const corner = edges[0]
        const edge = edges[1]
        const center = edges[2]
        const concave = edges[3]

        // surrounded
        if (n[0][0] && n[0][1] && n[0][2] && n[1][0] && n[1][2] && n[2][0] && n[2][1] && n[2][2]) {
            return [center, 0]
        }
        // concave
        if (!n[0][0] && n[0][1] && n[0][2] && n[1][0] && n[1][2] && n[2][0] && n[2][1] && n[2][2]) return [concave, 0]
        if (n[0][0] && n[0][1] && n[0][2] && n[1][0] && n[1][2] &&!n[2][0] && n[2][1] && n[2][2]) return [concave, 90]
        if (n[0][0] && n[0][1] && n[0][2] && n[1][0] && n[1][2] && n[2][0] && n[2][1] && !n[2][2]) return [concave, 180]
        if (n[0][0] && n[0][1] && !n[0][2] && n[1][0] && n[1][2] && n[2][0] && n[2][1] && n[2][2]) return [concave, 270]

        // edges
        if (n[0][1] && n[1][2] && n[2][1] && !n[1][0]) return [edge, 0]
        if (n[1][0] && n[0][1] && n[1][2] && !n[2][1]) return [edge, 90]
        if (n[0][1] && n[1][0] && n[2][1] && !n[1][2]) return [edge, 180]
        if (n[1][0] && n[2][1] && n[1][2] && !n[0][1]) return [edge, 270]

        // corners
        if (n[2][1] && n[1][2]) return [corner, 0]
        if (n[0][1] && n[1][2]) return [corner, 90]
        if (n[0][1] && n[1][0]) return [corner, 180]
        if (n[2][1] && n[1][0]) return [corner, 270]

        else return [83, 0]
    }

    makeDigit(editorNode, i) {
        const digit = this.state[i] != null ? DIGITS[this.state[i]] : CLEAR
        // make digit out of sprite
        const digitContainer = new PIXI.Container()
        const decoContainer = new PIXI.Container()
        for (let y = 0; y < digit.length; y++) {
            for (let x = 0; x < digit[y].length; x++) {

                if (digit[y][x] === "#") {
                    const s2 = new PIXI.Sprite(choose(this.textures))
                    s2.anchor.set(0.5)
                    s2.name = `${x},${y}`
                    s2.scale.set(0.25, -0.25)
                    s2.x = x * 30 + this.offsets[i].x
                    s2.y = -y * 30 + this.offsets[i].y
                    
                    s2.tint = choose(PALLETES[this.palleteState[i]])
                    s2.alpha = 0.5
                    decoContainer.addChild(s2)


                    const [id, rot] = this.getBestPiece(x, y, digit)

                    const s = new PIXI.Sprite(this.edgeTextures[id])
                    s.anchor.set(0.5)
                    const angle = (rot - 90) * Math.PI / 180
                    s.rotation = angle
                    s.name = `${x},${y}`
                    s.scale.set(0.25)

                    const settings = getObjSettings(id)
                    
                    s.x = x * 30 + this.offsets[i].x + Math.cos(angle) * settings.offset_x + Math.sin(angle) * settings.offset_y
                    s.y = -y * 30 + this.offsets[i].y + Math.sin(angle) * settings.offset_x - Math.cos(angle) * settings.offset_y
                    digitContainer.addChild(s)
                }
            }
        }
        editorNode.world.addChild(decoContainer)
        editorNode.world.addChild(digitContainer)
        
        return [digitContainer, decoContainer]
    }

    addDot(editorNode, tex, pos, tint = 0xffffff, opacity = 1) {
        const s = new PIXI.Sprite(tex)
        s.scale.set(0.25)
        s.anchor.set(0.5)
        s.x = pos.x
        s.y = pos.y
        s.tint = tint
        s.alpha = opacity
        editorNode.world.addChild(s)
        this.colons.push(s)
    }
    

}

const choose = (arr) => {
    return arr[Math.floor(Math.random() * arr.length)]
}








//flobvic