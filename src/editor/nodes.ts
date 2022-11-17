import * as PIXI from "pixi.js"
import * as PIXI_LAYERS from "@pixi/layers"
import { toast } from "@zerodevx/svelte-toast"
import { get, ref } from "@firebase/database"

import { vec, Vector } from "../utils/vector"
import { GdColor, getObjSettings, type GDObject } from "./object"
import {
    deleteObjectFromLevel,
    initChunkBehavior,
    CHUNK_SIZE,
    ChunkNode,
    getUsernameColors,
} from "../firebase/database"
import { clamp, wrap } from "../utils/math"

import { MAX_ZOOM, MIN_ZOOM, toastErrorTheme } from "../const"
import { database } from "../firebase/init"
import { pixiApp, selectedObject } from "./app"
import { settings } from "../settings/settings"
import { CountDownNode } from "../countdown/countdown"

export const LEVEL_BOUNDS = {
    start: vec(0, 0),
    end: vec(30 * 3000, 30 * 80),
}
const GROUND_SCALE = (30 * 4.25) / 512

export type ObjectInfo = {
    obj: GDObject
    dbname: string
}

export const SPAWN_POS = Math.random() * 30 * 1000 - 27 * 30

const BLENDING_SHADER = `
    varying mediump vec2 vTextureCoord;
    uniform sampler2D uSampler;

    void main(void) {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
        gl_FragColor.r *= gl_FragColor.a;
        gl_FragColor.g *= gl_FragColor.a;
        gl_FragColor.b *= gl_FragColor.a;
    }
`

const BLENDING_FILTER = new PIXI.Filter(undefined, BLENDING_SHADER)
BLENDING_FILTER.blendMode = PIXI.BLEND_MODES.ADD

const BRIGHTNESS_SHADER = `
    varying mediump vec2 vTextureCoord;
    uniform sampler2D uSampler;

    void main(void) {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
        float brightness = gl_FragColor.r * 0.2126 + gl_FragColor.g * 0.7152 + gl_FragColor.b * 0.0722;
        bool opaque = gl_FragColor.a > 0.1;
        
        gl_FragColor.r = (brightness * 0.5 + 0.5) * float(int(opaque));
        gl_FragColor.g = 0.0;
        gl_FragColor.b = 0.0;
    }
`

const BRIGTHNESS_FILTER = new PIXI.Filter(undefined, BRIGHTNESS_SHADER)
export class EditorNode extends PIXI.Container {
    public currentObjectTab: string = "blocks"
    public zoomLevel: number = 0
    public cameraPos: Vector = vec(0, 0)
    public objectPreview: GDObject | null = null
    public objectPreviewNode: ObjectNode | null = null
    public layerGroup: PIXI_LAYERS.Group

    public deleteLabels: PIXI.Container

    public selectedObjectId: number = 1
    public selectedObjectNode: ObjectNode | null = null
    public selectedObjectChunk: string | null = null
    public nextSelectionZ: number = -1

    public selectableWorld: PIXI.Container
    public groundTiling: PIXI.TilingSprite

    public tooltip: TooltipNode

    public world: PIXI.Container

