import type { GDObject } from "./object"

export const EDIT_BUTTONS = [
    {
        tabName: "Transform",
        buttons: [
            {
                image: "left",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.x -= 30
                },
                shortcut: {
                    key: "a",
                    shift: false,
                    alt: false,
                },
            },
            {
                image: "up",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.y += 30
                },
                shortcut: {
                    key: "w",
                    shift: false,
                    alt: false,
                },
            },
            {
                image: "right",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.x += 30
                },
                shortcut: {
                    key: "d",
                    shift: false,
                    alt: false,
                },
            },
            {
                image: "down",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.y -= 30
                },
                shortcut: {
                    key: "s",
                    shift: false,
                    alt: false,
                },
            },
            {
                image: "left_small",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.x -= 2
                },
                shortcut: {
                    key: "a",
                    shift: true,
                    alt: false,
                },
            },
            {
                image: "up_small",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.y += 2
                },
                shortcut: {
                    key: "w",
                    shift: true,
                    alt: false,
                },
            },
            {
                image: "right_small",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.x += 2
                },
                shortcut: {
                    key: "d",
                    shift: true,
                    alt: false,
                },
            },
            {
                image: "down_small",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.y -= 2
                },
                shortcut: {
                    key: "s",
                    shift: true,
                    alt: false,
                },
            },
            {
                image: "left_big",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.x -= 30 * 5
                },
                shortcut: {
                    key: "a",
                    shift: false,
                    alt: true,
                },
            },
            {
                image: "up_big",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.y += 30 * 5
                },
                shortcut: {
                    key: "w",
                    shift: false,
                    alt: true,
                },
            },
            {
                image: "right_big",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.x += 30 * 5
                },
                shortcut: {
                    key: "d",
                    shift: false,
                    alt: true,
                },
            },
            {
                image: "down_big",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.y -= 30 * 5
                },
                shortcut: {
                    key: "s",
                    shift: false,
                    alt: true,
                },
            },
            {
                image: "flip_horiz",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.transform(0, true, false, true)
                },
                shortcut: {
                    key: "q",
                    shift: false,
                    alt: true,
                },
            },
            {
                image: "flip_vert",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.transform(0, false, true, true)
                },
                shortcut: {
                    key: "e",
                    shift: false,
                    alt: true,
                },
            },
            {
                image: "ccw",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.transform(-90, false, false, true)
                },
                shortcut: {
                    key: "q",
                    shift: false,
                    alt: false,
                },
            },
            {
                image: "cw",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.transform(90, false, false, true)
                },
                shortcut: {
                    key: "e",
                    shift: false,
                    alt: false,
                },
            },
            {
                image: "ccw_5",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.transform(-5, false, false, false)
                },
                shortcut: {
                    key: "q",
                    shift: true,
                    alt: false,
                },
            },
            {
                image: "cw_5",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.transform(5, false, false, false)
                },
                shortcut: {
                    key: "e",
                    shift: true,
                    alt: false,
                },
            },
            {
                image: "scale_up",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.scale += 0.1
                },
                shortcut: {
                    key: "e",
                    shift: true,
                    alt: true,
                },
            },
            {
                image: "scale_down",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.scale -= 0.1
                },
                shortcut: {
                    key: "q",
                    shift: true,
                    alt: true,
                },
            },
            {
                image: "left_small",
                scale: 0.5,
                cb: (obj: GDObject) => {
                    obj.x -= 0.5
                },
                shortcut: {
                    key: "a",
                    shift: true,
                    alt: true,
                },
            },
            {
                image: "up_small",
                scale: 0.5,
                cb: (obj: GDObject) => {
                    obj.y += 0.5
                },
                shortcut: {
                    key: "w",
                    shift: true,
                    alt: true,
                },
            },
            {
                image: "right_small",
                scale: 0.5,
                cb: (obj: GDObject) => {
                    obj.x += 0.5
                },
                shortcut: {
                    key: "d",
                    shift: true,
                    alt: true,
                },
            },
            {
                image: "down_small",
                scale: 0.5,
                cb: (obj: GDObject) => {
                    obj.y -= 0.5
                },
                shortcut: {
                    key: "s",
                    shift: true,
                    alt: true,
                },
            },
        ],
    },
    {
        tabName: "Layers",
        buttons: [
            {
                image: "z_plus",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.zOrder += 1
                },
                shortcut: {
                    key: "z",
                    shift: false,
                    alt: false,
                },
            },
            {
                image: "z_minus",
                scale: 1.0,
                cb: (obj: GDObject) => {
                    obj.zOrder -= 1
                },
                shortcut: {
                    key: "z",
                    shift: true,
                    alt: false,
                },
            },
            // {
            //     image: "ccw",
            //     scale: 1.0,
            // },
            // {
            //     image: "cw",
            //     scale: 1.0,
            // },
        ],
    },
    {
        tabName: "Colors",
        buttons: [],
    },
]

export const PALETTE = [
    "ff0000",
    "ff7f00",
    "ffbf00",
    "ffff00",
    "aaff00",
    "00ff00",
    "00ffa9",
    "00ffff",
    "00a9ff",
    "0000ff",
    "7f00ff",
    "ff00ff",
    "800000",
    "803f00",
    "805f00",
    "808000",
    "558000",
    "008000",
    "007f54",
    "008080",
    "005480",
    "000080",
    "3f0080",
    "800080",
    "ff7f7f",
    "ffbb7f",
    "ffdd7f",
    "ffff7f",
    "d4ff7f",
    "7fff7f",
    "7fffd4",
    "7fffff",
    "7fd4ff",
    "7f7fff",
    "bd7fff",
    "ff7fff",
    "803f3f",
    "805d3f",
    "806e3f",
    "80803f",
    "6a803f",
    "3f803f",
    "3f7f6a",
    "3f8080",
    "3f6a80",
    "3f3f80",
    "5e3f80",
    "803f80",

    "ffffff",
    "a8a8a8",
    "545454",
    "000000",
]
