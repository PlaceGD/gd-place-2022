<script lang="ts">
    import { onMount } from "svelte"
    import { Howl } from "howler"
    import { pinch } from "svelte-gestures"
    import { toast } from "@zerodevx/svelte-toast"

    import { vec } from "../utils/vector"
    import { DRAGGING_THRESHOLD, EditorApp, storePosState } from "./app"

    import {
        GdColor,
        GDObject,
        getObjSettings,
        OBJECT_SETTINGS,
    } from "./object"
    import { EDIT_BUTTONS, PALETTE } from "./edit"
    import { lazyLoad } from "../lazyLoad"
    import { addObjectToLevel } from "../firebase/database"
    import { canEdit, currentUserData } from "../firebase/auth"
    import { MAX_ZOOM, MIN_ZOOM, toastErrorTheme } from "../const"
    import { logEvent } from "firebase/analytics"

    let pixiCanvas: HTMLCanvasElement
    let pixiApp: EditorApp

    enum EditorMenu {
        Build,
        Edit,
        Delete,
    }

    let currentMenu = EditorMenu.Build
    let currentEditTab = 0
    let currentObjectTab = "blocks"
    const switchMenu = (to: EditorMenu) => {
        currentMenu = to
        if (currentMenu == EditorMenu.Delete) {
            pixiApp.editorNode.removePreview()
            pixiApp.editorNode.setObjectsSelectable(true)
            pixiApp.editorNode.tooltip.show = false
        } else {
            pixiApp.editorNode.setObjectsSelectable(false)
            pixiApp.editorNode.deselectObject()
            pixiApp.editorNode.tooltip.show = true
        }
    }

    // temporary way of generating categories
    let categoryList = []
    //console.log(OBJECT_SETTINGS)
    OBJECT_SETTINGS.forEach((x) => {
        if (!categoryList.includes(x.category)) categoryList.push(x.category)
    })

    // get editor position from local storage
    let editorPosition: any = localStorage.getItem("editorPosition")
    if (editorPosition) {
        editorPosition = JSON.parse(editorPosition)
    } else {
        editorPosition = { x: 0, y: 0, zoom: 0 }
    }

    onMount(() => {
        pixiApp = new EditorApp(pixiCanvas, editorPosition)
        switchMenu(EditorMenu.Build)
    })

    let lastPlaced = 0
    let lastDeleted = 0

    let placeTimeLeft = 6969696969
    let deleteTimeLeft = 6969696969

    // temporary client-side way of disabling button just to avoid user being able to spam button
    // in event that cloud function returns slowly
    let placeButtonDisabled = false
    let deleteButtonDisabled = false

    let placeTimerDone = true
    let placeTimerSound = new Howl({
        src: ["/gd/world/crystal01.ogg"],
    })

    let deleteTimerDone = true
    let deleteTimerSound = new Howl({
        src: ["/gd/world/achievement_01.ogg"],
    })

    const timer = 1 * 60

    const updateTimeLeft = () => {
        const now = Date.now()
        placeTimeLeft = Math.max(timer - (now - lastPlaced) / 1000, 0)
        deleteTimeLeft = Math.max(timer - (now - lastDeleted) / 1000, 0)
    }

    setInterval(() => {
        updateTimeLeft()
    }, 200)

    let selectedObject = 1

    const gradientFunc = (t) =>
        `conic-gradient(white ${t * 360}deg, black ${t * 360}deg 360deg)`

    let userUID = null

    currentUserData.subscribe((value) => {
        if (typeof value != "string" && value != null) {
            userUID = value.user.uid
            if (typeof value.data != "string" && value.data != null) {
                lastDeleted = value.data.lastDeleted
                lastPlaced = value.data.lastPlaced
                if (timer * 1000 - (Date.now() - lastPlaced) > 0) {
                    let t = setTimeout(() => {
                        placeTimerSound.play()
                        clearTimeout(t)
                    }, Math.max(timer * 1000 - (Date.now() - lastPlaced), 0))
                    console.log(
                        Math.max(timer * 1000 - (Date.now() - lastPlaced), 0)
                    )
                }

                if (timer * 1000 - (Date.now() - lastDeleted) > 0) {
                    let t2 = setTimeout(() => {
                        deleteTimerSound.play()
                        clearTimeout(t2)
                    }, Math.max(timer * 1000 - (Date.now() - lastDeleted), 0))
                }

                updateTimeLeft()
                //deleteTimerDone = false
            }
        }
    })

    function updateObjectCategory(tab: string) {
        currentObjectTab = tab
        document.querySelectorAll(".obj_button").forEach((x) => {
            let c = x.getAttribute("data-category")
            x.setAttribute("style", c != tab ? "display: none !important" : "")
        })
    }
    updateObjectCategory(currentObjectTab)

    let mobile_screen =
        window.innerWidth < window.innerHeight || window.innerHeight < 600

    let menuIndex = 0
    function nextMenu(): EditorMenu {
        return [EditorMenu.Build, EditorMenu.Edit, EditorMenu.Delete][
            menuIndex++ % 3
        ]
    }