    public visibleChunks: Set<string> = new Set()
    toggleGround() {
        this.groundTiling.visible = !settings.hideGround.enabled
    }
    toggleDecoObjects() {
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
                const i = x / 20 / 30
                const j = y / 20 / 30
                const chunkName = `${i},${j}`

                const chunk = this.world.getChildByName(chunkName) as ChunkNode
                const selectablechunk = this.selectableWorld.getChildByName(
                    chunkName
                ) as ChunkNode
                if (chunk.loaded) {
                    for (const object of chunk.children) {
                        const obj = getObjSettings(
                            (object as ObjectNode).obj.id
                        )
                        if (!(obj.nondeco || obj.solid)) {
                            object.visible = !settings.hideDecoObjects.enabled
                        }
                        selectablechunk.getChildByName(object.name).visible =
                            object.visible
                    }
                }
            }
        }
    }

    toggleDangerObjects() {
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
                const i = x / 20 / 30
                const j = y / 20 / 30
                const chunkName = `${i},${j}`

                const chunk = this.world.getChildByName(chunkName) as ChunkNode
                const selectablechunk = this.selectableWorld.getChildByName(
                    chunkName
                ) as ChunkNode
                if (chunk.loaded) {
                    for (const object of chunk.children) {
                        const o = object as ObjectNode
                        resetObjectColors(o)

                        const obj = getObjSettings(o.obj.id)
                        if (settings.showDanger.enabled)
                            selectablechunk.getChildByName(
                                object.name
                            ).visible = obj.danger || obj.solid
                        else
                            selectablechunk.getChildByName(
                                object.name
                            ).visible = true
                    }
                }
            }
        }
    }

    updateVisibleChunks(app: PIXI.Application) {
        const prev = this.visibleChunks

        const worldScreenStart = this.toWorld(
            vec(0, 0),
            vec(app.screen.width, app.screen.height)
        ).clamped(LEVEL_BOUNDS.start, LEVEL_BOUNDS.end)
        const worldScreenEnd = this.toWorld(
            vec(app.screen.width, app.screen.height),
            vec(app.screen.width, app.screen.height)
        ).clamped(LEVEL_BOUNDS.start, LEVEL_BOUNDS.end)
        const camRect = {
            x: worldScreenStart.x,
            y: worldScreenStart.y,
            width: Math.abs(worldScreenEnd.x - worldScreenStart.x),
            height: Math.abs(worldScreenEnd.y - worldScreenStart.y),
        }
        const startChunk = vec(
            Math.floor(camRect.x / CHUNK_SIZE.x),
            Math.floor(camRect.y / CHUNK_SIZE.y)
        )
        const endChunk = vec(
            Math.floor((camRect.x + camRect.width) / CHUNK_SIZE.x),
            Math.floor((camRect.y - camRect.height) / CHUNK_SIZE.y)
        )
        const chunksWidth = Math.abs(endChunk.x - startChunk.x) + 1
        const chunksHeight = Math.abs(endChunk.y - startChunk.y) + 1
        //console.log(camRect, startChunk, chunksWidth, chunksHeight)
        let chunks = new Set<string>()
        for (let x = 0; x < chunksWidth; x++) {
            for (let y = 0; y < chunksHeight; y++) {
                chunks.add(`${startChunk.x + x},${startChunk.y - y}`)
            }
        }

        this.visibleChunks = chunks
        this.visibleChunks.forEach((chunk) => {
            ;(this.world.getChildByName(chunk) as ChunkNode).lastTimeVisible =
                Date.now()
        })
        //console.log(chunks, startChunk, endChunk)

        const removed_chunks = new Set([...prev].filter((x) => !chunks.has(x)))
        const added_chunks = new Set([...chunks].filter((x) => !prev.has(x)))

        removed_chunks.forEach((chunk) => {
            // dont render this chunk
            this.world.getChildByName(chunk).visible = false
        })

        added_chunks.forEach((chunk) => {
            // render this chunk
            this.world.getChildByName(chunk).visible = true
            if (!(this.world.getChildByName(chunk) as ChunkNode).loaded) {
                ;(this.world.getChildByName(chunk) as ChunkNode).load()
            }
        })
    }

    unloadOffscreenChunks() {
        let unloaded = 0

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
                const i = x / 20 / 30
                const j = y / 20 / 30
                const chunkName = `${i},${j}`
                if (!this.visibleChunks.has(chunkName)) {
                    const timestamp = (
                        this.world.getChildByName(chunkName) as ChunkNode
                    ).lastTimeVisible
                    if (
                        Date.now() - timestamp > 1000 * 30 &&
                        (this.world.getChildByName(chunkName) as ChunkNode)
                            .loaded
                    ) {
                        ;(
                            this.world.getChildByName(chunkName) as ChunkNode
                        ).unload()
                        unloaded++
                    }
                }
            }
        }
        if (unloaded != 0) console.log(`Unloaded ${unloaded} chunks`)
    }

    removePreview() {
        if (this.objectPreviewNode != null) {
            this.objectPreview = null
            this.objectPreviewNode.destroy()
            this.objectPreviewNode = null
        }
    }

    setObjectsSelectable(willYouMakeThemSelectable: boolean) {
        this.selectableWorld.visible = willYouMakeThemSelectable
    }
    deselectObject() {
        if (this.selectedObjectNode != null) {
            selectedObject.set(null)
            this.selectedObjectNode.getChildByName("select_box")?.destroy()
            resetObjectColors(this.selectedObjectNode)
            this.selectedObjectNode = null
            this.selectedObjectChunk = null
        }
    }
    deleteSelectedObject(then, els) {
        if (this.selectedObjectNode != null) {
            let name = this.selectedObjectNode.name
            let chunk = this.selectedObjectChunk
            this.deselectObject()
            deleteObjectFromLevel(name, chunk)
                .then(then)
                .catch((err) => {
                    console.log(err)
                    toast.push(
                        `Failed to delete object! (${err.message})`,
                        toastErrorTheme
                    )
                    els()
                })
            return true
        }
        return false
    }

    correctObject() {
        if (this.objectPreview != null) {
            this.objectPreview.x = clamp(
                this.objectPreview.x,
                LEVEL_BOUNDS.start.x,
                LEVEL_BOUNDS.end.x
            )
            this.objectPreview.y = clamp(
                this.objectPreview.y,
                LEVEL_BOUNDS.start.y,
                LEVEL_BOUNDS.end.y
            )
            this.objectPreview.rotation = wrap(
                this.objectPreview.rotation,
                0,
                360
            )
            this.objectPreview.scale = clamp(this.objectPreview.scale, 0.5, 2)

            if (
                this.objectPreview.mainColor.blending ||
                this.objectPreview.detailColor.blending
            ) {
                this.objectPreview.zOrder =
                    this.objectPreview.zOrder > BLENDING_LAYER_CUTOFF ? 120 : -1
            } else {
                this.objectPreview.zOrder = clamp(
                    this.objectPreview.zOrder,
                    1,
                    100
                )
            }
        }
    }

    updateObjectPreview() {
        this.correctObject()

        if (this.objectPreviewNode != null) {
            this.objectPreviewNode.destroy()
        }
        this.objectPreviewNode = new ObjectNode(
            this.objectPreview,
            this.layerGroup,
            null
        )
        const box = new PIXI.Graphics()
        box.name = "box"
        box.visible = !settings.disableObjectOutline.enabled

        this.objectPreviewNode.addChild(box)
        this.addChild(this.objectPreviewNode)
    }

    constructor(app: PIXI.Application, editorPosition) {
        super()

        this.cameraPos = vec(editorPosition.x ?? 0, editorPosition.y ?? 0)
        this.zoomLevel = editorPosition.zoom ?? 0

        let gridGraph = new PIXI.Graphics()
        this.addChild(gridGraph)

        gridGraph.clear()
        for (let x = 0; x <= LEVEL_BOUNDS.end.x; x += 30) {
            gridGraph
                .lineStyle(1.0 / this.zoom(), 0x000000, 0.35)
                .moveTo(x, LEVEL_BOUNDS.start.y)
                .lineTo(x, LEVEL_BOUNDS.end.y)
        }
        for (let y = 0; y <= LEVEL_BOUNDS.end.y; y += 30) {
            gridGraph
                .lineStyle(1.0 / this.zoom(), 0x000000, 0.35)
                .moveTo(LEVEL_BOUNDS.start.x, y)
                .lineTo(LEVEL_BOUNDS.end.x, y)
        }

        let obama = new PIXI.Sprite(PIXI.Texture.from("/obama.jpg"))
        obama.anchor.set(0.5)
        obama.position.set(LEVEL_BOUNDS.end.x, LEVEL_BOUNDS.end.y)
        obama.scale.set(0.01)
        this.addChild(obama)

        this.world = new PIXI.Container()
        this.addChild(this.world)
        this.world.sortableChildren = true

        // console.log("aaaaaaaaa", app, this)
        const countDown = new CountDownNode(
            app,
            this,
            Math.max(editorPosition.x - 27 * 30, 0)
        )
        this.addChild(countDown)

        this.selectableWorld = new PIXI.Container()
        this.addChild(this.selectableWorld)
        this.selectableWorld.sortableChildren = true

        this.groundTiling = new PIXI.TilingSprite(
            PIXI.Texture.from("/gd/world/ground.png"),
            LEVEL_BOUNDS.end.x,
            512 * GROUND_SCALE
        )
        this.groundTiling.tileScale.y = -GROUND_SCALE
        this.groundTiling.tileScale.x = GROUND_SCALE
        this.groundTiling.anchor.y = 1
        this.groundTiling.tint = 0x287dff

        this.addChild(this.groundTiling)

        let groundLine = PIXI.Sprite.from("/gd/world/ground_line.png")
        groundLine.anchor.set(0.5, 1)
        this.addChild(groundLine)

        // invisible mask before level bounds
        const mask = new PIXI.Graphics()
        mask.beginFill(0xff0000)
        mask.drawRect(
            // -100,
            // -100,
            // 200,
            // 200
            LEVEL_BOUNDS.start.x,
            LEVEL_BOUNDS.end.y - 10,
            LEVEL_BOUNDS.end.x - LEVEL_BOUNDS.start.x,
            LEVEL_BOUNDS.start.y - LEVEL_BOUNDS.end.y
        )
        mask.endFill()
        this.addChild(mask)

        groundLine.mask = mask

        this.layerGroup = new PIXI_LAYERS.Group(0, true)
        this.addChild(new PIXI_LAYERS.Layer(this.layerGroup))
        let selectableLayerGroup = new PIXI_LAYERS.Group(0, true)
        this.addChild(new PIXI_LAYERS.Layer(selectableLayerGroup))

        // this.layerGroup

        this.groundTiling.parentGroup = this.layerGroup
        this.groundTiling.zOrder = 150
        groundLine.parentGroup = this.layerGroup
        groundLine.zOrder = 150

        initChunkBehavior(
            this,
            this.world,
            this.selectableWorld,
            this.layerGroup,
            selectableLayerGroup
        )
        this.updateVisibleChunks(app)

        this.tooltip = new TooltipNode()
        this.addChild(this.tooltip)

        this.deleteLabels = new PIXI.Container()
        this.addChild(this.deleteLabels)

        setInterval(() => {
            this.unloadOffscreenChunks()
        }, 10000)

        app.ticker.add(() => {
            this.cameraPos = this.cameraPos.clamped(
                LEVEL_BOUNDS.start,
                LEVEL_BOUNDS.end
            )

            const prev_values = [this.position.x, this.position.y, this.scale.x]

            this.position.x = -this.cameraPos.x * this.zoom()
            this.position.y = -this.cameraPos.y * this.zoom()
            this.scale.set(this.zoom())

            if (
                prev_values[0] != this.position.x ||
                prev_values[1] != this.position.y ||
                prev_values[2] != this.scale.x
            ) {
                this.updateVisibleChunks(app)
            }

            //console.log(this.scale, prev_values[2])

            if (prev_values[2] != this.scale.x) {
                gridGraph.clear()
                for (let x = 0; x <= LEVEL_BOUNDS.end.x; x += 30) {
                    gridGraph
                        .lineStyle(1.0 / this.zoom(), 0x000000, 0.35)
                        .moveTo(x, LEVEL_BOUNDS.start.y)
                        .lineTo(x, LEVEL_BOUNDS.end.y)
                }
                for (let y = 0; y <= LEVEL_BOUNDS.end.y; y += 30) {
                    gridGraph
                        .lineStyle(1.0 / this.zoom(), 0x000000, 0.35)
                        .moveTo(LEVEL_BOUNDS.start.x, y)
                        .lineTo(LEVEL_BOUNDS.end.x, y)
                }
            }

            let to_delete = []
            this.deleteLabels.children.forEach((label) => {
                const del = (label as DeleteObjectLabel).update()
                if (del) {
                    to_delete.push(label)
                }
            })

            //console.log(to_delete)

            to_delete.forEach((label) => {
                label.destroy()
            })

            groundLine.position.x = this.cameraPos.x

            obama.rotation += 0.01
            obama.skew.x += 0.001
            obama.skew.x += 0.005
            obama.scale.x = Math.cos(obama.rotation) * 0.1
            obama.scale.y = Math.sin(obama.rotation) * 0.05

            if (this.objectPreviewNode != null) {
                let box = this.objectPreviewNode.getChildByName(
                    "box"
                ) as PIXI.Graphics
                let [width, height] = [
                    this.objectPreviewNode.mainSprite().width,
                    this.objectPreviewNode.mainSprite().height,
                ]
                box.clear()
                box.lineStyle(
                    1 / this.objectPreviewNode.scale.y,
                    0x00ffff,
                    1
                ).drawRect(
                    -width / 2 - 5,
                    -height / 2 - 5,
                    width + 10,
                    height + 10
                )
            }

            this.tooltip.zoom = this.zoomLevel
        })
    }

    zoom() {
        return 2 ** (this.zoomLevel / 8)
    }

    toWorld(v: Vector, screenSize: Vector) {
        let pos = v.minus(screenSize.div(2)).div(this.zoom())
        pos.y *= -1
        pos = pos.plus(this.cameraPos)
        return pos
    }
}
const BLENDING_LAYER_CUTOFF = 45
export class ObjectNode extends PIXI.Container {
    isHovering: boolean = false
    mainColor: GdColor = new GdColor("ffffff", false, 1.0)
    detailColor: GdColor = new GdColor("ffffff", false, 1.0)

