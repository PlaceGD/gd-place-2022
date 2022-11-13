import { pixiApp } from "../editor/app"
import { writable } from "svelte/store"

const DEAFULT_SETTINGS = {
    showDeletion: {
        enabled: true,
        label: "Show who deleted an object ",
    },
    showTooltips: {
        enabled: true,
        label: "Show who placed an object",
    },
    disableBG: {
        enabled: false,
        label: "Disable background colors",
    },
    showObjInfo: {
        enabled: false,
        label: "Show object info on select",
    },
    disableObjectOutline: {
        enabled: false,
        label: "Hide object outline",
    },
    hideDecoObjects: {
        enabled: false,
        label: "Hide decoration objects",
        cb: (ev) => {
            pixiApp.editorNode.toggleDecoObjects()
        },
    },
}

export let settings_writable: any = writable(DEAFULT_SETTINGS)
export let settings: any = DEAFULT_SETTINGS

try {
    let savedSettings: any = localStorage.getItem("editorSettings")

    if (savedSettings) {
        savedSettings = JSON.parse(savedSettings)
        let new_settings = DEAFULT_SETTINGS
        Object.keys(savedSettings).forEach((k) => {
            new_settings[k].enabled = !!savedSettings[k]
            console.log(savedSettings[k])
        })
        settings_writable.set(new_settings)
    }
} catch (e) {
    console.error(e)
    localStorage.removeItem("editorSettings")
}

export const saveSettings = () => {
    let s = {}
    Object.keys(settings).forEach((k) => {
        s[k] = settings[k]?.enabled || false
    })

    localStorage.setItem("editorSettings", JSON.stringify(s))
}
