import {
    ref,
    onChildAdded,
    onChildRemoved,
    get,
    onValue,
} from "firebase/database"
import * as PIXI from "pixi.js"
import type * as PIXI_LAYERS from "@pixi/layers"
import { GDObject, getObjSettings } from "../editor/object"
import {
    DeleteObjectLabel,
    EditorNode,
    LEVEL_BOUNDS,
    ObjectNode,
    resetObjectColors,
} from "../editor/nodes"
import { database, deleteObject, placeObject } from "./init"
import { vec } from "../utils/vector"
import { canEdit } from "./auth"
import { pixiApp, selectedObject, TIMELAPSE_MODE } from "../editor/app"
import { settings } from "../settings/settings"
import { writable } from "svelte/store"
import { Howl } from "howler"

import history from "../editor/history.json"

export const CHUNK_SIZE = vec(20 * 30, 20 * 30)

let canEditValue = false
canEdit.subscribe((value) => {
    canEditValue = value
})

export let placeTimerMaxCommon = writable(0)

onValue(ref(database, "editorState/placeTimer"), (snapshot) => {
    placeTimerMaxCommon.set(snapshot.val())
    // console.log("editorState/placeTimer", snapshot.val())
})

export let deleteTimerMaxCommon = writable(0)

onValue(ref(database, "editorState/deleteTimer"), (snapshot) => {
    deleteTimerMaxCommon.set(snapshot.val())
    // console.log("editorState/deleteTimer", snapshot.val())
})

export async function getHistory() {
    return history
}

export let streamLink = writable(null)
export let streamLinkValue = null
onValue(ref(database, "officialStreamLink"), (snapshot) => {
    streamLinkValue = snapshot.val()
    streamLink.set(streamLinkValue)
})

export let userCount = writable(null)

onValue(ref(database, "userCount"), (snapshot) => {
    userCount.set(snapshot.val())
})

export let eventEnd = null
onValue(ref(database, "editorState/eventEnd"), (snapshot) => {
    eventEnd = snapshot.val()
})

let clockSound = new Howl({
    src: ["tick.ogg"],
})

let finalClockSound = new Howl({
    src: ["big_tick.ogg"],
})

export let timeleft = writable(null)

let ended = false

setInterval(() => {
    if (eventEnd == null) return
    let val = eventEnd * 1000 - Date.now()
    if (val < 1000) val = 0

    timeleft.set(val)

    if (val != null) {
        if (val == 0 && !ended) {
            finalClockSound.play()
            ended = true
            pixiApp.endAnim()
        } else if (val <= 3000 && !ended) {
            finalClockSound.play()
        } else if (val < 30000 && !ended) {
            clockSound.play()
        }
    }
}, 1000)

let userColorCache = {}
export async function getUsernameColors(username: string): Promise<number[]> {
    if (userColorCache[username]) {
        return [...userColorCache[username]]
    }

    let colorSnap = await get(
        ref(database, `userName/${username?.toLowerCase()}/displayColor`)
    )

    let color

    if (!colorSnap.exists()) {
        color = [0xffffff]
    } else {
        color = colorSnap
            .val()
            .split(" ")
            .map((a) => parseInt(a, 16))
    }

    userColorCache[username] = [...color]

    return [...color]
}

export const initChunkBehavior = (
    editorNode: EditorNode,
    worldNode: PIXI.Container,
    selectableWorldNode: PIXI.Container,
    layerGroup: PIXI_LAYERS.Group,
    selectableLayerGroup: PIXI_LAYERS.Group
) => {
    for (
        let x = LEVEL_BOUNDS.start.x;
        x <= LEVEL_BOUNDS.end.x;
        x += CHUNK_SIZE.x
    ) {
        for (
            let y = LEVEL_BOUNDS.start.y;
            y <= LEVEL_BOUNDS.end.y;
            y += CHUNK_SIZE.y
        ) {
            const chunk = new ChunkNode(
                x,
                y,
                editorNode,
                selectableWorldNode,
                layerGroup,
                selectableLayerGroup
            )

            worldNode.addChild(chunk)
        }
    }
}

export const addObjectToLevel = (obj: GDObject) => {
    const data = obj.toDatabaseString()
    return placeObject({ text: data })
}

export const deleteObjectFromLevel = (objName: string, chunkName: string) => {
    return deleteObject({ objId: objName, chunkId: chunkName })
}

export function updateObjectCategory(newtab) {
    document.querySelectorAll(".obj_button").forEach((x) => {
        let c = x.getAttribute("data-category")
        x.setAttribute("style", c != newtab ? "display: none !important" : "")
    })
}

export class ChunkNode extends PIXI.Container {
    public load = null
    unsub1 = null
    unsub2 = null

    public addObject: (key: string, obj: GDObject) => void = null
    public removeObject: (key: string) => void = null

    public lastTimeVisible: number = 0
    public loaded: boolean = false
    //marker: PIXI.Graphics = null
    public selectableChunk: PIXI.Container = null