    constructor(
        /// drean iubstaity
        public obj: GDObject,
        layerGroup: PIXI_LAYERS.Group,
        // tooltip will be null only on the preview object
        tooltip: TooltipNode | null
    ) {
        super()
        let mainSprite = new PIXI.Sprite(
            PIXI.Texture.from(`/gd/objects/main/${obj.id}.png`)
        )

        this.parentGroup = layerGroup
        mainSprite.interactive = true

        mainSprite.anchor.set(0.5)
        mainSprite.scale.set(0.25, -0.25)

        this.addChild(mainSprite)

        const showTooltip = () => {
            this.isHovering = true

            let t = setTimeout(() => {
                if (this.isHovering && tooltip) {
                    tooltip.update(this)
                }

                clearTimeout(t)
            }, 250)
        }

        const hideTooltip = () => {
            this.isHovering = false

            if (tooltip) {
                tooltip.visible = false
                tooltip.unHighlight()
            }
        }

        let detailSprite = new PIXI.Sprite(
            PIXI.Texture.from(`/gd/objects/detail/${obj.id}.png`)
        )
        detailSprite.interactive = true

        detailSprite.anchor.set(0.5)
        detailSprite.scale.set(0.25, -0.25)

        for (let sprite of [mainSprite, detailSprite]) {
            sprite.on("mouseover", showTooltip)
            sprite.on("touchstart", showTooltip)

            sprite.on("touchend", hideTooltip)
            sprite.on("mouseout", hideTooltip)
        }

        this.addChild(detailSprite)

        this.update(obj)
    }

