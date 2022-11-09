import * as PIXI from "pixi.js"
import * as PIXI_LAYERS from "@pixi/layers"

import { vec, type Vector } from "../utils/vector"
import { EditorNode, LEVEL_BOUNDS } from "./nodes"
import { map_range } from "../utils/math"

import { Howl, Howler } from "howler"
import { getColors } from "./colors"
import { ChunkNode, CHUNK_SIZE, getHistory } from "../firebase/database"
import { GDObject } from "./object"

export const DRAGGING_THRESHOLD = 40.0

export const TIMELAPSE_MODE = false
export const TIMELAPSE_SPEED = 500 // 1000 seconds per second

export function x_to_time(x) {
    // blocks per second in 1x speed
    return x / 30 / 10.3761348898
}

function time_to_x(t) {
    return t * 30 * 10.3761348898
}

export function storePosState(app: EditorApp) {
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
    public draggingThresholdReached: boolean = false
    public mousePos: Vector = vec(0, 0)
    public editorNode: EditorNode
    public playingMusic: boolean
    public musicLine: PIXI.Graphics
    public music: any

    playMusic() {
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
            PIXI.Texture.from("gd/world/background.png"),
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
                // sort by timeStamp
                history.sort((a, b) => a.timeStamp - b.timeStamp)
                // make the maximum time between two snapshots 100 seconds
                //console.log(history)
                let maxTime = 10000

                let offset = 0
                for (let i = 1; i < history.length; i++) {
                    history[i].timeStamp += offset
                    let lastTime = history[i - 1].timeStamp
                    let time = history[i].timeStamp
                    if (time - lastTime > maxTime) {
                        history[i].timeStamp = lastTime + maxTime
                        offset += history[i].timeStamp - time
                    }
                }
                //console.log(history)

                timelapseTime = history[0].timeStamp
                start = Date.now()
            })()
        }

        this.musicLine = new PIXI.Graphics()
        this.editorNode.addChild(this.musicLine)
        this.musicLine.position.set(0, 0)
        this.musicLine.lineStyle(2, 0x00ff00).lineTo(0, 30 * 80)

        // Setup the new Howl.
        this.music = new Howl({
            src: ["song.mp3"],
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
                            for (
                                let x = LEVEL_BOUNDS.start.x;
                                x <= LEVEL_BOUNDS.end.x;
                                x += CHUNK_SIZE.x
                            ) {
                                let broken = false
                                for (
                                    let y = LEVEL_BOUNDS.start.y;
                                    y <= LEVEL_BOUNDS.end.y;
                                    y += CHUNK_SIZE.y
                                ) {
                                    const i = x / 20 / 30
                                    const j = y / 20 / 30
                                    const chunkName = `${i},${j}`
                                    const chunk =
                                        this.editorNode.world.getChildByName(
                                            chunkName
                                        )
                                    if (
                                        (chunk as ChunkNode).getChildByName(
                                            obj_key
                                        )
                                    ) {
                                        ;(chunk as ChunkNode).removeObject(
                                            obj_key
                                        )
                                        broken = true
                                        break
                                    }
                                }
                                if (broken) {
                                    break
                                }
                            }
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
            if (this.playingMusic) {
                time = this.music.seek()
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
