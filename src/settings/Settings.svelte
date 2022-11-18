<script lang="ts">
    import { transform } from "svelte-motion"
    import { toGradient } from "../editor/app"
    import { currentUserData } from "../firebase/auth"
    import { getUsernameColors, streamLink } from "../firebase/database"
    import { settings, saveSettings, settings_writable } from "./settings"
    let settingsOpen = false
</script>

<div class="all">
    <button
        class="settings_button invis_button wiggle_button"
        on:click={() => {
            settingsOpen = !settingsOpen
        }}
    >
        <img
            draggable="false"
            src="/gd/editor/GJ_optionsBtn_001.png"
            alt="settings button"
        />
    </button>

    <div
        class="settings_menu"
        style:transform={settingsOpen ? "" : "scaleY(0)"}
    >
        {#each Object.keys(settings) as key, i}
            <div
                class="onoffsetting"
                style:opacity={settingsOpen ? 1 : 0}
                style:transform={settingsOpen ? "" : `translateY(-20px)`}
                style:transition="ease-out 0.2s"
                style:transition-delay={settingsOpen
                    ? `${0.1 + i * 0.03}s`
                    : "0s"}
            >
                <input
                    type="checkbox"
                    id={key}
                    bind:checked={$settings_writable[key].enabled}
                    on:change={(event) => {
                        saveSettings()
                        settings[key].cb && settings[key].cb(event)
                    }}
                />
                <label for={key}> {settings[key].label} </label>
            </div>
        {/each}
        {#if $currentUserData?.data?.username}
            <div
                style:opacity={settingsOpen ? 1 : 0}
                style:transform={settingsOpen ? "" : `translateY(-10px)`}
                style:transition="ease-out 0.2s"
                style:transition-delay={settingsOpen
                    ? `${0.13 + Object.keys(settings).length * 0.03}s`
                    : "0s"}
            >
                {#await getUsernameColors($currentUserData?.data?.username) then colors}
                    <b> Name tag: </b>
                    <div
                        class="username_display {colors.length > 1
                            ? 'username_gradient'
                            : ''}"
                        style={colors.length == 1
                            ? `color: #${colors[0].toString(16)}`
                            : `background-image: ${toGradient(colors)}`}
                    >
                        {$currentUserData?.data?.username}
                    </div>
                {/await}
            </div>
        {/if}

        <i
            class="name_color_info"
            style:opacity={settingsOpen ? 1 : 0}
            style:transform={settingsOpen ? "" : `translateY(-10px)`}
            style:transition="ease-out 0.2s"
            style:transition-delay={settingsOpen
                ? `${0.2 + Object.keys(settings).length * 0.03}s`
                : "0s"}
        >
            <b> Colored names: </b> if you want your name tag to be a different
            color, send your username and the color you want in a donation in
            <a
                href={$streamLink || "https://www.youtube.com/c/Spu7Nix"}
                target="_blank"
                rel="noreferrer"
            >
                Spu7Nix's stream</a
            >!
        </i>
    </div>
</div>

<style>
    .all {
        position: absolute;
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: flex-end;
        align-items: flex-start;
        pointer-events: none;
        z-index: 40;
    }

    *:before,
    *:after {
        -webkit-box-sizing: border-box;
        -moz-box-sizing: border-box;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    .all * {
        pointer-events: auto;
    }

    .settings_button {
        position: absolute;
        margin-top: 15px;
        margin-right: 15px;
    }

    .settings_button > img {
        width: 75px;
    }

    .onoffsetting {
        display: block;
        margin-bottom: 15px;
    }

    .onoffsetting input {
        padding: 0;
        height: initial;
        width: initial;
        margin-bottom: 0;
        display: none;
        cursor: pointer;
        gap: 10px;
    }

    .onoffsetting label {
        position: relative;
        cursor: pointer;
    }

    .onoffsetting label:before {
        content: "";
        -webkit-appearance: none;
        background-color: transparent;
        border: 2px solid #ffffff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05),
            inset 0px -15px 10px -12px rgba(0, 0, 0, 0.05);
        padding: 10px;
        display: inline-block;
        position: relative;
        vertical-align: middle;
        cursor: pointer;
        margin-right: 10px;
        border-radius: 4px;
    }

    .onoffsetting input:checked + label:after {
        content: "";
        display: block;
        position: absolute;
        top: 4px;
        left: 9px;
        width: 6px;
        height: 14px;
        border: solid #ffffff;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
        transition: ease-in 0.3s;
    }

    .username_display {
        font-family: Cabin, sans-serif;
        font-size: 32px;

        width: 100%;
        height: fit-content;
        padding: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .username_gradient {
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        -webkit-background-clip: text !important;
    }

    .settings_menu {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: left;
        font-weight: lighter;
        position: absolute;
        width: 300px;
        max-height: calc(100vh - 120px);

        margin-top: 100px;
        margin-right: 14px;
        padding: 10px;
        overflow-x: hidden;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;

        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        background-color: #000c;
        border-radius: 16px 0px 16px 16px;
        color: white;
        font-size: 18px;
        font-family: Cabin, sans-serif;
        transform-origin: top;
        transition: ease-in-out 0.3s;
    }
    .name_color_info {
        padding-top: 15px;
        opacity: 0.8;
    }
    .name_color_info a {
        color: #6682df;
    }
</style>
