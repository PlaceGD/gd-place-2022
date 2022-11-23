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
import objectList from "../objects.json"

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

export const TIMELAPSE_MODE = false
export const TIMELAPSE_SPEED = 1000
// 1000 seconds per second

export const PRELOAD_IMAGES = true
export const USE_LOCAL = true

export const getTexture = (name: string): PIXI.Texture => {
    if (PRELOAD_IMAGES) {
        return PIXI.Loader.shared.resources[name].texture
    } else {
        return PIXI.Texture.from(name)
    }
}

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

export let obamaAnimEnded = writable(false)

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

    public app: PIXI.Application

    constructor(public canvas: HTMLCanvasElement, editorPosition) {
        this.app = new PIXI.Application({
            width: canvas.offsetWidth,
            height: canvas.offsetHeight,
            resizeTo: canvas,
            backgroundColor: 0x000000,
            view: canvas,
            resolution: 1,
            backgroundAlpha: 0,
        })

        const setup = () => {
            this.app.stage = new PIXI_LAYERS.Stage()

            let bgTiling = new PIXI.TilingSprite(
                PIXI.Texture.from("/gd/world/background.png"),
                2048 * 10,
                2048
            )
            this.app.stage.addChild(bgTiling)
            bgTiling.tint = 0x287dff

            let center = new PIXI.Container()
            this.app.stage.addChild(center)

            center.scale.y = -1

            this.editorNode = new EditorNode(this.app, editorPosition)
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

            // this.musicLine = new PIXI.Graphics()
            // this.editorNode.addChild(this.musicLine)
            // this.musicLine.position.set(0, 0)
            // this.musicLine.lineStyle(2, 0x00ff00).lineTo(0, 30 * 80)

            // Setup the new Howl.
            this.music = new Howl({
                src: ["/song.mp3"],
            })

            // Change global volume.
            Howler.volume(0.25)

            function easeOutExpo(x: number): number {
                return x === 1 ? 1 : 1 - Math.pow(2, -10 * x)
            }

            function easeInExpo(x: number): number {
                return x === 0 ? 0 : Math.pow(2, 10 * x - 10)
            }

            this.app.ticker.add(() => {
                if (this.editorNode.obamaEndingStart != null) {
                    const obama = this.app.stage.getChildByName("obama")
                    const d = Date.now() - this.editorNode.obamaEndingStart

                    if (d > 2000) {
                        const dd = Math.min((d - 2000) / 2000, 1)
                        const eased = easeOutExpo(dd)
                        obama.alpha = eased
                        obama.scale.set(0.0 + 0.15 * eased)
                    }

                    // text 1: "Thank you for your objects."
                    const str1 = "Thank you for your objects."
                    const str2 = "I will make sure they get home safely."
                    const str3 = "Farewell."
                    if (d > 7000 && d < 8000) {
                        const dd = (d - 7000) / 1000
                        const t = this.app.stage.getChildByName(
                            "obama_text"
                        ) as PIXI.Text
                        const substr = str1.substring(
                            0,
                            1 + Math.floor(dd * str1.length)
                        )
                        t.text = substr
                    } else if (d > 11000 && d < 12000) {
                        const dd = (d - 11000) / 1000
                        const t = this.app.stage.getChildByName(
                            "obama_text"
                        ) as PIXI.Text
                        const substr = str2.substring(
                            0,
                            1 + Math.floor(dd * str2.length)
                        )
                        t.text = substr
                    } else if (d > 15000 && d < 16000) {
                        const dd = (d - 15000) / 1000
                        const t = this.app.stage.getChildByName(
                            "obama_text"
                        ) as PIXI.Text
                        const substr = str3.substring(
                            0,
                            1 + Math.floor(dd * str3.length)
                        )
                        t.text = substr
                    }

                    if (d > 17000)
                        (
                            this.app.stage.getChildByName(
                                "obama_text"
                            ) as PIXI.Text
                        ).text = ""

                    if (d > 18000) {
                        const dd = Math.min((d - 18000) / 1000, 1)
                        const eased = easeInExpo(dd)
                        obama.alpha = 1 - eased
                        obama.scale.set(0.15 + 0.2 * eased)
                    }

                    return
                }
                if (TIMELAPSE_MODE) {
                    if (history && start && timelapseTime) {
                        const time =
                            (Date.now() - start) * TIMELAPSE_SPEED +
                            timelapseTime

                        while (
                            historyIndex < history.length &&
                            history[historyIndex].timeStamp < time
                        ) {
                            if (
                                history[historyIndex].hasOwnProperty(
                                    "placedObject"
                                )
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
                                const chunk =
                                    this.editorNode.world.getChildByName(
                                        history[historyIndex].chunk
                                    )
                                if (
                                    (chunk as ChunkNode).getChildByName(obj_key)
                                )
                                    (chunk as ChunkNode).removeObject(obj_key)
                            }
                            historyIndex++
                        }
                    }
                }
                center.position.x = this.app.screen.width / 2
                center.position.y = this.app.screen.height / 2

                let bgOutside = 2048 - this.app.screen.height
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

        if (PRELOAD_IMAGES) {
            // fire
            PIXI.Loader.shared
                .add(`/gd/objects/main/920.png`)
                .add(`/gd/objects/detail/920.png`)
                .add(`/gd/objects/main/923.png`)
                .add(`/gd/objects/detail/923.png`)
            for (let object of objectList) {
                PIXI.Loader.shared
                    .add(`/gd/objects/main/${object.id}.png`)
                    .add(`/gd/objects/detail/${object.id}.png`)
            }

            PIXI.Loader.shared.onComplete.once(setup)
            PIXI.Loader.shared.load()
        } else {
            setup()
        }
    }

    canvasSize() {
        return vec(this.canvas.offsetWidth, this.canvas.offsetHeight)
    }

    endAnim() {
        this.editorNode.removePreview()
        this.editorNode.setObjectsSelectable(false)
        this.editorNode.deselectObject()
        this.editorNode.tooltip.show = false
        this.stopMusic()

        this.dragging = null
        this.pinching = null

        // setTimeout(() => {
        //     this.editorNode.obamaAnim()
        // }, 5000)

        //     setTimeout(() => {
        //         this.editorNode.obamaAnimStart = null
        //         this.editorNode.ominousSound.stop()
        //         this.editorNode.ominousSound = null

        //         this.app.stage.children.forEach((child) => {
        //             child.visible = false
        //         })
        //         this.editorNode.obamaEndingStart = Date.now()
        //         obamaAnimEnded.set(true)

        //         const text = new PIXI.Text("", {
        //             fontFamily: ["Cabin", "sans-serif"],
        //             fontSize: 32,
        //             fill: [0xffffff],
        //             align: "center",
        //         })

        //         text.anchor.set(0.5)
        //         text.position.set(
        //             this.app.screen.width / 2,
        //             this.app.screen.height * 0.8
        //         )
        //         text.scale.set(1)
        //         text.name = "obama_text"

        //         this.app.stage.addChild(text)

        //         const new_obama = new PIXI.Sprite(
        //             PIXI.Texture.from("/obama_final_form.png")
        //         )
        //         new_obama.anchor.set(0.5)
        //         new_obama.position.set(
        //             this.app.screen.width / 2,
        //             this.app.screen.height / 2
        //         )
        //         new_obama.scale.set(1)
        //         new_obama.alpha = 0

        //         this.app.stage.addChild(new_obama)
        //         new_obama.blendMode = PIXI.BLEND_MODES.ADD
        //         new_obama.name = "obama"
        //     }, 31000)
    }

    async takeHighResScreenshot() {
        // const GRID_SIZE = 30

        // const CHUNK_SIZE = 20 * GRID_SIZE
        console.log(LEVEL_BOUNDS.end.x, LEVEL_BOUNDS.end.y)

        return

        let downloadLink = document.createElement("a")

        pixiApp.editorNode.groundTiling.visible = false

        pixiApp.editorNode.zoomLevel = 6

        pixiApp.editorNode.cameraPos.x =
            window.innerWidth / 2 / pixiApp.editorNode.zoom()
        // wtf
        pixiApp.editorNode.cameraPos.y =
            window.innerHeight / 2 / pixiApp.editorNode.zoom()

        let rt = PIXI.RenderTexture.create({
            width: window.innerWidth,
            height: window.innerHeight,
            scaleMode: PIXI.SCALE_MODES.LINEAR,
        })

        const MATRIX = new PIXI.Matrix(
            1,
            0,
            0,
            -1,
            window.innerWidth / 2,
            window.innerHeight / 2
        )

        const X_COUNT = Math.floor(
            LEVEL_BOUNDS.end.x / (window.innerWidth / pixiApp.editorNode.zoom())
        )
        const Y_COUNT = Math.floor(
            LEVEL_BOUNDS.end.y /
                (window.innerHeight / pixiApp.editorNode.zoom())
        )

        // wait for cam
        await new Promise((r) => setTimeout(r, 2000))

        for (let y = 0; y <= Y_COUNT; y++) {
            for (let x = 0; x <= X_COUNT; x++) {
                rt = PIXI.RenderTexture.create({
                    width: window.innerWidth,
                    height: window.innerHeight,
                    scaleMode: PIXI.SCALE_MODES.LINEAR,
                })
                pixiApp.app.renderer.render(pixiApp.editorNode, {
                    renderTexture: rt,
                    transform: MATRIX,
                })
                const image = pixiApp.app.renderer.plugins.extract.base64(
                    rt,
                    "image/png"
                )
                saveImage(downloadLink, image, `${x},${y}`)

                pixiApp.editorNode.cameraPos.x +=
                    window.innerWidth / pixiApp.editorNode.zoom()

                console.log(pixiApp.editorNode.cameraPos.x)

                await new Promise((r) => setTimeout(r, 100))
            }

            pixiApp.editorNode.cameraPos.y +=
                window.innerHeight / pixiApp.editorNode.zoom()
            pixiApp.editorNode.cameraPos.x =
                window.innerWidth / 2 / pixiApp.editorNode.zoom()

            await new Promise((r) => setTimeout(r, 100))
        }
    }
}

async function saveImage(link: HTMLAnchorElement, content: string, id: string) {
    link.setAttribute("download", `${id}.png`)

    let url = content.replace(
        /^data:image\/png/,
        "data:application/octet-stream"
    )
    link.setAttribute("href", url)
    link.click()
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