    getObjInfo(): ObjectInfo {
        return {
            obj: this.obj,
            dbname: this.name,
        }
    }

    update(obj: GDObject) {
        this.scale.set(obj.scale)
        if (obj.flip) {
            this.scale.x *= -1
        }
        this.rotation = -(obj.rotation * Math.PI) / 180.0
        this.position.set(obj.x, obj.y)

        if (obj.mainColor.hex) this.setMainColor(obj.mainColor)
        if (obj.detailColor.hex) this.setDetailColor(obj.detailColor)

        if (obj.mainColor.blending || obj.detailColor.blending) {
            this.zOrder = obj.zOrder > BLENDING_LAYER_CUTOFF ? 120 : -1
        } else {
            this.zOrder = obj.zOrder
        }

        if (obj.mainColor.blending) {
            this.mainSprite().filters = [BLENDING_FILTER]
        } else {
            this.mainSprite().filters = []
        }
        if (obj.detailColor.blending) {
            this.detailSprite().filters = [BLENDING_FILTER]
        } else {
            this.detailSprite().filters = []
        }

        if (obj.mainColor.opacity)
            this.mainSprite().alpha = obj.mainColor.opacity
        else this.mainSprite().alpha = 1.0

        if (obj.detailColor.opacity)
            this.detailSprite().alpha = obj.detailColor.opacity
        else this.detailSprite().alpha = 1.0
    }

