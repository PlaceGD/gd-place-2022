import * as PIXI from "pixi.js"
import * as PIXI_LAYERS from "@pixi/layers"
import { toast } from "@zerodevx/svelte-toast"
import { get, ref } from "@firebase/database"

import { vec, Vector } from "../utils/vector"
import { GdColor, type GDObject } from "./object"
import {
    deleteObjectFromLevel,
    initChunkBehavior,
    CHUNK_SIZE,
    ChunkNode,
} from "../firebase/database"
import { clamp, wrap } from "../utils/math"

import { MAX_ZOOM, MIN_ZOOM, toastErrorTheme } from "../const"
import { database } from "../firebase/init"

export const LEVEL_BOUNDS = {
    start: vec(0, 0),
    end: vec(30 * 3000, 30 * 80),
}
const GROUND_SCALE = (30 * 4.25) / 512

const SPAWN_POS = vec(Math.random() * 30 * 1000, 0)

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

export class EditorNode extends PIXI.Container {
    public zoomLevel: number = 0
    public cameraPos: Vector = vec(0, 0)
    public objectPreview: GDObject | null = null
    public objectPreviewNode: ObjectNode | null = null
    public layerGroup: PIXI_LAYERS.Group

    public selectedObjectNode: ObjectNode | null = null
    public selectedObjectChunk: string | null = null
    public nextSelectionZ: number = -1

    public selectableWorld: PIXI.Container
    public groundTiling: PIXI.TilingSprite

    public tooltip: TooltipNode

    public world: PIXI.Container

    public visibleChunks: Set<string> = new Set()

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
                        Date.now() - timestamp > 1000 * 10 &&
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
            this.selectedObjectNode.getChildByName("select_box")?.destroy()
            this.selectedObjectNode.mainSprite().tint = parseInt(
                this.selectedObjectNode.mainColor.hex,
                16
            )
            this.selectedObjectNode.detailSprite().tint = parseInt(
                this.selectedObjectNode.detailColor.hex,
                16
            )

