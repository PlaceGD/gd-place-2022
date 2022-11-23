<script lang="ts">
    import { Howl } from "howler"
    import { pinch } from "svelte-gestures"
    import { toast } from "@zerodevx/svelte-toast"
    import { Motion } from "svelte-motion"

    import { vec } from "../utils/vector"
    import {
        DRAGGING_THRESHOLD,
        EditorApp,
        storePosState,
        pixiApp,
        pixiCanvas,
        EditorMenu,
        pixiAppStore,
        obamaAnimEnded,
        selectedObject,
        toGradient,
    } from "./app"

    import {
        GdColor,
        GDObject,
        getObjSettings,
        OBJECT_SETTINGS,
    } from "./object"
    import { EDIT_BUTTONS, PALETTE } from "./edit"
    import { lazyLoad } from "../lazyLoad"
    import {
        addObjectToLevel,
        deleteTimerMaxCommon,
        getUsernameColors,
        placeTimerMaxCommon,
        streamLink,
        updateObjectCategory,
        userCount,
        timeleft,
    } from "../firebase/database"
    import { canEdit, currentUserData } from "../firebase/auth"
    import {
        MAX_ZOOM,
        MIN_ZOOM,
        toastErrorTheme,
        toastSuccessTheme,
    } from "../const"
    import { onMount } from "svelte"
    import { settings, settings_writable } from "../settings/settings"
    import { getPlacedUsername, LEVEL_BOUNDS, SPAWN_POS } from "./nodes"
    import {
        countingDown,
        eventStartWritable,
        eventEnded,
    } from "../countdown/countdown"
    import { clamp } from "../utils/math"
    import WarpSpeed from "../warpspeed.js"

    $: Object.keys(settings).forEach((key) => {
        settings[key] = $settings_writable[key]
    })

    let currentMenu = EditorMenu.Build

    $: if ($settings_writable.hideDecoObjects.enabled && pixiApp?.editorNode) {
        const obj = getObjSettings(pixiApp.editorNode.selectedObjectId)

        if (!(obj.solid || obj.nonDeco)) {
            pixiApp.editorNode.objectPreview &&
                pixiApp.editorNode.removePreview()
            pixiApp.editorNode.selectedObjectId = 1
        }
    }

    let placeTimerMax, deleteTimerMax
    $: {
        placeTimerMax =
            $currentUserData?.data?.placeTimer || $placeTimerMaxCommon
        deleteTimerMax =
            $currentUserData?.data?.deleteTimer || $deleteTimerMaxCommon
    }

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

    let starfieldCanvas: HTMLCanvasElement

    onMount(() => {
        let data = new URLSearchParams(window.location.search)

        // get editor position from local storage
        let editorPosition: any = JSON.parse(
            localStorage.getItem("editorPosition")
        )

        if (!editorPosition) {
            editorPosition = { x: SPAWN_POS + 27 * 30, y: 4, zoom: -3 }
        }

        if (data.get("x")) {
            editorPosition.x = parseInt(data.get("x")!) * 30
        }
        if (data.get("y")) {
            editorPosition.y = parseInt(data.get("y")!) * 30
        }
        if (data.get("zoom")) {
            editorPosition.zoom = parseInt(data.get("zoom")!)
        }

        editorPosition.zoom = clamp(editorPosition.zoom, MAX_ZOOM, MIN_ZOOM)

        pixiAppStore.set(new EditorApp($pixiCanvas, editorPosition))
        switchMenu(EditorMenu.Build)

        const x = new WarpSpeed("starfield_canvas", {
            speed: 1,
            speedAdjFactor: 0.03,
            density: 5,
            shape: "circle",
            warpEffect: true,
            warpEffectLength: 8,
            depthFade: true,
            starSize: 5,
            backgroundColor: "#000000",
            starColor: "#FFFFFF",
        })
        console.log(x)
    })

    enum EditTab {
        Transform,
        Layers,
        Colors,
    }

    let currentEditTab = EditTab.Transform

    enum ColorChannel {
        Main,
        Detail,
    }

    let currentChannel = ColorChannel.Main

    // temporary way of generating categories
    let categoryList = []
    //console.log(OBJECT_SETTINGS)
    OBJECT_SETTINGS.forEach((x) => {
        if (!categoryList.includes(x.category)) categoryList.push(x.category)
    })

    let lastPlaced = 0
    let lastDeleted = 0

    let placeTimeLeft = 6969696969
    let deleteTimeLeft = 6969696969

    // temporary client-side way of disabling button just to avoid user being able to spam button
    // in event that cloud function returns slowly
    let placeButtonDisabled = false
    let deleteButtonDisabled = false

    let placeTimerSound = new Howl({
        src: ["/gd/world/crystal01.ogg"],
    })
    let deleteTimerSound = new Howl({
        src: ["/gd/world/achievement_01.ogg"],
    })

    const updateTimeLeft = () => {
        const now = Date.now()
        placeTimeLeft = Math.max(placeTimerMax - (now - lastPlaced) / 1000, 0)
        deleteTimeLeft = Math.max(
            deleteTimerMax - (now - lastDeleted) / 1000,
            0
        )
    }

    setInterval(() => {
        updateTimeLeft()
    }, 200)

    const gradientFunc = (t) =>
        `conic-gradient(white ${t * 360}deg, black ${t * 360}deg 360deg)`

    currentUserData.subscribe((value) => {
        if (typeof value != "string" && value != null) {
            if (typeof value.data != "string" && value.data != null) {
                lastDeleted = value.data.lastDeleted
                lastPlaced = value.data.lastPlaced
                if (placeTimerMax * 1000 - (Date.now() - lastPlaced) > 0) {
                    let t = setTimeout(() => {
                        placeTimerSound.play()
                        clearTimeout(t)
                    }, Math.max(placeTimerMax * 1000 - (Date.now() - lastPlaced), 0))
                }

                if (deleteTimerMax * 1000 - (Date.now() - lastDeleted) > 0) {
                    let t2 = setTimeout(() => {
                        deleteTimerSound.play()
                        clearTimeout(t2)
                    }, Math.max(deleteTimerMax * 1000 - (Date.now() - lastDeleted), 0))
                }

                updateTimeLeft()
            }
        }
    })

    const mobileScreenQuery = window.matchMedia(
        "(max-height: 600px) or (orientation: portrait)"
    )

    let mobileScreen = mobileScreenQuery.matches

    mobileScreenQuery.addEventListener("change", () => {
        mobileScreen = mobileScreenQuery.matches
    })

    let menuIndex = 0
    function nextMenu(): EditorMenu {
        return [EditorMenu.Build, EditorMenu.Edit, EditorMenu.Delete][
            menuIndex++ % 3
        ]
    }