    mainSprite() {
        return this.getChildAt(0) as PIXI.Sprite
    }
    detailSprite() {
        return this.getChildAt(1) as PIXI.Sprite
    }

    setMainColor(color: GdColor) {
        this.mainColor = color
        this.mainSprite().tint = parseInt(color.hex, 16)
    }

    setDetailColor(color: GdColor) {
        this.detailColor = color
        this.detailSprite().tint = parseInt(color.hex, 16)
    }
}

let userPlacedCache = {}

class TooltipNode extends PIXI.Graphics {
    text: PIXI.Text
    nameText: PIXI.Text
    public zoom: number = 1
    public show: boolean = false

    currentObject: ObjectNode | null = null

    constructor() {
        super()

        this.text = new PIXI.Text("Placed By:", {
            fontFamily: ["Cabin", "sans-serif"],
            fontSize: 12,
            fill: [0xffffff88],
            align: "left",
        })

        this.text.anchor.set(0, 0.5)
        //this.text.transform.scale.set(0.8)

        this.nameText = new PIXI.Text("", {
            fontFamily: ["Cabin", "sans-serif"],
            fontSize: 12,
            fill: [0xffffff],
            align: "left",
        })

        this.nameText.anchor.set(0, 0.5)

        this.text.y = -this.height / 2
        this.nameText.y = -this.height / 2

        this.text.resolution = 6
        this.nameText.resolution = 6
        this.addChild(this.text)
        this.addChild(this.nameText)

        this.scale.y *= -1

        this.visible = this.show
    }