            this.selectedObjectNode.mainSprite().alpha =
                this.selectedObjectNode.mainColor.opacity
            this.selectedObjectNode.detailSprite().alpha =
                this.selectedObjectNode.detailColor.opacity
            this.selectedObjectNode = null
            this.selectedObjectChunk = null
        }
    }
    deleteSelectedObject() {
        if (this.selectedObjectNode != null) {
            let name = this.selectedObjectNode.name
            let chunk = this.selectedObjectChunk
            this.deselectObject()
            deleteObjectFromLevel(name, chunk).catch((err) => {
                console.log(err)
                toast.push(
                    `Failed to delete object! (${err.message})`,
                    toastErrorTheme
                )
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
            this.objectPreview.zOrder = clamp(this.objectPreview.zOrder, 1, 100)
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

        this.objectPreviewNode.addChild(box)
        this.addChild(this.objectPreviewNode)
    }

    constructor(app: PIXI.Application, editorPosition) {
        super()

        this.cameraPos = vec(editorPosition.x ?? 0, editorPosition.y ?? 0)
        this.zoomLevel = editorPosition.zoom ?? 0

        let gridGraph = new PIXI.Graphics()
        this.addChild(gridGraph)

        let obama = new PIXI.Sprite(PIXI.Texture.from("obama.jpg"))
        obama.anchor.set(0.5)
        obama.position.set(LEVEL_BOUNDS.end.x, LEVEL_BOUNDS.end.y)
        obama.scale.set(0.01)
        this.addChild(obama)

        this.world = new PIXI.Container()
        this.addChild(this.world)
        this.world.sortableChildren = true

        this.selectableWorld = new PIXI.Container()
        this.addChild(this.selectableWorld)
        this.selectableWorld.sortableChildren = true

        this.groundTiling = new PIXI.TilingSprite(
            PIXI.Texture.from("gd/world/ground.png"),
            LEVEL_BOUNDS.end.x,
            512 * GROUND_SCALE
        )
        this.groundTiling.tileScale.y = -GROUND_SCALE
        this.groundTiling.tileScale.x = GROUND_SCALE
        this.groundTiling.anchor.y = 1
        this.groundTiling.tint = 0x287dff

        this.addChild(this.groundTiling)

        let groundLine = PIXI.Sprite.from("gd/world/ground_line.png")
        groundLine.anchor.set(0.5, 1)
        this.addChild(groundLine)

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

        setInterval(() => {
            this.unloadOffscreenChunks()
        }, 5000)

        app.ticker.add(() => {
            this.cameraPos = this.cameraPos.clamped(
                LEVEL_BOUNDS.start,
                LEVEL_BOUNDS.end
            )

            const prev_values = [this.position.x, this.position.y, this.scale]

            this.position.x = -this.cameraPos.x * this.zoom()
            this.position.y = -this.cameraPos.y * this.zoom()
            this.scale.set(this.zoom())

            if (
                prev_values[0] != this.position.x ||
                prev_values[1] != this.position.y ||
                prev_values[2] != this.scale
            ) {
                this.updateVisibleChunks(app)
            }

            groundLine.position.x = this.cameraPos.x

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

export class ObjectNode extends PIXI.Container {
    isHovering: boolean = false
    mainColor: GdColor = new GdColor("ffffff", false, 1.0)
    detailColor: GdColor = new GdColor("ffffff", false, 1.0)

    constructor(
        obj: GDObject,
        layerGroup: PIXI_LAYERS.Group,
        // tooltip will be null only on the preview object
        tooltip: TooltipNode | null
    ) {
        super()
        let sprite = new PIXI.Sprite(
            PIXI.Texture.from(`gd/objects/main/${obj.id}.png`)
        )
        sprite.interactive = true

        sprite.anchor.set(0.5)
        sprite.scale.set(0.25, -0.25)
        this.parentGroup = layerGroup
        this.addChild(sprite)

        sprite.on("mouseover", () => {
            this.isHovering = true

            let t = setTimeout(() => {
                if (this.isHovering && tooltip) {
                    tooltip.update(this)
                }

                clearTimeout(t)
            }, 250)
        })

        sprite.on("touchstart", () => {
            this.isHovering = true
            if (tooltip) tooltip.update(this)
        })

        sprite.on("mouseout", () => {
            this.isHovering = false

            if (tooltip) {
                tooltip.visible = false
                tooltip.unHighlight()
            }
        })

        let detailSprite = new PIXI.Sprite(
            PIXI.Texture.from(`gd/objects/detail/${obj.id}.png`)
        )

        detailSprite.anchor.set(0.5)
        detailSprite.scale.set(0.25, -0.25)
        this.parentGroup = layerGroup

        this.addChild(detailSprite)

        this.update(obj)
    }

    update(obj: GDObject) {
        this.scale.set(obj.scale)
        if (obj.flip) {
            this.scale.x *= -1
        }
        this.rotation = -(obj.rotation * Math.PI) / 180.0
        this.position.set(obj.x, obj.y)
        this.zOrder = obj.zOrder
        if (obj.mainColor.hex) this.setMainColor(obj.mainColor)
        if (obj.detailColor.hex) this.setDetailColor(obj.detailColor)

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
let userColorCache = {}

class TooltipNode extends PIXI.Graphics {
    text: PIXI.Text
    nameText: PIXI.Text
    public zoom: number = 1

    currentObject: ObjectNode | null = null

    constructor() {
        super()

        this.text = new PIXI.Text("Placed By:", {
            fontFamily: "Cabin",
            fontSize: 12,
            fill: [0xffffff88],
            align: "left",
        })

        this.text.anchor.set(0, 0.5)
        //this.text.transform.scale.set(0.8)

        this.nameText = new PIXI.Text("", {
            fontFamily: "Cabin",
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

        this.visible = false
    }

    unHighlight() {
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
        const show = async (username) => {
            // check for color
            let color
            if (userColorCache[username]) {
                color = userColorCache[username]
            } else {
                let colorSnap = await get(
                    ref(
                        database,
                        `userName/${username?.toLowerCase()}/displayColor`
                    )
                )

                if (!colorSnap.exists()) {
                    color = 0xffffff
                } else {
                    color = colorSnap
                        .val()
                        .split(" ")
                        .map((a) => parseInt(a, 16))
                }

                userColorCache[username] = color
            }

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

            this.visible = true
        }

        if (userPlacedCache[on.name]) {
            show(userPlacedCache[on.name])
        } else {
            get(ref(database, `userPlaced/${on.name}`))
                .then((username) => {
                    userPlacedCache[on.name] = username.val()
                    show(username.val())
                })
                .catch((err) => {
                    console.error(err)

                    toast.push(
                        `Failed to get username! (${err.message})`,
                        toastErrorTheme
                    )
                })
        }
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
