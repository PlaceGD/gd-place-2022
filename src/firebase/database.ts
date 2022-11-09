import {
    getDatabase,
    ref,
    onChildAdded,
    onChildChanged,
    onChildRemoved,
    onValue,
    get,
    set,
    push,
    child,
    remove,
} from "firebase/database"
import * as PIXI from "pixi.js"
import type * as PIXI_LAYERS from "@pixi/layers"
import { GDObject } from "../editor/object"
import {
    DeleteObjectLabel,
    EditorNode,
    LEVEL_BOUNDS,
    ObjectNode,
} from "../editor/nodes"
import { database, deleteObject, placeObject } from "./init"
import { vec } from "../utils/vector"
import { canEdit } from "./auth"
import { TIMELAPSE_MODE } from "../editor/app"

export const CHUNK_SIZE = vec(20 * 30, 20 * 30)

let canEditValue = false
canEdit.subscribe((value) => {
    canEditValue = value
})

export async function getHistory() {
    return (await get(ref(database, "history"))).val()
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
            objectNode.name = key

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

            this.selectableChunk.addChild(selectableSprite)

            selectableSprite.interactive = true

            selectableSprite.on("pointerup", () => {
                if (canEditValue) {
                    editorNode.deselectObject()
                    objectNode.mainSprite().tint = 0x00ff00
                    objectNode.detailSprite().tint = 0x00ff00
                    objectNode.mainSprite().alpha = 1.0
                    objectNode.detailSprite().alpha = 1.0

                    const select_box = new PIXI.Graphics()
                    select_box.name = "select_box"
                    let [width, height] = [
                        objectNode.mainSprite().width,
                        objectNode.mainSprite().height,
                    ]
                    select_box.clear()
                    select_box
                        .lineStyle(1, 0xff3075, 1)
                        .drawRect(
                            -width / 2 - 5,
                            -height / 2 - 5,
                            width + 10,
                            height + 10
                        )

                    //console.log(select_box, width, height)

                    objectNode.addChild(select_box)

                    editorNode.selectedObjectNode = objectNode
                    selectableSprite.zOrder = editorNode.nextSelectionZ
                    editorNode.nextSelectionZ -= 1
                    editorNode.selectedObjectChunk = chunkName
                }
            })
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
                            editorNode.deleteLabels.addChild(
                                new DeleteObjectLabel(
                                    snapshot.val(),
                                    this.getChildByName(snapshot.key).position
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