</script>

<svelte:window
    on:resize={() => {
        mobile_screen =
            window.innerWidth < window.innerHeight || window.innerHeight < 600
    }}
    on:pointerup={(e) => {
        pixiApp.dragging = null
    }}
    on:pointermove={(e) => {
        pixiApp.mousePos = vec(e.pageX, e.pageY)
        if (
            pixiApp.dragging &&
            !pixiApp.draggingThresholdReached &&
            pixiApp.mousePos.distTo(pixiApp.dragging.prevMouse) >=
                DRAGGING_THRESHOLD
        ) {
            pixiApp.draggingThresholdReached = true
            pixiApp.dragging.prevMouse = vec(e.pageX, e.pageY)
        }
    }}
    on:keydown={(e) => {
        if ($canEdit) {
            if (e.code == "Digit1") {
                e.preventDefault()
                switchMenu(EditorMenu.Build)
                return
            }
            if (e.code == "Digit2") {
                e.preventDefault()
                switchMenu(EditorMenu.Edit)
                return
            }
            if (e.code == "Digit3") {
                e.preventDefault()
                switchMenu(EditorMenu.Delete)
                return
            }
            for (let tab of EDIT_BUTTONS) {
                for (let button of tab.buttons) {
                    if (
                        e.key.toLowerCase() == button.shortcut?.key &&
                        e.shiftKey == button.shortcut?.shift &&
                        e.altKey == button.shortcut?.alt
                    ) {
                        let obj = pixiApp.editorNode.objectPreview
                        e.preventDefault()
                        if (
                            !(
                                obj == null ||
                                (["cw_5", "ccw_5"].includes(button["image"]) &&
                                    getObjSettings(
                                        pixiApp.editorNode.objectPreview?.id
                                    ).solid)
                            )
                        ) {
                            button.cb(obj)
                            pixiApp.editorNode.updateObjectPreview()
                        }
                        return
                    }
                }
            }
        }
    }}
/>