    unHighlight() {
        if (this.show && settings.showTooltips.enabled) {
            selectedObject.set(null)
        }
        if (this.currentObject) {
            this.currentObject.getChildByName("highlight")?.destroy()
        }
    }

    update(on: ObjectNode) {
        const padding = 5

        const size = Math.min(Math.max(MIN_ZOOM - this.zoom, 6), 20)

        this.text.style.fontSize = size * 0.8
        this.nameText.style.fontSize = size

        if (this.currentObject != null)
            this.currentObject.getChildByName("highlight")?.destroy()
        this.currentObject = on
        const highlight = new PIXI.Graphics()
        highlight.visible =
            this.show &&
            !settings.disableObjectOutline.enabled &&
            settings.showTooltips.enabled

        if (this.show && settings.showTooltips.enabled) {
            selectedObject.set(on.getObjInfo())
        }
        highlight.name = "highlight"
        highlight.alpha = 0.5
        highlight
            .lineStyle(1 / this.currentObject.scale.y, 0x46f0fc, 1)
            .drawRect(
                -on.mainSprite().width / 2 - 2,
                -on.mainSprite().height / 2 - 2,
                on.mainSprite().width + 4,
                on.mainSprite().height + 4
            )
        this.currentObject.addChild(highlight)

        getPlacedUsername(on.name).then(async (username) => {
            // check for color
            let color = await getUsernameColors(username)

            this.nameText.text = username
            this.nameText.style.fill = color

            this.clear()

            this.nameText.x = this.text.width + padding

            this.beginFill(0x000000, 0.7)
            this.drawRoundedRect(
                this.text.x - padding / 2,
                this.text.y + this.height / 2 - padding / 2,
                this.text.width + this.nameText.width + padding * 2,
                Math.max(this.text.height, this.nameText.height) + padding,
                5
            )

            this.x = on.x - (this.text.width + this.nameText.width) / 2
            this.y = on.y - (this.height - padding * 2)

            this.endFill()

            this.visible = this.show && settings.showTooltips.enabled
        })
    }
}