    constructor(
        x: number,
        y: number,
        editorNode: EditorNode,
        selectableWorldNode: PIXI.Container,
        layerGroup: PIXI_LAYERS.Group,
        selectableLayerGroup: PIXI_LAYERS.Group
    ) {
        super()

        let i = x / 20 / 30
        let j = y / 20 / 30
        let chunkName = `${i},${j}`
        this.name = chunkName
        this.visible = false

        // draw box
        // this.marker = new PIXI.Graphics()
        // this.marker.lineStyle(1, 0xffffff, 1)
        // this.marker.drawRect(x, y, CHUNK_SIZE.x, CHUNK_SIZE.y)

        // this.addChild(this.marker)

        this.selectableChunk = new PIXI.Container()
        this.selectableChunk.name = chunkName
        selectableWorldNode.addChild(this.selectableChunk)

        this.addObject = (key: string, obj: GDObject) => {
            let objectNode = new ObjectNode(obj, layerGroup, editorNode.tooltip)

            resetObjectColors(objectNode)

            objectNode.name = key

            objectNode.interactive = true

            const objsettings = getObjSettings(obj.id)
            if (
                !(objsettings.nondeco || objsettings.solid) &&
                settings.hideDecoObjects.enabled
            ) {
                objectNode.visible = false
            }

            // objectNode.on("pointerdown", (e) => {
            //     // middle click
            //     if (e.data.button === 1) {
            //         editorNode.selectedObjectId = obj.id

            //         // find object tab
            //         editorNode.currentObjectTab = getObjSettings(obj.id).tab
            //     }
            // })

            this.addChild(objectNode)

            let selectableSprite = new PIXI.Sprite(PIXI.Texture.EMPTY)
            selectableSprite.name = key
            selectableSprite.anchor.set(0.5)
            selectableSprite.alpha = 0.1
            selectableSprite.renderable = false

            selectableSprite.position = objectNode.position
            selectableSprite.rotation = objectNode.rotation
            selectableSprite.width = 40 * objectNode.scale.x
            selectableSprite.height = 40 * objectNode.scale.y
            selectableSprite.parentGroup = selectableLayerGroup

            selectableSprite.visible = objectNode.visible

            if (
                !(objsettings.danger || objsettings.solid) &&
                settings.showDanger.enabled
            ) {
                selectableSprite.visible = false
            }

            this.selectableChunk.addChild(selectableSprite)

            selectableSprite.interactive = true

            // selectableSprite.on("pointerup", () => {
            //     if (canEditValue) {
            //         editorNode.deselectObject()
            //         objectNode.mainSprite().tint = 0x00ff00
            //         objectNode.detailSprite().tint = 0x00ff00
            //         objectNode.mainSprite().alpha = 1.0
            //         objectNode.detailSprite().alpha = 1.0

            //         selectedObject.set(objectNode.getObjInfo())

            //         const select_box = new PIXI.Graphics()
            //         select_box.name = "select_box"
            //         select_box.visible = !settings.disableObjectOutline.enabled
            //         let [width, height] = [
            //             objectNode.mainSprite().width,
            //             objectNode.mainSprite().height,
            //         ]
            //         select_box.clear()
            //         select_box
            //             .lineStyle(1, 0xff3075, 1)
            //             .drawRect(
            //                 -width / 2 - 5,
            //                 -height / 2 - 5,
            //                 width + 10,
            //                 height + 10
            //             )

            //         //console.log(select_box, width, height)

            //         objectNode.addChild(select_box)

            //         editorNode.selectedObjectNode = objectNode
            //         selectableSprite.zOrder = editorNode.nextSelectionZ
            //         editorNode.nextSelectionZ -= 1
            //         editorNode.selectedObjectChunk = chunkName
            //     }
            // })
        }

        this.removeObject = (key: string) => {
            //console.log(this.name, "removed object")
            if (
                editorNode.selectedObjectChunk == chunkName &&
                editorNode.selectedObjectNode.name == key
            ) {
                editorNode.deselectObject()
            }
            //console.log(this.getChildByName(snapshot.key)) // this.getChildByName(snapshot.key).destroy()
            this.destroyObject(key)
        }

        this.load = () => {
            if (TIMELAPSE_MODE) {
                this.loaded = true
            } else {
                if (this.children.length > 0) {
                    this.children.forEach((child) => {
                        child.destroy()
                    })
                }
                if (!this.loaded) {
                    this.unsub1 = onChildAdded(
                        ref(database, `chunks/${chunkName}`),
                        (snapshot) => {
                            this.addObject(
                                snapshot.key,
                                GDObject.fromDatabaseString(snapshot.val())
                            )
                        }
                    )
                    this.unsub2 = onChildRemoved(
                        ref(database, `chunks/${chunkName}`),
                        (snapshot) => {
                            if (this.getChildByName(snapshot.key).visible)
                                editorNode.deleteLabels.addChild(
                                    new DeleteObjectLabel(
                                        snapshot.val(),
                                        this.getChildByName(
                                            snapshot.key
                                        ).position
                                    )
                                )
                            this.removeObject(snapshot.key)
                        }
                    )
                    this.loaded = true
                    //this.marker.tint = 0x00ff00
                }
            }
        }
    }

    destroyObject(key) {
        this.getChildByName(key).destroy()
        this.selectableChunk.getChildByName(key).destroy()
    }

    unload() {
        if (TIMELAPSE_MODE) {
            this.loaded = false
        } else if (this.loaded) {
            const l = this.children.length

            for (let i = 0; i < l; i++) {
                this.children[0].destroy()
                this.selectableChunk.children[0].destroy()
            }

            this.unsub1()
            this.unsub2()
            this.loaded = false
        }
    }
}