<div class="editor">
    <canvas
        class="pixi_canvas"
        bind:this={pixiCanvas}
        on:pointerdown={(e) => {
            pixiApp.draggingThresholdReached = false
            pixiApp.dragging = {
                prevCamera: pixiApp.editorNode.cameraPos.clone(),
                prevMouse: vec(e.pageX, e.pageY),
            }
        }}
        on:wheel={(e) => {
            e.preventDefault()
            // if (e.ctrlKey) {
            let wm = pixiApp.editorNode.toWorld(
                pixiApp.mousePos,
                pixiApp.canvasSize()
            )
            let prevZoom = pixiApp.editorNode.zoom()
            pixiApp.editorNode.zoomLevel += e.deltaY > 0 ? -1 : 1
            pixiApp.editorNode.zoomLevel = Math.min(
                MIN_ZOOM,
                Math.max(MAX_ZOOM, pixiApp.editorNode.zoomLevel)
            )
            let zoomRatio = pixiApp.editorNode.zoom() / prevZoom
            pixiApp.editorNode.cameraPos = wm.plus(
                pixiApp.editorNode.cameraPos.minus(wm).div(zoomRatio)
            )
            // } else if (e.shiftKey) {
            //     pixiApp.editorNode.cameraPos.x += e.deltaY
            //     pixiApp.editorNode.cameraPos.y -= e.deltaX
            // } else {
            //     pixiApp.editorNode.cameraPos.y -= e.deltaY
            //     pixiApp.editorNode.cameraPos.x += e.deltaX
            // }
            // set editor position to local storage
            storePosState(pixiApp)
        }}
        use:pinch
        on:pinch={({ detail }) => {
            pixiApp.dragging = null
            let prevZoom = pixiApp.editorNode.zoom()

            if (pixiApp.pinching == null) {
                pixiApp.pinching = {
                    prevZoom: pixiApp.editorNode.zoom(),
                }
            }

            pixiApp.editorNode.zoomLevel =
                Math.log2(pixiApp.pinching.prevZoom * detail.scale) * 8

            let wm = pixiApp.editorNode.toWorld(
                vec(detail.center.x, detail.center.y),
                pixiApp.canvasSize()
            )

            pixiApp.editorNode.zoomLevel = Math.min(
                MIN_ZOOM,
                Math.max(MAX_ZOOM, pixiApp.editorNode.zoomLevel)
            )
            let zoomRatio = pixiApp.editorNode.zoom() / prevZoom
            pixiApp.editorNode.cameraPos = wm.plus(
                pixiApp.editorNode.cameraPos.minus(wm).div(zoomRatio)
            )
            // set editor position to local storage
            storePosState(pixiApp)
        }}
        on:pointerup={(e) => {
            pixiApp.pinching = null
            pixiApp.mousePos = vec(e.pageX, e.pageY)
            if (currentMenu == EditorMenu.Delete) {
                return
            }
            if (pixiApp.editorNode.tooltip.currentObject)
                pixiApp.editorNode.tooltip.currentObject.isHovering = false
            if (pixiApp.editorNode.tooltip.visible) {
                if (pixiApp.editorNode.tooltip) {
                    pixiApp.editorNode.tooltip.visible = false
                    pixiApp.editorNode.tooltip.unHighlight()
                }
                return
            }
            if ($canEdit) {
                if (
                    pixiApp.dragging == null ||
                    !pixiApp.draggingThresholdReached
                ) {
                    const settings = getObjSettings(selectedObject)

                    let snapped = pixiApp.editorNode
                        .toWorld(pixiApp.mousePos, pixiApp.canvasSize())
                        .snapped(30)
                        .plus(vec(15, 15))

                    if (
                        pixiApp.editorNode.objectPreview == null ||
                        selectedObject != pixiApp.editorNode.objectPreview?.id
                    ) {
                        pixiApp.editorNode.objectPreview = new GDObject(
                            selectedObject,
                            snapped.x + settings.offset_x,
                            snapped.y + settings.offset_y,
                            0,
                            false,
                            1.0,
                            50,
                            new GdColor("ffffff", false, 1.0),
                            new GdColor("ffffff", false, 1.0)
                        )
                    } else {
                        const obj = pixiApp.editorNode.objectPreview

                        pixiApp.editorNode.objectPreview.x = snapped.x
                        pixiApp.editorNode.objectPreview.y = snapped.y

                        let offVec = vec(
                            settings.offset_x,
                            settings.offset_y
                        ).rotated(-(obj.rotation * Math.PI) / 180)
                        obj.x += offVec.x
                        obj.y += offVec.y
                        // offVec = offVec.rotated(-(obj.rotation * Math.PI) / 180)
                        // obj.x += offVec.x
                        // obj.y += offVec.y
                    }
                    pixiApp.editorNode.updateObjectPreview()
                }
            }
        }}
    />

    <div class="playbutton">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <img
            src={pixiApp?.playingMusic
                ? "/gd/editor/GJ_stopMusicBtn_001.png"
                : "/gd/editor/GJ_playMusicBtn_001.png"}
            alt="play music"
            height="75"
            id="music_button"
            on:click={() => {
                pixiApp.playingMusic = !pixiApp.playingMusic
                if (pixiApp.playingMusic) {
                    pixiApp.playMusic()
                } else {
                    pixiApp.stopMusic()
                }
            }}
        />
    </div>

    {#if $canEdit}
        <div class="menu">
            <div
                class="side_panel menu_panel"
                style={mobile_screen
                    ? "justify-content: center; margin: 0;"
                    : ""}
            >
                {#if mobile_screen}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <div
                        class="portrait_button_container"
                        on:click={() => {
                            switchMenu(nextMenu())
                        }}
                    >
                        <button
                            class="portrait_button invis_button wiggle_button"
                            style:opacity={+(currentMenu == EditorMenu.Build)}
                            style:transform="scale({1 -
                                0.3 * +(currentMenu != EditorMenu.Build)})"
                        >
                            <img
                                draggable="false"
                                src="/gd/editor/side/build.svg"
                                alt=""
                                class="side_panel_button_icon"
                            />
                            {#if placeTimeLeft != 0}
                                <div
                                    class="radial_timer"
                                    style:background={gradientFunc(
                                        1 - placeTimeLeft / timer
                                    )}
                                />
                            {/if}
                        </button>

                        <button
                            class="portrait_button invis_button wiggle_button"
                            style:opacity={+(currentMenu == EditorMenu.Edit)}
                            style:transform="scale({1 -
                                0.3 * +(currentMenu != EditorMenu.Edit)})"
                        >
                            <img
                                draggable="false"
                                src="/gd/editor/side/edit.svg"
                                alt=""
                                class="side_panel_button_icon"
                            />
                        </button>

                        <button
                            class="portrait_button invis_button wiggle_button"
                            style:opacity={+(currentMenu == EditorMenu.Delete)}
                            style:transform="scale({1 -
                                0.3 * +(currentMenu != EditorMenu.Delete)})"
                        >
                            <img
                                draggable="false"
                                src="/gd/editor/side/delete.svg"
                                alt=""
                                class="side_panel_button_icon"
                            />

                            {#if deleteTimeLeft != 0}
                                <div
                                    class="radial_timer"
                                    style:background={gradientFunc(
                                        1 - deleteTimeLeft / timer
                                    )}
                                />
                            {/if}
                        </button>
                    </div>

                    <div class="dots">
                        <span
                            class="dot"
                            id={currentMenu == EditorMenu.Build ? "dot_on" : ""}
                        />
                        <span
                            class="dot"
                            id={currentMenu == EditorMenu.Edit ? "dot_on" : ""}
                        />
                        <span
                            class="dot"
                            id={currentMenu == EditorMenu.Delete
                                ? "dot_on"
                                : ""}
                        />
                    </div>
                {:else}
                    <button
                        class="invis_button wiggle_button"
                        style:opacity={currentMenu == EditorMenu.Build
                            ? 1
                            : 0.25}
                        on:click={() => {
                            switchMenu(EditorMenu.Build)
                        }}
                    >
                        <img
                            draggable="false"
                            src="/gd/editor/side/build.svg"
                            alt=""
                            class="side_panel_button_icon"
                        />
                        {#if placeTimeLeft != 0}
                            <div
                                class="radial_timer"
                                style:background={gradientFunc(
                                    1 - placeTimeLeft / timer
                                )}
                            />
                        {/if}
                    </button>
                    <button
                        class="invis_button wiggle_button"
                        on:click={() => {
                            switchMenu(EditorMenu.Edit)
                        }}
                        style:opacity={currentMenu == EditorMenu.Edit
                            ? 1
                            : 0.25}
                    >
                        <img
                            draggable="false"
                            src="/gd/editor/side/edit.svg"
                            alt=""
                            class="side_panel_button_icon"
                        />
                    </button>
                    <button
                        class="invis_button wiggle_button"
                        style:opacity={currentMenu == EditorMenu.Delete
                            ? 1
                            : 0.25}
                        on:click={() => {
                            switchMenu(EditorMenu.Delete)
                        }}
                    >
                        <img
                            draggable="false"
                            src="/gd/editor/side/delete.svg"
                            alt=""
                            class="side_panel_button_icon"
                        />

                        {#if deleteTimeLeft != 0}
                            <div
                                class="radial_timer"
                                style:background={gradientFunc(
                                    1 - deleteTimeLeft / timer
                                )}
                            />
                        {/if}
                    </button>
                {/if}
            </div>

            <div class="buttons_panel menu_panel">
                {#if currentMenu == EditorMenu.Build}
                    <div class="tabs">
                        {#each categoryList as objectTab}
                            <button
                                class="obj_tab_button tab_button invis_button"
                                on:click={() => {
                                    updateObjectCategory(objectTab)
                                }}
                                style={currentObjectTab == objectTab
                                    ? "height: 40px;"
                                    : "height: 32px; margin-top: 8px;"}
                            >
                                <img
                                    draggable="false"
                                    alt=""
                                    class="obj_tab_icon"
                                    use:lazyLoad={`/gd/objects/main/${
                                        OBJECT_SETTINGS.find(
                                            (x) =>
                                                x.category == objectTab &&
                                                x.categoryIcon
                                        )?.id || 1607
                                    }.png`}
                                />
                            </button>
                        {/each}
                    </div>
                    <div class="objects_grid_container">
                        <div class="objects_grid" id="objects_list">
                            {#each OBJECT_SETTINGS as objectData}
                                <button
                                    class="obj_button invis_button wiggle_button"
                                    data-category={objectData.category}
                                    data-id={objectData.id}
                                    style={currentObjectTab !=
                                    objectData.category
                                        ? "display: none !important"
                                        : ""}
                                    id={selectedObject == objectData.id
                                        ? "selected_obj_button"
                                        : ""}
                                    on:click={() => {
                                        selectedObject = objectData.id
                                    }}
                                >
                                    <img
                                        draggable="false"
                                        alt=""
                                        class="button_icon"
                                        use:lazyLoad={`/gd/objects/main/${objectData.id}.png`}
                                    />
                                    {#if objectData.comment}
                                        <p class="object_comment">
                                            {objectData.comment}
                                        </p>
                                    {/if}
                                    <p class="debug_objectID object_comment">
                                        {objectData.id}
                                    </p>
                                </button>
                            {/each}
                        </div>
                    </div>
                {:else if currentMenu == EditorMenu.Edit}
                    <div class="tabs">
                        {#each EDIT_BUTTONS as editTab, i}
                            <button
                                class="tab_button invis_button"
                                style={currentEditTab == i
                                    ? "height: 40px;"
                                    : "height: 32px; margin-top: 8px;"}
                                on:click={() => {
                                    currentEditTab = i
                                }}
                            >
                                {editTab.tabName}
                            </button>
                        {/each}
                    </div>
                    <div class="objects_grid_container">
                        <div class="objects_grid">
                            {#each EDIT_BUTTONS[currentEditTab].buttons as editButton, i (currentEditTab * 100 + i)}
                                <button
                                    class="edit_button invis_button wiggle_button"
                                    disabled={pixiApp.editorNode
                                        .objectPreview == null ||
                                        (["cw_5", "ccw_5"].includes(
                                            editButton["image"]
                                        ) &&
                                            getObjSettings(
                                                pixiApp.editorNode.objectPreview
                                                    ?.id
                                            ).solid)}
                                    on:click={() => {
                                        if (
                                            pixiApp.editorNode.objectPreview !=
                                            null
                                        ) {
                                            editButton.cb(
                                                pixiApp.editorNode.objectPreview
                                            )

                                            pixiApp.editorNode.updateObjectPreview()
                                        }
                                    }}
                                >
                                    <img
                                        draggable="false"
                                        style="transform: scale({editButton.scale})"
                                        class="button_icon"
                                        alt=""
                                        use:lazyLoad={`/gd/editor/edit/${editButton["image"]}.png`}
                                    />
                                </button>
                            {/each}

                            <!-- extra buttons -->
                            {#if currentEditTab == 1 && pixiApp.editorNode.objectPreview != null}
                                <t class="edit_info_text">
                                    Z = {pixiApp.editorNode.objectPreview
                                        ?.zOrder}
                                </t>
                            {/if}

                            {#if currentEditTab == 2}
                                {#each ["Main", "Detail"] as channel}
                                    <div class="color_header">
                                        {channel}
                                    </div>

                                    {#each PALETTE as color}
                                        <button
                                            class="edit_button invis_button wiggle_button"
                                            disabled={!getObjSettings(
                                                pixiApp.editorNode.objectPreview
                                                    ?.id
                                            ).tintable ||
                                                pixiApp?.editorNode
                                                    ?.objectPreview == null ||
                                                (channel == "Main" &&
                                                    pixiApp?.editorNode
                                                        ?.objectPreview
                                                        ?.mainColor.blending &&
                                                    color == "000000") ||
                                                (channel == "Detail" &&
                                                    pixiApp?.editorNode
                                                        ?.objectPreview
                                                        ?.detailColor
                                                        .blending &&
                                                    color == "000000")}
                                            on:click={() => {
                                                if (
                                                    pixiApp.editorNode
                                                        .objectPreview != null
                                                ) {
                                                    if (channel == "Main")
                                                        pixiApp.editorNode.objectPreview.mainColor.hex =
                                                            color
                                                    else
                                                        pixiApp.editorNode.objectPreview.detailColor.hex =
                                                            color

                                                    pixiApp.editorNode.updateObjectPreview()
                                                }
                                            }}
                                        >
                                            <div
                                                class="color_icon"
                                                style="background-color: {'#' +
                                                    color};"
                                            />
                                        </button>
                                    {/each}

                                    <div class="blending_opacity_container">
                                        <button
                                            class="blending_toggle wiggle_button"
                                            style={(channel == "Main" &&
                                                pixiApp.editorNode.objectPreview
                                                    ?.mainColor.blending) ||
                                            (channel == "Detail" &&
                                                pixiApp.editorNode.objectPreview
                                                    ?.detailColor.blending)
                                                ? "border: 2px solid red"
                                                : ""}
                                            disabled={!getObjSettings(
                                                pixiApp.editorNode.objectPreview
                                                    ?.id
                                            ).tintable ||
                                                pixiApp.editorNode
                                                    .objectPreview == null ||
                                                (channel == "Main" &&
                                                    pixiApp.editorNode
                                                        .objectPreview
                                                        ?.mainColor.hex ==
                                                        "000000") ||
                                                (channel == "Detail" &&
                                                    pixiApp.editorNode
                                                        .objectPreview
                                                        ?.detailColor.hex ==
                                                        "000000")}
                                            on:click={() => {
                                                if (
                                                    pixiApp.editorNode
                                                        .objectPreview != null
                                                ) {
                                                    if (channel == "Main")
                                                        pixiApp.editorNode.objectPreview.mainColor.blending =
                                                            !pixiApp.editorNode
                                                                .objectPreview
                                                                .mainColor
                                                                .blending
                                                    else if (
                                                        channel == "Detail"
                                                    )
                                                        pixiApp.editorNode.objectPreview.detailColor.blending =
                                                            !pixiApp.editorNode
                                                                .objectPreview
                                                                .detailColor
                                                                .blending
                                                    pixiApp.editorNode.updateObjectPreview()
                                                }
                                            }}
                                        >
                                            Blending
                                        </button>
                                        <!-- opacity slider -->
                                        <div class="opacity_slider_container">
                                            <div class="edit_info_text">
                                                Opacity
                                            </div>
                                            <input
                                                type="range"
                                                min="0.2"
                                                max="1"
                                                step="0.2"
                                                value={channel == "Main"
                                                    ? pixiApp.editorNode
                                                          .objectPreview
                                                          ?.mainColor.opacity
                                                    : pixiApp.editorNode
                                                          .objectPreview
                                                          ?.detailColor.opacity}
                                                class="opacity_slider"
                                                disabled={!getObjSettings(
                                                    pixiApp.editorNode
                                                        .objectPreview?.id
                                                ).tintable ||
                                                    pixiApp?.editorNode
                                                        ?.objectPreview == null}
                                                on:input={(e) => {
                                                    if (
                                                        pixiApp.editorNode
                                                            .objectPreview !=
                                                        null
                                                    ) {
                                                        const val = e.target
                                                        if (channel == "Main")
                                                            pixiApp.editorNode.objectPreview.mainColor.opacity =
                                                                val.value
                                                        else if (
                                                            channel == "Detail"
                                                        )
                                                            pixiApp.editorNode.objectPreview.detailColor.opacity =
                                                                val.value

                                                        pixiApp.editorNode.updateObjectPreview()
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    </div>
                {:else}
                    <div class="delete_menu">
                        Select the object you want to delete!
                    </div>
                {/if}
            </div>

            {#if currentMenu != EditorMenu.Delete}
                <button
                    class="place_button invis_button wiggle_button"
                    disabled={placeButtonDisabled || placeTimeLeft > 0}
                    on:click={() => {
                        placeButtonDisabled = true

                        if (
                            pixiApp.editorNode.objectPreview &&
                            placeTimeLeft == 0
                        ) {
                            addObjectToLevel(pixiApp.editorNode.objectPreview)
                                .catch((err) => {
                                    console.log(err)
                                    toast.push(
                                        `Failed to place object! (${err.message})`,
                                        toastErrorTheme
                                    )

                                    placeButtonDisabled = false
                                })
                                .then(() => {
                                    pixiApp.editorNode.removePreview()

                                    placeButtonDisabled = false
                                })
                        }
                    }}
                >
                    <div
                        style="opacity: {placeTimeLeft == 0
                            ? 1
                            : 0.5}; transform: scale({placeTimeLeft == 0
                            ? 1.0
                            : 0.7});transition: ease-in-out 0.4s;"
                    >
                        Place
                    </div>

                    <div
                        class="timer"
                        style="font-size:{placeTimeLeft == 0
                            ? 0
                            : 'var(--timer-font)'} !important;transition: ease-in-out 0.4s; text-align: center"
                    >
                        {new Date(placeTimeLeft * 1000)
                            .toISOString()
                            .substring(14, 19)}
                    </div>
                </button>
            {:else}
                <button
                    class="delete_button invis_button wiggle_button"
                    disabled={deleteButtonDisabled || deleteTimeLeft > 0}
                    on:click={() => {
                        deleteButtonDisabled = true

                        if (deleteTimeLeft == 0) {
                            pixiApp.editorNode.deleteSelectedObject()

                            deleteButtonDisabled = false
                        }
                    }}
                >
                    <div
                        style="opacity: {deleteTimeLeft == 0
                            ? 1
                            : 0.5}; transform: scale({deleteTimeLeft == 0
                            ? 1.0
                            : 0.7});transition: ease-in-out 0.4s;"
                    >
                        Delete
                    </div>

                    <div
                        class="timer"
                        style="font-size:{deleteTimeLeft == 0
                            ? 0
                            : 'var(--timer-font)'} !important;transition: ease-in-out 0.4s;"
                    >
                        {new Date(deleteTimeLeft * 1000)
                            .toISOString()
                            .substring(14, 19)}
                    </div>
                </button>
            {/if}
        </div>
    {:else}
        <div class="login_requirement_message">
            You must be signed in to help build the level!
            <div style="transform:scale(0.8);opacity:0.5;margin-top:10px;">
                (click the icon in the top right corner)
            </div>
        </div>
    {/if}
</div>

<style>
    :root {
        --menu-height: 300px;
        --font-small: 24px;
        --font-medium: 32px;
        --font-large: 48px;
        --side-panel-icon-size: 56px;
        --icon-padding: 15px;
        --grid-button-size: 70px;
        --grid-gap: 16px;

        --tab-width: 170px;

        --timer-scale: 1;

        --timer-font: 70px;
    }

    @media screen and (max-height: 800px) {
        :root {
            --menu-height: 220px;
            --font-small: 20px;
            --font-medium: 30px;
            --font-large: 40px;
            --side-panel-icon-size: 38px;
            --timer-scale: 0.678571429;
            --grid-button-size: 50px;
            --grid-gap: 12px;
            --timer-font: 40px;
        }
    }

    @media screen and (max-height: 375px) {
        :root {
            --menu-height: 150px;
            --font-small: 18px;
            --font-medium: 24px;
            --font-large: 32px;
            --side-panel-icon-size: 38px;
            --icon-padding: 5px;
            --timer-scale: 0.5;
            --grid-button-size: 35px;
            --grid-gap: 10px;
            --timer-font: 24px;
        }
    }

    @media screen and (orientation: landscape) and (max-height: 600px) {
        .menu {
            grid-template-columns: auto 1fr 20vw !important;
        }

        .place_button,
        .delete_button {
            max-width: 20vw !important;
        }

        .timer {
            font-size: 24px !important;
        }

        .side_panel {
            min-width: 80px !important;
            min-height: 80px !important;
        }

        .login_requirement_message {
            max-height: 25vh;
            font-size: calc(var(--font-medium) - 6px) !important;
        }
    }

    .timer {
        justify-self: center;
        opacity: 1;
        /* font-size: var(--font-large); */
        --webkit-text-stroke: 2px black;
        text-shadow: 0 0 4px black;
    }

    @media screen and (orientation: portrait) {
        :root {
            --grid-button-size: 45px;
            --grid-gap: 12px;
            --font-medium: 22px;
            --font-large: 32px;

            --side-panel-icon-size: 100%;
        }

        .menu {
            grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) !important;
            row-gap: var(--grid-gap) !important;
        }

        .side_panel {
            min-width: 80px !important;
            min-height: 80px !important;
            grid-row-start: 2 !important;
        }

        .tab_button {
            font-size: calc(var(--font-small) * 0.8) !important;
        }

        .buttons_panel {
            min-width: 200px !important;
            grid-column-start: 1 !important;
        }

        .place_button,
        .delete_button {
            grid-area: placeh !important;
            justify-self: center !important;
            width: 100% !important;
        }

        .login_requirement_message {
            font-size: calc(var(--font-large) - 6px) !important;
        }
    }

    @media screen and (max-width: 500px) {
        :root {
            --grid-button-size: 30px;
            --font-medium: 18px;
        }
    }

    * {
        -webkit-user-drag: none;
        -webkit-tap-highlight-color: rgba(255, 255, 255, 0);
    }

    ::-webkit-scrollbar {
        width: 15px;
        height: 15px;
    }
    ::-webkit-scrollbar-thumb {
        border-radius: 8px;
        background-color: #c3c3c3;
        border: 2px solid #eee;
    }

    ::-webkit-scrollbar-track {
        -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.2);
        box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.2);
    }

    .editor {
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        position: fixed;
    }
    .editor > canvas {
        position: fixed;
        width: 100vw;
        height: 100vh;
        display: inline-block;
    }

    .menu {
        width: 100%;
        height: min(var(--menu-height), 30vh);
        display: grid;
        grid-auto-columns: 1fr;
        grid-template-columns: auto 1fr auto;
        grid-template-rows: minmax(0, 1fr) 0px;
        grid-template-areas:
            "menu buttons placev"
            "menu placeh placeh";
        column-gap: var(--grid-gap);
        z-index: 10;
        padding: var(--grid-gap);

        position: fixed;
        bottom: 0;
    }

    .login_requirement_message {
        width: calc(100% - 32px);
        height: 300px;
        z-index: 10;
        display: flex;
        margin: 16px;
        background-color: #000c;
        border-radius: 16px;
        padding: var(--font-large);
        justify-content: center;
        flex-direction: column;
        align-items: center;
        font-family: Pusab, Helvetica, sans-serif;
        color: white;
        font-size: calc(var(--font-large) - 6px);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        text-align: center;
    }

    .menu_panel {
        background-color: #000c;
        border-radius: 16px;
        box-shadow: 0 8px 12px 0 #000a;
        backdrop-filter: blur(30px);
        -webkit-backdrop-filter: blur(30px);
    }

    .side_panel {
        min-width: min(120px, 10vh);
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        padding-top: var(--icon-padding);
        padding-bottom: var(--icon-padding);
        grid-area: menu;
        align-self: start;
    }
    .side_panel_button_icon {
        width: var(--side-panel-icon-size);
    }
    .side_panel.menu_panel > button {
        position: relative;
    }

    .dots {
        display: flex;
        flex-direction: row;
        margin-top: 5px;
    }

    .dot {
        height: 6px;
        width: 6px;
        background-color: rgb(255, 255, 255, 0.5);
        border-radius: 50%;
        display: inline-block;
        margin: 3px;
        transition: 0.3s;
    }
    #dot_on {
        background-color: rgb(255, 255, 255);
        transform: scale(1.2);
        transition: 0.1s;
    }
    .radial_timer {
        position: absolute;
        width: calc(var(--timer-scale) * 24px);
        height: calc(var(--timer-scale) * 24px);
        bottom: 0;
        right: 0;
        border-radius: 50%;
        /* backdrop-filter: blur(12px); */
        border: calc(var(--timer-scale) * 3.5px) solid white;
        background: conic-gradient(white 30deg, #000a 30deg 360deg);
    }

    .buttons_panel {
        width: 100%;
        min-width: 400px;
        height: 100%;
        display: grid;
        grid-template-rows: auto 1fr;
        grid-template-areas: "tabs" "container";
        gap: 0px 0px;
        grid-area: buttons;
        position: relative;
    }

    .tabs {
        grid-area: tabs;
        height: 40px;
        width: calc(100% - 32px);
        position: absolute;
        transform: translateY(-100%);
        justify-self: center;
        display: flex;
    }
    .tab_button {
        height: 32px;
        max-width: 250px;
        flex: 1 0 auto;
        background-color: #000e;
        border-radius: 16px 16px 0 0;
        margin: 0 8px 0 0;
        font-family: Pusab, Helvetica, sans-serif;
        -webkit-text-stroke: 1.5px black;
        color: white;
        font-size: var(--font-small);
        transition: 0.2s;
    }

    .tab_button .obj_tab_icon {
        width: auto;
        height: auto;
        max-width: max(20px, 2vw);
        max-height: max(20px, 2vw);
        object-fit: contain;
        vertical-align: middle;
        margin: 3px;
    }

    .portrait_button_container {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 100%;
        height: 100%;
        overflow: hidden;
        cursor: pointer;
    }

    .portrait_button {
        position: absolute;
        height: auto;
        width: auto;
        transition: all 0.2s;
    }

    .edit_info_text {
        font-family: Pusab, Helvetica, sans-serif;
        -webkit-text-stroke: 1.5px black;
        color: white;
        font-size: var(--font-medium);

        display: flex;
        justify-content: center;
        align-items: center;

        grid-column-start: 1;
        grid-column-end: 3;
    }
    .objects_grid_container {
        overflow-y: scroll;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        position: relative;
    }
    .objects_grid {
        grid-area: container;
        width: 100%;
        display: grid;
        height: fit-content;
        max-height: 100%;
        grid-template-columns: repeat(auto-fill, var(--grid-button-size));
        justify-content: center;
        padding: var(--grid-gap);
        gap: 12px;
    }

    .delete_menu {
        width: 100%;
        height: 100%;
        padding: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: Pusab, Helvetica, sans-serif;
        color: white;
        font-size: calc(var(--font-medium));
        grid-area: container;
        text-align: center;
        -webkit-text-stroke: 1px black;
    }

    .place_button {
        width: 300px;
        height: 100%;
        background-color: #7ade2d;
        border-radius: 18px;
        box-shadow: 0 0 0 4px white inset, 0 0 0 8px black inset,
            4px 4px 0 8px #c6f249 inset, -4px -4px 0 8px #49851b inset;
        font-family: Pusab, Helvetica, sans-serif;
        color: white;
        font-size: var(--font-large);
        -webkit-text-stroke: 2.5px black;
        justify-self: end;
        grid-area: placev;

        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    .delete_button {
        width: 300px;
        height: 100%;
        background-color: #de2d30;
        border-radius: 18px;
        box-shadow: 0 0 0 4px white inset, 0 0 0 8px black inset,
            4px 4px 0 8px #f24980 inset, -4px -4px 0 8px #851b1d inset;
        font-family: Pusab, Helvetica, sans-serif;
        color: white;
        font-size: var(--font-large);
        -webkit-text-stroke: 2.5px black;
        justify-self: end;

        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    .obj_button {
        width: var(--grid-button-size);
        height: var(--grid-button-size);
        border-radius: 6px;
        background-image: linear-gradient(rgb(190, 190, 190), rgb(70, 70, 70));
        box-shadow: 0 4px 8px 0 #00000070;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
    }

    #selected_obj_button {
        outline: 3px solid #a2ffa2;
        transform: scale(1.1);
    }

    .debug_objectID {
        display: none;
    }

    .object_comment {
        font-size: 10px;
        position: absolute;
        top: 5px;
        left: 5px;
        text-align: left;
        color: white;
        font-weight: bold;
        text-shadow: 1px 1px 2px black;
    }

    .edit_button {
        width: var(--grid-button-size);
        height: var(--grid-button-size);
        border-radius: 6px;
        background-image: linear-gradient(rgb(183, 247, 130), rgb(64, 117, 48));
        box-shadow: 0 4px 8px 0 #00000070;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .edit_button:disabled {
        opacity: 0.3;
    }

    .blending_opacity_container {
        display: flex;
        gap: 8px;
        justify-content: center;
        width: 100%;
        grid-column-end: 8;
        grid-column-start: 1;
    }

    .color_header {
        display: flex;
        gap: 8px;
        justify-content: center;
        width: auto;
        grid-column-end: 8;
        grid-column-start: 2;

        font-family: Pusab, Helvetica, sans-serif;
        -webkit-text-stroke: 1.5px black;
        color: white;
        font-size: var(--font-large);
    }

    .blending_toggle {
        height: var(--grid-button-size);
        width: 100%;
        border-radius: 6px;
        background-image: linear-gradient(rgb(183, 247, 130), rgb(64, 117, 48));
        box-shadow: 0 4px 8px 0 #00000070;
        display: flex;
        justify-content: center;
        align-items: center;

        font-family: Pusab, Helvetica, sans-serif;
        color: white;
        font-size: var(--font-medium);
        -webkit-text-stroke: 1.5px black;
        justify-self: end;
    }

    .blending_toggle:disabled {
        opacity: 0.3;
    }

    .opacity_slider_container {
        width: 100%;
        height: 100%;

        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        flex-direction: column;
    }

    .opacity_slider:disabled {
        opacity: 0.3;
    }

    .opacity_slider {
        background: none;
        appearance: none;
    }

    input[type="range"]::-moz-range-track {
        -moz-appearance: none;
        width: 100%;
        height: 100%;
        background: linear-gradient(to right, #00000000 0%, #ffffffff 100%);
        background-color: none;
        border-radius: 6px;
    }
    input[type="range"]::-webkit-slider-runnable-track {
        width: 100%;
        height: 100%;
        background: linear-gradient(to right, #00000000 0%, #ffffffff 100%);
        background-color: none;
        border-radius: 6px;
        -webkit-appearance: none;
    }

    .playbutton {
        position: absolute;
        float: left;
        top: 12px;
        left: 12px;
        cursor: pointer;
    }

    .tab_button::before {
        box-shadow: 0 0 0 300px rgba(#95a, 0.75);
    }

    .edit_button > .button_icon {
        object-fit: fill;
        max-width: 60%;
        max-height: 60%;
        width: auto;
        height: auto;
    }

    .obj_button > .button_icon {
        display: block;

        max-width: 200%;
        max-height: 200%;
        width: auto;
        height: auto;

        transform: scale(0.4);
    }

    .invis_button {
        cursor: pointer;
    }

    .color_icon {
        width: 70%;
        height: 70%;
        border-radius: 50%;
        border: 2px solid white;
    }
</style>