export class ObjectSelectionRect extends PIXI.Sprite {
    constructor(objNode: ObjectNode) {
        super(PIXI.Texture.WHITE)

        this.alpha = 0.2
        this.anchor.set(0.5)
        this.interactive = true
        this.scale.x =
            (objNode.mainSprite().texture.width * objNode.scale.x) / 16 / 4
        this.scale.y =
            (objNode.mainSprite().texture.height * objNode.scale.y) / 16 / 4
        this.rotation = objNode.rotation
    }
}

const DLABEL_ANIM_TIME = 2000

export class DeleteObjectLabel extends PIXI.Graphics {
    text: PIXI.Text
    nameText: PIXI.Text
    public zoom: number = 1
    spawn_time: number = 0

    constructor(username: string, public spawnPos) {
        super()
        //console.log(username)

        this.init(username)
    }

    async init(username: string) {
        this.spawn_time = Date.now()

        let color = await getUsernameColors(username)

        this.text = new PIXI.Text("Deleted by ", {
            fontFamily: ["Cabin", "sans-serif"],
            fontSize: 10,
            fill: [0xffffff],
            align: "left",
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowBlur: 2,
            dropShadowDistance: 0,
        })

        this.text.anchor.set(0, 0.5)
        //this.text.transform.scale.set(0.8)

        this.nameText = new PIXI.Text(username, {
            fontFamily: ["Cabin", "sans-serif"],
            fontSize: 14,
            fill: color,
            align: "left",
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowBlur: 2,
            dropShadowDistance: 0,
        })

        this.nameText.anchor.set(0, 0.5)

        const full_width = this.text.width + this.nameText.width + 5

        this.text.x = -full_width / 2
        this.nameText.x = this.text.width - full_width / 2
        this.x = this.spawnPos.x
        this.y = this.spawnPos.y

        this.text.resolution = 3
        this.nameText.resolution = 3
        this.addChild(this.text)
        this.addChild(this.nameText)

        this.scale.y *= -1
    }

    update() {
        this.visible = settings.showDeletion.enabled

        const d = (Date.now() - this.spawn_time) / DLABEL_ANIM_TIME
        //console.log(d)
        this.alpha = (1 - d) * 1.25 * (Math.log(d * 5) + 1) // the sput official easing function
        this.y = this.spawnPos.y + d ** 2 * 30

        if (d > 1) {
            return true
        }
        return false
    }
}
export function resetObjectColors(o: ObjectNode) {
    const obj = getObjSettings(o.obj.id)

    if (settings.showDanger.enabled) {
        if (!(obj.danger || obj.solid)) {
            o.mainSprite().alpha = o.mainColor.opacity * 0.1
            o.detailSprite().alpha = o.detailColor.opacity * 0.4
        } else {
            o.mainSprite().alpha = 1
            o.detailSprite().alpha = 1
            o.mainSprite().filters = [BRIGTHNESS_FILTER]
            o.detailSprite().filters = [BRIGTHNESS_FILTER]
        }
    } else {
        o.mainSprite().tint = parseInt(o.mainColor.hex, 16)
        o.detailSprite().tint = parseInt(o.detailColor.hex, 16)

        o.mainSprite().alpha = o.mainColor.opacity
        o.detailSprite().alpha = o.detailColor.opacity

        if (o.obj.mainColor.blending) {
            o.mainSprite().filters = [BLENDING_FILTER]
        } else {
            o.mainSprite().filters = []
        }
        if (o.obj.detailColor.blending) {
            o.detailSprite().filters = [BLENDING_FILTER]
        } else {
            o.detailSprite().filters = []
        }
    }
}

export async function getPlacedUsername(dbname: string) {
    if (userPlacedCache[dbname]) {
        return userPlacedCache[dbname]
    } else {
        const username = await get(ref(database, `userPlaced/${dbname}`))
        userPlacedCache[dbname] = username.val()
        return username.val()
    }
}
