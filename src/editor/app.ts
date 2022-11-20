import * as PIXI from "pixi.js"
import * as PIXI_LAYERS from "@pixi/layers"
import { writable, type Writable } from "svelte/store"
import debounce from "lodash.debounce"

import { vec, type Vector } from "../utils/vector"
import { EditorNode, LEVEL_BOUNDS, type ObjectInfo } from "./nodes"
import { map_range } from "../utils/math"

import { Howl, Howler } from "howler"
import { getColors } from "./colors"
import { ChunkNode, CHUNK_SIZE, getHistory } from "../firebase/database"
import { GDObject } from "./object"
import { settings } from "../settings/settings"

export const toGradient = (cols: number[]): string => {
    // console.log(cols[0].toString(16).padStart(6, "0"))
    if (cols.length == 1) return `#${cols[0].toString(16).padStart(6, "0")}`
    const map = (number, inMin, inMax, outMin, outMax) => {
        return ((number - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin
    }

    return `linear-gradient(to bottom, ${cols
        .map((c, i) => {
            return `#${c.toString(16).padStart(6, "0")}\
            ${map(i, 0, cols.length - 1, 20, 80)}%`
        })
        .join(",")})`
}

export const DRAGGING_THRESHOLD = 40.0

export const TIMELAPSE_MODE = true
export const TIMELAPSE_SPEED = 1000
// 1000 seconds per second

export const TIMELAPSE_CHUNKS = new Set(["1,1", "1,2", "1,3", "1,4", "1,5"])

export function x_to_time(x) {
    // blocks per second in 1x speed
    return x / 30 / 10.3761348898
}

function time_to_x(t) {
    return t * 30 * 10.3761348898
}

export enum EditorMenu {
    Build,
    Edit,
    Delete,
}

export let selectedObject: Writable<ObjectInfo> = writable(null)

export let pixiCanvas: Writable<HTMLCanvasElement | null> = writable(null)

export let pixiApp: EditorApp
export let pixiAppStore: Writable<EditorApp | null> = writable(null)

pixiAppStore.subscribe((app) => {
    if (app) pixiApp = app
})

const setUrlDebounced = debounce((x, y, zoom) => {
    history.replaceState({}, "", `?x=${x}&y=${y}&zoom=${zoom}`)
}, 1000)

export function storePosState(app: EditorApp) {
    const x = Math.floor(app.editorNode.cameraPos.x / 30)
    const y = Math.floor(app.editorNode.cameraPos.y / 30)
    const zoom = Math.floor(app.editorNode.zoomLevel)

    setUrlDebounced(x, y, zoom)

    localStorage.setItem(
        "editorPosition",
        JSON.stringify({
            x: app.editorNode.cameraPos.x,
            y: app.editorNode.cameraPos.y,
            zoom: app.editorNode.zoomLevel,
        })
    )
}

export class EditorApp {
    public dragging: null | { prevCamera: Vector; prevMouse: Vector } = null
    public pinching: null | { prevZoom: number } = null

    public draggingThresholdReached: boolean = false
    public mousePos: Vector = vec(0, 0)
    public editorNode: EditorNode
    public playingMusic: boolean
    public musicLine: PIXI.Graphics
    public music: any

    playMusic() {
        this.playingMusic = true
        let pos = Math.max(
            0,
            -this.canvas.offsetWidth / (2 * this.editorNode.zoom()) +
                this.editorNode.cameraPos.x
        )
        this.musicLine.position.x = pos
        const start_time = x_to_time(pos)
        this.music.seek(start_time)
        this.music.play()
    }

    stopMusic() {
        this.music.stop()
        this.playingMusic = false
    }

    constructor(public canvas: HTMLCanvasElement, editorPosition) {
        let app = new PIXI.Application({
            width: canvas.offsetWidth,
            height: canvas.offsetHeight,
            resizeTo: canvas,
            backgroundColor: 0x287dff,
            view: canvas,
            resolution: 1,
        })

        app.stage = new PIXI_LAYERS.Stage()

        let bgTiling = new PIXI.TilingSprite(
            PIXI.Texture.from("/gd/world/background.png"),
            2048 * 10,
            2048
        )
        app.stage.addChild(bgTiling)
        bgTiling.tint = 0x287dff

        let center = new PIXI.Container()
        app.stage.addChild(center)

        center.scale.y = -1

        this.editorNode = new EditorNode(app, editorPosition)
        center.addChild(this.editorNode)

        // for (let i = 0; i < 100; i++) {
        //     let sprite = new PIXI.Sprite(
        //         PIXI.Texture.from("gd/objects/main/1.png")
        //     );
        //     sprite.position.x = i;
        //     this.editorNode.addChild(sprite);
        // }
        let history
        let historyIndex = 0
        let timelapseTime
        let start
        if (TIMELAPSE_MODE) {
            // download history
            ;(async () => {
                history = Object.values(await getHistory())
                // filter by chunks
                // history = history.filter((ev) => {
                //     let chunk
                //     if (ev.hasOwnProperty("placedObject")) {
                //         //console.log("placing object")
                //         const obj = GDObject.fromDatabaseString(
                //             history[historyIndex].placedObject
                //         )
                //         let chunkX = Math.floor(obj.x / CHUNK_SIZE.x)
                //         let chunkY = Math.floor(obj.y / CHUNK_SIZE.y)
                //         chunk = `${chunkX},${chunkY}`
                //     } else {
                //         chunk = ev.chunk
                //     }

                //     return TIMELAPSE_CHUNKS.has(chunk)
                // })
                // sort by timeStamp
                history.sort((a, b) => a.timeStamp - b.timeStamp)
                // make the maximum time between two snapshots 100 seconds
                //console.log(history)
                // let maxTime = 10000

                // let offset = 0
                // for (let i = 1; i < history.length; i++) {
                //     history[i].timeStamp += offset
                //     let lastTime = history[i - 1].timeStamp
                //     let time = history[i].timeStamp
                //     if (time - lastTime > maxTime) {
                //         history[i].timeStamp = lastTime + maxTime
                //         offset += history[i].timeStamp - time
                //     }
                // }
                console.log(history)

                timelapseTime = 1668798001015
                start = Date.now()

                //localStorage.setItem("historyCache", JSON.stringify(history))
            })()
        }

        this.musicLine = new PIXI.Graphics()
        this.editorNode.addChild(this.musicLine)
        this.musicLine.position.set(0, 0)
        this.musicLine.lineStyle(2, 0x00ff00).lineTo(0, 30 * 80)

        // Setup the new Howl.
        this.music = new Howl({
            src: ["/song.mp3"],
        })

        // Change global volume.
        Howler.volume(0.25)

        app.ticker.add(() => {
            if (TIMELAPSE_MODE) {
                if (history && start && timelapseTime) {
                    const time =
                        (Date.now() - start) * TIMELAPSE_SPEED + timelapseTime

                    while (
                        historyIndex < history.length &&
                        history[historyIndex].timeStamp < time
                    ) {
                        if (
                            history[historyIndex].hasOwnProperty("placedObject")
                        ) {
                            //console.log("placing object")
                            const obj = GDObject.fromDatabaseString(
                                history[historyIndex].placedObject
                            )
                            let chunkX = Math.floor(obj.x / CHUNK_SIZE.x)
                            let chunkY = Math.floor(obj.y / CHUNK_SIZE.y)
                            const chunk = `${chunkX},${chunkY}`
                            //console.log(chunk)
                            ;(
                                this.editorNode.world.getChildByName(
                                    chunk
                                ) as ChunkNode
                            ).addObject(history[historyIndex].key, obj)
                        } else {
                            //console.log("removing object")
                            const obj_key = history[historyIndex].key
                            // look for object all chunks
                            const chunk = this.editorNode.world.getChildByName(
                                history[historyIndex].chunk
                            )
                            if ((chunk as ChunkNode).getChildByName(obj_key))
                                (chunk as ChunkNode).removeObject(obj_key)
                        }
                        historyIndex++
                    }
                }
            }
            center.position.x = app.screen.width / 2
            center.position.y = app.screen.height / 2

            let bgOutside = 2048 - app.screen.height
            bgTiling.y = map_range(
                this.editorNode.cameraPos.y,
                LEVEL_BOUNDS.start.y,
                LEVEL_BOUNDS.end.y,
                -bgOutside,
                0
            )
            bgTiling.x = -this.editorNode.cameraPos.x / 6.0

            if (this.dragging != null && this.draggingThresholdReached) {
                this.editorNode.cameraPos.x =
                    this.dragging.prevCamera.x -
                    (this.mousePos.x - this.dragging.prevMouse.x) /
                        this.editorNode.zoom()
                this.editorNode.cameraPos.y =
                    this.dragging.prevCamera.y +
                    (this.mousePos.y - this.dragging.prevMouse.y) /
                        this.editorNode.zoom()
                // set editor position to local storage
                storePosState(this)
            }
            let time
            if (!settings.disableBG.enabled) {
                if (this.playingMusic) {
                    time = this.music.seek()
                    if (time >= 250) this.stopMusic()

                    let pos = time_to_x(time)
                    this.musicLine.position.x = pos

                    let { bg, ground } = getColors(time)

                    bgTiling.tint = rgbToHexnum(bg)
                    this.editorNode.groundTiling.tint = rgbToHexnum(ground)
                } else {
                    time = x_to_time(this.editorNode.cameraPos.x)
                }

                let { bg, ground } = getColors(time)

                bgTiling.tint = rgbToHexnum(bg)
                this.editorNode.groundTiling.tint = rgbToHexnum(ground)
            } else {
                if (this.playingMusic) {
                    time = this.music.seek()
                    if (time >= 250) this.stopMusic()
                    let pos = time_to_x(time)
                    this.musicLine.position.x = pos
                } else {
                    time = x_to_time(this.editorNode.cameraPos.x)
                }
                bgTiling.tint = 0x888888
                this.editorNode.groundTiling.tint = 0x666666
            }
        })
    }

    canvasSize() {
        return vec(this.canvas.offsetWidth, this.canvas.offsetHeight)
    }
}

export function rgbToHexnum([r, g, b]: number[]) {
    return (
        (Math.floor(r * 255) << 16) +
        (Math.floor(g * 255) << 8) +
        Math.floor(b * 255)
    )
}

export function hexNumToString(num: number) {
    return "#" + num.toString(16)
}