</script>

<svelte:window
    on:pointerup={(e) => {
        if ($timeleft == 0 && !$eventEnded) return
        pixiApp.dragging = null
    }}
    on:pointermove={(e) => {
        if ($timeleft == 0 && !$eventEnded) return
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
        if ($timeleft == 0) return
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

<button
    on:click={() => pixiApp.takeHighResScreenshot()}
    style="position: absolute; z-index: 100;">Take screenshots</button
>
<!-- <canvas id="screenshot_canvas" /> -->
<div class="editor">
    <Motion
        let:motion
        initial={{ opacity: 0 }}
        animate={$obamaAnimEnded ? { opacity: 1 } : {}}
        transition={{ ease: "easeInOut", duration: 2 }}
    >
        <canvas
            class="starfield"
            id="starfield_canvas"
            bind:this={starfieldCanvas}
            use:motion
        />
    </Motion>
    <canvas
        class="pixi_canvas"
        bind:this={$pixiCanvas}
        on:pointerdown={(e) => {
            pixiApp.draggingThresholdReached = false
            pixiApp.dragging = {
                prevCamera: pixiApp.editorNode.cameraPos.clone(),
                prevMouse: vec(e.pageX, e.pageY),
            }
        }}
        on:wheel={(e) => {
            if ($timeleft == 0 && !$eventEnded) return
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
            if ($timeleft == 0 && !$eventEnded) return
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
        on:pinchup={() => {
            if ($timeleft == 0 && !$eventEnded) return
            pixiApp.pinching = null
        }}
        on:pointerup={(e) => {
            if ($timeleft == 0 && !$eventEnded) return
            if ($countingDown && !$eventEnded) return

            pixiApp.pinching = null
            pixiApp.mousePos = vec(e.pageX, e.pageY)
            if (currentMenu == EditorMenu.Delete) {
                return
            }
            if (pixiApp.editorNode.tooltip.visible) {
                if (pixiApp.editorNode.tooltip) {
                    pixiApp.editorNode.tooltip.visible = false
                    pixiApp.editorNode.tooltip.currentObject.isHovering = false
                    pixiApp.editorNode.tooltip.unHighlight()
                }
                return
            }

            if (pixiApp.editorNode.tooltip.currentObject)
                pixiApp.editorNode.tooltip.currentObject.isHovering = false
            if ($canEdit) {
                if (
                    pixiApp.dragging == null ||
                    !pixiApp.draggingThresholdReached
                ) {
                    const settings = getObjSettings(
                        pixiApp.editorNode.selectedObjectId
                    )

                    let snapped = pixiApp.editorNode
                        .toWorld(pixiApp.mousePos, pixiApp.canvasSize())
                        .snapped(30)
                        .plus(vec(15, 15))

                    if (
                        pixiApp.editorNode.objectPreview == null ||
                        pixiApp.editorNode.selectedObjectId !=
                            pixiApp.editorNode.objectPreview?.id
                    ) {
                        pixiApp.editorNode.objectPreview = new GDObject(
                            pixiApp.editorNode.selectedObjectId,
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

    {#if $timeleft != null}
        <div class="end_countdown_container">
            <div
                class="end_countdown"
                style:color={$timeleft < 30000 ? "red" : "white"}
                style:opacity={$timeleft != 0 ? 1 : 0}
            >
                <!-- $eventEndWritable -->
                {new Date($timeleft).toISOString().substr(11, 8)}
            </div>
        </div>
    {/if}
    {#if $timeleft != 0 && !$eventEnded}
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
                    if (!pixiApp.playingMusic) {
                        pixiApp.playMusic()
                    } else {
                        pixiApp.stopMusic()
                    }
                }}
            />
        </div>
    {/if}

    {#if settings.showObjInfo.enabled && $selectedObject != null && $timeleft != 0}
        <div class="obj_info">
            <div class="info_line">
                <b> Object type: </b>
                <img
                    draggable="false"
                    alt={$selectedObject.obj.id.toString()}
                    class="info_icon"
                    src={`/gd/objects/main/${$selectedObject.obj.id}.png`}
                />
            </div>
            {#if getObjSettings($selectedObject.obj.id).tintable}
                {#each [[$selectedObject.obj.mainColor, "Main color"], [$selectedObject.obj.detailColor, "Detail color"]] as [color, name]}
                    <div class="info_line">
                        <b> {name}: </b>
                        <div class="color_info">
                            <div
                                class="color_circle"
                                style="background-color: #{color['hex']}"
                            />
                            {#if color["blending"]}
                                <span class="blending_info"> B </span>
                            {/if}
                            {#if color["opacity"] != 1.0}
                                <span class="opacity_info">
                                    {color["opacity"] * 100}%
                                </span>
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}

            <div class="info_line">
                <b> Z layer: </b>
                {$selectedObject.obj.zOrder}
            </div>
            <div class="info_line">
                <b> Rotation: </b>
                {$selectedObject.obj.rotation}°
            </div>
            <div class="info_line">
                <b> Scale: </b>
                {$selectedObject.obj.scale.toFixed(2)}
            </div>
            {#await getPlacedUsername($selectedObject.dbname) then username}
                {#await getUsernameColors(username) then colors}
                    <div class="info_line">
                        <b> Placed by: </b>
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <div
                            on:pointerdown={() => {
                                navigator.clipboard
                                    .writeText(username)
                                    .then(() => {
                                        toast.pop()
                                        toast.push("Copied", toastSuccessTheme)
                                    })
                                    .catch((e) => {
                                        toast.push(e, toastErrorTheme)
                                    })
                            }}
                            class="username_display {colors.length > 1
                                ? 'username_gradient'
                                : ''}"
                            style={colors.length == 1
                                ? `color: #${colors[0].toString(16)}`
                                : `background-image: ${toGradient(colors)}`}
                        >
                            {username}
                        </div>
                    </div>
                {/await}
            {/await}
        </div>
    {/if}

    {#if $timeleft != 0 && $canEdit && $eventStartWritable != null && $countingDown != null && !$countingDown && !settings.hideMenu.enabled && !$eventEnded}
        <div class="menu">
            <div
                class="side_panel menu_panel"
                style={mobileScreen
                    ? "justify-content: center; margin: 0;"
                    : ""}
            >
                {#if mobileScreen}
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
                                        1 - placeTimeLeft / placeTimerMax
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
                                        1 - deleteTimeLeft / deleteTimerMax
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
                                    1 - placeTimeLeft / placeTimerMax
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
                                    1 - deleteTimeLeft / deleteTimerMax
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
                                    pixiApp.editorNode.currentObjectTab =
                                        objectTab
                                    updateObjectCategory(objectTab)
                                }}
                                style={pixiApp?.editorNode?.currentObjectTab ==
                                objectTab
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
                            <div class="obj_buttons_container grid_padding">
                                {#each OBJECT_SETTINGS as objectData}
                                    <button
                                        class="obj_button invis_button wiggle_button"
                                        data-category={objectData.category}
                                        data-id={objectData.id}
                                        style={pixiApp?.editorNode
                                            .currentObjectTab !=
                                        objectData.category
                                            ? "display: none !important"
                                            : ""}
                                        id={pixiApp?.editorNode
                                            .selectedObjectId == objectData.id
                                            ? "selected_obj_button"
                                            : ""}
                                        on:click={() => {
                                            pixiApp.editorNode.selectedObjectId =
                                                objectData.id
                                        }}
                                        disabled={$settings_writable
                                            .hideDecoObjects.enabled &&
                                            !(
                                                objectData.nonDeco ||
                                                objectData.solid
                                            )}
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
                                        <p
                                            class="debug_objectID object_comment"
                                        >
                                            {objectData.id}
                                        </p>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    </div>
                {:else if currentMenu == EditorMenu.Edit}
                    <div class="tabs">
                        {#each EDIT_BUTTONS as editTab, i}
                            <button
                                class="tab_button invis_button"
                                style={currentEditTab === i
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
                            {#if currentEditTab === EditTab.Transform}
                                <div class="obj_buttons_container grid_padding">
                                    {#each EDIT_BUTTONS[currentEditTab].buttons as editButton, i (currentEditTab * 100 + i)}
                                        <button
                                            class="edit_button invis_button wiggle_button"
                                            disabled={pixiApp.editorNode
                                                .objectPreview == null ||
                                                (["cw_5", "ccw_5"].includes(
                                                    editButton["image"]
                                                ) &&
                                                    getObjSettings(
                                                        pixiApp.editorNode
                                                            .objectPreview?.id
                                                    ).solid)}
                                            on:click={() => {
                                                if (
                                                    pixiApp.editorNode
                                                        .objectPreview != null
                                                ) {
                                                    editButton.cb(
                                                        pixiApp.editorNode
                                                            .objectPreview
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
                                </div>
                            {/if}

                            {#if currentEditTab === EditTab.Layers}
                                <div class="zlayers_container">
                                    <div
                                        class="obj_buttons_container grid_padding"
                                        style="grid-area: buttons"
                                    >
                                        {#each EDIT_BUTTONS[currentEditTab].buttons as editButton, i (currentEditTab * 100 + i)}
                                            <button
                                                class="edit_button invis_button wiggle_button"
                                                disabled={pixiApp.editorNode
                                                    .objectPreview == null}
                                                on:click={() => {
                                                    if (
                                                        pixiApp.editorNode
                                                            .objectPreview !=
                                                        null
                                                    ) {
                                                        editButton.cb(
                                                            pixiApp.editorNode
                                                                .objectPreview
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
                                    </div>

                                    {#if pixiApp.editorNode.objectPreview}
                                        <t class="edit_info_text">
                                            Z = {pixiApp.editorNode
                                                .objectPreview?.zOrder}
                                        </t>
                                    {/if}

                                    {#if pixiApp.editorNode.objectPreview?.mainColor.blending || pixiApp.editorNode.objectPreview?.detailColor.blending}
                                        <t class="edit_info_text2">
                                            (Since one of your colors has
                                            blending, layering might not work as
                                            expected. This is to replicate GD
                                            behavior.)
                                        </t>
                                    {/if}
                                </div>
                            {/if}

                            {#if currentEditTab === EditTab.Colors}
                                <div class="colors_tab_container">
                                    <div class="colors_tab_channels_container">
                                        {#each ["Main", "Detail"] as channel, i}
                                            <div
                                                class="colors_tab_labels_container"
                                                id={currentChannel === i
                                                    ? "selected_channel_button"
                                                    : ""}
                                            >
                                                <button
                                                    class="invis_button wiggle_button colors_tab_labels"
                                                    on:click={() => {
                                                        currentChannel = i
                                                    }}
                                                >
                                                    {channel}
                                                </button>

                                                <button
                                                    class="blending_toggle wiggle_button"
                                                    style={(channel == "Main" &&
                                                        pixiApp.editorNode
                                                            .objectPreview
                                                            ?.mainColor
                                                            .blending) ||
                                                    (channel == "Detail" &&
                                                        pixiApp.editorNode
                                                            .objectPreview
                                                            ?.detailColor
                                                            .blending)
                                                        ? "outline: 2px solid #09d6e5;background-image:var(--color-button-enable);"
                                                        : ""}
                                                    disabled={!getObjSettings(
                                                        pixiApp.editorNode
                                                            .objectPreview?.id
                                                    ).tintable ||
                                                        pixiApp.editorNode
                                                            .objectPreview ==
                                                            null ||
                                                        (channel == "Main" &&
                                                            pixiApp.editorNode
                                                                .objectPreview
                                                                ?.mainColor
                                                                .hex ==
                                                                "000000") ||
                                                        (channel == "Detail" &&
                                                            pixiApp.editorNode
                                                                .objectPreview
                                                                ?.detailColor
                                                                .hex ==
                                                                "000000")}
                                                    on:click={() => {
                                                        if (
                                                            pixiApp.editorNode
                                                                .objectPreview !=
                                                            null
                                                        ) {
                                                            if (
                                                                channel ==
                                                                "Main"
                                                            )
                                                                pixiApp.editorNode.objectPreview.mainColor.blending =
                                                                    !pixiApp
                                                                        .editorNode
                                                                        .objectPreview
                                                                        .mainColor
                                                                        .blending
                                                            else if (
                                                                channel ==
                                                                "Detail"
                                                            )
                                                                pixiApp.editorNode.objectPreview.detailColor.blending =
                                                                    !pixiApp
                                                                        .editorNode
                                                                        .objectPreview
                                                                        .detailColor
                                                                        .blending
                                                            pixiApp.editorNode.updateObjectPreview()
                                                        }
                                                    }}
                                                >
                                                    {#if mobileScreen}
                                                        B
                                                    {:else}
                                                        Blending
                                                    {/if}
                                                </button>
                                            </div>
                                        {/each}
                                    </div>

                                    <div class="colors_buttons_container">
                                        <!-- opacity slider -->
                                        <div class="opacity_slider_container">
                                            <input
                                                type="range"
                                                min="0.2"
                                                max="1"
                                                step="0.1"
                                                value={currentChannel ==
                                                ColorChannel.Main
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
                                                        if (
                                                            currentChannel ==
                                                            ColorChannel.Main
                                                        )
                                                            pixiApp.editorNode.objectPreview.mainColor.opacity =
                                                                val.value
                                                        else if (
                                                            currentChannel ==
                                                            ColorChannel.Detail
                                                        )
                                                            pixiApp.editorNode.objectPreview.detailColor.opacity =
                                                                val.value

                                                        pixiApp.editorNode.updateObjectPreview()
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div class="colors_palette_container">
                                            {#each PALETTE as color}
                                                <button
                                                    class="edit_color_button invis_button wiggle_button"
                                                    style={(currentChannel ==
                                                        ColorChannel.Main &&
                                                        pixiApp.editorNode
                                                            .objectPreview
                                                            ?.mainColor.hex ==
                                                            color) ||
                                                    (currentChannel ==
                                                        ColorChannel.Detail &&
                                                        pixiApp.editorNode
                                                            .objectPreview
                                                            ?.detailColor.hex ==
                                                            color)
                                                        ? "outline: 2px solid #09d6e5;background-image:var(--color-button-enable);"
                                                        : ""}
                                                    disabled={!getObjSettings(
                                                        pixiApp.editorNode
                                                            .objectPreview?.id
                                                    ).tintable ||
                                                        pixiApp?.editorNode
                                                            ?.objectPreview ==
                                                            null ||
                                                        (currentChannel ===
                                                            ColorChannel.Main &&
                                                            pixiApp?.editorNode
                                                                ?.objectPreview
                                                                ?.mainColor
                                                                .blending &&
                                                            color ==
                                                                "000000") ||
                                                        (currentChannel ===
                                                            ColorChannel.Detail &&
                                                            pixiApp?.editorNode
                                                                ?.objectPreview
                                                                ?.detailColor
                                                                .blending &&
                                                            color == "000000")}
                                                    on:click={() => {
                                                        if (
                                                            pixiApp.editorNode
                                                                .objectPreview !=
                                                            null
                                                        ) {
                                                            if (
                                                                currentChannel ===
                                                                ColorChannel.Main
                                                            )
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
                                        </div>
                                    </div>
                                </div>
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
                        if (
                            pixiApp.editorNode.objectPreview &&
                            placeTimeLeft == 0 &&
                            !placeButtonDisabled
                        ) {
                            placeButtonDisabled = true
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
                        if (
                            deleteTimeLeft == 0 &&
                            !deleteButtonDisabled &&
                            pixiApp.editorNode.selectedObjectNode != null
                        ) {
                            deleteButtonDisabled = true

                            pixiApp.editorNode.deleteSelectedObject(
                                () => {
                                    deleteButtonDisabled = false
                                },
                                () => {
                                    deleteButtonDisabled = false
                                }
                            )
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
    {:else if $timeleft != 0 && !settings.hideMenu.enabled && $countingDown != null && $eventStartWritable != null && !$eventEnded}
        {#if $countingDown}
            {#if $streamLink != null}
                <div class="livestream_link">
                    Join the <a
                        href={$streamLink}
                        target="_blank"
                        rel="noreferrer"
                    >
                        official livestream
                    </a>
                </div>
            {/if}

            <div class="count_down_message">
                {#if mobileScreen}
                    <div style:margin="0" class="count_down_text">
                        <div class="user_counter">
                            <b style:font-size="calc(var(--font-large) * 2)">
                                {$userCount?.toLocaleString()}
                            </b>
                            <div
                                style="opacity:0.8;font-size:calc(var(--font-large) - 10px);"
                            >
                                creators have signed up
                            </div>
                        </div>
                    </div>
                {:else}
                    <div class="count_down_content">
                        <div class="loading">
                            <img
                                src="/loadinganimcss.svg"
                                alt="Loading icon"
                                class="loading_icon"
                            />
                        </div>

                        <div style:margin="0" class="count_down_text">
                            <div class="user_counter">
                                <b
                                    style:font-size="calc(var(--font-large) * 2)"
                                    style:min-width="30%"
                                >
                                    {$userCount}
                                </b>
                                <div
                                    style="opacity:0.8;font-size:calc(var(--font-large) - 10px);"
                                >
                                    creators have signed up
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        {:else if !$eventEnded}
            <div class="login_requirement_message">
                You must be signed in to help build the level!
                <div style="transform:scale(0.8);opacity:0.5;margin-top:10px;">
                    (click the icon in the top right corner)
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .starfield {
        position: absolute;
        width: 100%;
        height: 100%;
    }

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

        --color-button-enable: linear-gradient(
            rgb(183, 247, 130),
            rgb(64, 117, 48)
        );
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

        .loading {
            width: 100%;
            height: 100px !important;
            margin: 10px;
            overflow-x: hidden;
        }
    }

    .timer {
        justify-self: center;
        opacity: 1;
        /* font-size: var(--font-large); */

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

        .end_countdown_container {
            top: 100px !important;
            justify-content: left !important;
        }
    }

    @media screen and (max-width: 600px) {
        :root {
            --grid-button-size: 30px;
            --font-medium: 18px;
        }
    }

    @media screen and (max-width: 1000px), screen and (max-height: 600px) {
        .colors_tab_container {
            grid-template-areas:
                "channels channels"
                "buttons buttons" !important;

            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: 30px auto !important;
            overflow: hidden !important;
            gap: 2px !important;
        }

        .colors_tab_channels_container {
            flex-direction: row !important;
        }

        .colors_tab_labels_container {
            grid-template-columns: 70% 30% !important;
            grid-template-rows: 100% 0px !important;
            flex-direction: row !important;
            height: 100% !important;
        }

        .colors_tab_labels {
            border-radius: 6px 0px 0px 6px !important;
        }
        .blending_toggle {
            border-radius: 0px 6px 6px 0px !important;
            font-size: var(--font-small);
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
        width: 100%;
        height: inherit;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        position: fixed;
    }
    .editor > .pixi_canvas {
        position: fixed;
        width: 100%;
        height: 100%;
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
        animation-name: menu_in;
        animation-duration: 1s;
        animation-timing-function: cubic-bezier(0, 0.4, 0, 1.01);
    }

    @keyframes menu_in {
        0% {
            opacity: 0;
            transform: translateY(100%);
        }
        100% {
            opacity: 1;
            transform: translateY(0%);
        }
    }

    .login_requirement_message {
        width: calc(100% - 32px);
        height: 300px;
        z-index: 10;
        display: flex;
        margin: 16px;
        background-color: #000c;
        border-radius: 16px;
        padding: var(--font-large); /* ?? */
        justify-content: center;
        flex-direction: column;
        gap: 10px;
        align-items: center;
        font-family: Pusab, Helvetica, sans-serif;
        color: white;
        font-size: calc(var(--font-large) - 6px);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        text-align: center;
    }

    .count_down_message {
        width: calc(100% - 32px);
        height: fit-content;
        min-height: 100px;
        max-height: 25vh;
        z-index: 10;
        display: flex;
        margin: 20px;

        background-color: #000c;
        border-radius: 16px;

        justify-content: center;

        align-items: center;

        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        margin-top: 5px;
        overflow: hidden;
    }

    @keyframes slide {
        0% {
            transform: translateX(-100%);
        }

        100% {
            transform: translateX(0%);
        }
    }

    .count_down_content {
        width: fit-content;
        display: grid;
        grid-template-columns: 30% 80%;
        margin: 20px;
        flex-direction: row;
        animation-name: slide;

        animation-duration: 5s;
        animation-timing-function: cubic-bezier(0, 0.3, 0.3, 1);
    }

    .count_down_text {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 15px;
        align-items: center;
        max-height: inherit;
    }

    .loading {
        width: 100%;
        height: 90%;
        margin: 10px;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .loading_icon {
        height: 100%;
        width: auto;
        object-fit: contain;
        -webkit-mask-image: linear-gradient(
            90deg,
            #00000000 15%,
            #fff 50%,
            #00000000 80%
        );
        mask-image: linear-gradient(
            90deg,
            #00000000 15%,
            #fff 50%,
            #00000000 80%
        );
    }

    .user_counter {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 15px;

        margin: 10px;
        font-family: Cabin, sans-serif;
        color: white;
        font-size: calc(var(--font-large) - 10px);
        text-align: center;
        min-width: 50vw;
    }

    .livestream_link {
        width: fit-content;
        height: fit-content;

        z-index: 12;
        padding: 5px;
        padding-left: 20px;
        padding-right: 20px;

        background-color: #000c;
        border-radius: 16px;

        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);

        font-family: Cabin, sans-serif;
        font-size: var(--font-medium);
        color: white;
        margin: 0;
        text-align: center;

        bottom: 0;
    }

    .livestream_link > a {
        color: rgb(98, 192, 255);
        text-decoration: none;
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
        background-color: #000c;
        border-radius: 16px 16px 0 0;
        margin: 0 8px 0 0;
        font-family: Pusab, Helvetica, sans-serif;
        -webkit-text-stroke: 1.5px black;
        color: white;
        font-size: var(--font-small);
        transition: 0.2s;
        backdrop-filter: blur(30px);
        -webkit-backdrop-filter: blur(30px);
    }

    .tab_button .obj_tab_icon {
        width: auto;
        height: auto;
        max-width: 5vw;
        max-height: 80%;
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
        grid-area: text;
        align-items: center;
    }
    .edit_info_text2 {
        font-size: var(--font-small);
        opacity: 0.5;
        color: white;
        font-family: Cabin, sans-serif;
        grid-area: text2;
        display: flex;
        justify-content: center;
        align-items: center;
        font-style: italic;
        padding: var(--grid-gap);
        text-align: center;
    }
    .end_countdown_container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        position: absolute;
        top: 0;
        z-index: 3;
    }
    .end_countdown {
        width: fit-content;
        height: fit-content;
        padding: 10px;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        background-color: #000c;
        border-radius: 16px;
        color: white;
        font-size: var(--font-medium);
        font-family: Cabin, sans-serif;
        overflow: hidden;
        margin: 12px;
        transition: opacity 3s;
    }
    .objects_grid_container {
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        position: relative;
        grid-area: container;
        height: 100%;
    }
    .objects_grid {
        width: 100%;
        display: flex;
        height: 100%;
        flex-wrap: wrap;
        justify-content: center;
    }
    .obj_buttons_container {
        display: flex;
        position: relative;
        height: fit-content;
        justify-content: center;
        flex-wrap: wrap;
    }
    .grid_padding {
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
        min-width: var(--grid-button-size);
        min-height: var(--grid-button-size);
        border-radius: 6px;
        background-image: linear-gradient(rgb(190, 190, 190), rgb(70, 70, 70));
        box-shadow: 0 4px 8px 0 #00000070;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
    }

    .obj_button:disabled {
        opacity: 0.3;
    }

    #selected_obj_button {
        outline: 3px solid #a2ffa2;
        transform: scale(1.1);
    }

    .debug_objectID {
        display: none;
    }

    .obj_info {
        position: absolute;
        float: left;
        top: 100px;
        left: 12px;
        width: 300px;
        height: fit-content;
        padding: 10px;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        background-color: #000c;
        border-radius: 0px 16px 16px 16px;
        color: white;
        font-size: calc(var(--font-small) * 0.7);
        font-family: Cabin, sans-serif;
        max-height: 30vh;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .username_display {
        font-family: Cabin, sans-serif;
        font-size: calc(var(--font-small) * 0.7);
        transform-origin: right;
        transform: scale(1.5);
        text-align: center;
    }

    .username_gradient {
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        -webkit-background-clip: text !important;
    }

    .info_line {
        display: flex;
        justify-content: space-between;
        height: 20px;
        width: 100%;
        flex-direction: row;
        margin: 0 0 10px 0;
    }

    .info_icon {
        width: auto;
        height: auto;
        max-height: 20px;
        max-width: 40px;
        float: right;
        object-fit: contain;
        vertical-align: middle;
    }

    .color_info {
        width: fit-content;
        height: 20px;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
        row-gap: 50px;
        margin: 0 0 4px 0;
    }

    .color_circle {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        float: right;
        outline: 2px solid white;
    }

    .blending_info {
        width: 20px;
        height: 20px;
        font-family: Pusab, Helvetica, sans-serif;
        color: white;
        font-size: 24px;
        float: right;
        transform: translateY(-3px);
    }

    .opacity_info {
        width: 40px;
        height: 20px;
        font-family: Cabin, Helvetica, sans-serif;
        color: rgba(255, 255, 255, 0.8);
        font-size: 18px;
        float: right;
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

    .edit_color_button {
        width: calc(var(--grid-button-size) * 0.9);
        height: calc(var(--grid-button-size) * 0.9);
        border-radius: 6px;
        background-image: linear-gradient(rgb(183, 247, 130), rgb(64, 117, 48));
        box-shadow: 0 4px 8px 0 #00000070;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .edit_color_button:disabled {
        opacity: 0.3;
    }

    .colors_tab_container {
        display: grid;
        gap: 10px;
        grid-template-rows: minmax(auto, min-content) minmax(auto, min-content);

        grid-template-areas:
            "channels buttons"
            "channels buttons";
        width: 100%;
        height: 100%;
    }

    .colors_tab_channels_container {
        grid-area: channels;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 5px;
    }

    .colors_tab_labels {
        font-family: Pusab;
        color: white;
        -webkit-text-stroke: 1.5px black;
        font-size: var(--font-medium);

        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        align-items: center;
        border-radius: 6px 6px 0px 0px;
        background-image: linear-gradient(rgb(183, 247, 130), rgb(64, 117, 48));
    }

    .colors_tab_labels_container {
        display: grid;
        grid-template-rows: 60% 40%;
        flex-direction: column;
        height: 100%;
        width: 100%;
        opacity: 0.3;
        padding: 0;
        gap: 2px;
    }

    .blending_toggle {
        border-radius: 0px 0px 6px 6px;
        background-image: linear-gradient(rgb(183, 247, 130), rgb(64, 117, 48));
        display: flex;
        justify-content: center;
        align-items: center;

        font-family: Pusab, Helvetica, sans-serif;
        color: white;
        font-size: calc(var(--font-small) * 0.7);
        -webkit-text-stroke: 1.5px black;

        border: none;
        width: 100%;
        text-overflow: clip;
        overflow: hidden;
    }

    .colors_buttons_container {
        height: 100%;
        width: 100%;
        grid-area: buttons;
        display: flex;
        flex-direction: column;
        overflow-y: scroll;
    }

    .colors_palette_container {
        grid-area: palette;
        width: 100%;
        height: 100%;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: center;
    }

    .zlayers_container {
        display: grid;
        gap: 0px 0px;
        grid-template-areas:
            "buttons"
            "text"
            "text2";
        width: 100%;
        height: 100%;
        grid-template-rows: min-content min-content min-content;
    }

    #selected_channel_button {
        opacity: 1;
    }

    .blending_toggle:disabled {
        opacity: 0.3;
    }

    .opacity_slider_container {
        width: 100%;
        height: 100%;

        padding: 10px 20px 10px 20px;

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
        width: 100%;
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
        z-index: 20;
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
        width: 85%;
        height: 85%;
        border-radius: 10%;
        border: 2px solid white;
    }
</style>
