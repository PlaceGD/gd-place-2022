import { vec } from "../utils/vector"
import objectList from "../objects.json"

export class GdColor {
    constructor(
        public hex: string,
        public blending: boolean,
        public opacity: number
    ) {}
    toDatabaseString() {
        return `${this.hex};${this.blending ? 1 : 0};${this.opacity}`
    }
    static fromDatabaseString(str: string) {
        let [hex, blending, opacity] = str.split(";")

        return new GdColor(hex, blending == "1", parseFloat(opacity))
    }
    clone() {
        return new GdColor(this.hex, this.blending, this.opacity)
    }
}

export class GDObject {
    constructor(
        public id: number,
        public x: number,
        public y: number,
        public rotation: number,
        public flip: boolean,
        public scale: number,
        public zOrder: number,
        public mainColor: GdColor,
        public detailColor: GdColor
    ) {}

    toDatabaseString() {
        return `${this.id};${this.x};${this.y};${Math.round(this.rotation)};${
            this.flip ? 1 : 0
        };${this.scale};${
            this.zOrder
        };${this.mainColor.toDatabaseString()};${this.detailColor.toDatabaseString()}`
    }

    clone() {
        return new GDObject(
            this.id,
            this.x,
            this.y,
            this.rotation,
            this.flip,
            this.scale,
            this.zOrder,
            this.mainColor.clone(),
            this.detailColor.clone()
        )
    }

    static fromDatabaseString(s: string) {
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
        ] = s.split(";")
        //console.log(color)
        return new GDObject(
            // 🤣
            parseInt(id),
            parseFloat(x),
            parseFloat(y),
            parseInt(rotation),
            flip == "1",
            parseFloat(scale),
            parseInt(zOrder),
            new GdColor(
                mainColor,
                mainBlending == "1",
                parseFloat(mainOpacity)
            ),
            new GdColor(
                detailColor,
                detailBlending == "1",
                parseFloat(detailOpacity)
            )
        )
    }

    settings() {
        return getObjSettings(this.id)
    }

    transform(
        angle: number,
        flipHoriz: boolean,
        flipVert: boolean,
        offset: boolean
    ) {
        if (offset) {
            let settings = this.settings()
            let offVec = vec(settings.offset_x, settings.offset_y).rotated(
                -(this.rotation * Math.PI) / 180
            )
            this.x -= offVec.x
            this.y -= offVec.y
            offVec = offVec.rotated(-(angle * Math.PI) / 180)
            offVec.x *= flipHoriz ? -1 : 1
            offVec.y *= flipVert ? -1 : 1
            this.x += offVec.x
            this.y += offVec.y
        }
        this.rotation += angle
        if (flipHoriz) {
            this.flip = !this.flip
            this.rotation *= -1
        }
        if (flipVert) {
            this.flip = !this.flip
            this.rotation = 180 - this.rotation
        }
    }
}

export const OBJECT_SETTINGS: any = objectList // probably did this wrong but this breaks without .defualt

let idMapping = {}
for (let i in OBJECT_SETTINGS) {
    idMapping[OBJECT_SETTINGS[i].id] = i
}

export const getObjSettings = (id: number) =>
    (id && OBJECT_SETTINGS[idMapping[id]]) || {}
