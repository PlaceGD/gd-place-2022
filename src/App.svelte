<script lang="ts">
    import { SvelteToast } from "@zerodevx/svelte-toast"

    import Auth from "./auth/Auth.svelte"
    import Settings from "./settings/Settings.svelte"
    import Editor from "./editor/Editor.svelte"
    import { currentUserData } from "./firebase/auth"
    import { isEmailVerification } from "./firebase/auth"
    import Page from "./eventdone/Page.svelte"
    import { countingDown, eventStart } from "./countdown/countdown"

    let emailSuccess = "loading"

    if (isEmailVerification) {
        const onStorage2 = (event) => {
            if (event.key == "loginSuccess") {
                window.removeEventListener("storage", onStorage2)
                emailSuccess = `${event.newValue} You can safely close this tab.`
                localStorage.removeItem("loginSuccess")
            }
        }

        window.addEventListener("storage", onStorage2)
        window.localStorage.setItem("emailCode", window.location.href)
        window.dispatchEvent(new Event("storage"))
    }
</script>

<SvelteToast options={{ reversed: true, intro: { y: 192 } }} />

<Page />

<!-- {#if isEmailVerification}
    <div class="email">
        {emailSuccess}
    </div>
{:else if typeof $currentUserData != "string"}
    <Editor />
    <div class="auth_settings">
        {#if !$countingDown}
            <Settings />
        {/if}
        <Auth loadedUserData={$currentUserData} />
    </div>
{:else}
    <div class="loading_container">
        <div class="loading">
            <img
                src="/loadinganimcss.svg"
                alt="Loading icon"
                class="loading_icon"
            />
        </div>
    </div>
{/if} -->
<style>
    .email {
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: var(--font-large);
        font-family: sans-serif;
    }

    .loading_container {
        display: flex;
        justify-content: center;
        align-items: center;
        background: #000c;
        backdrop-filter: blur(32px);
        -webkit-backdrop-filter: blur(32px);
        width: 100%;
        height: 100%;
        z-index: 100;
        position: absolute;
        bottom: 0;
    }
    .loading {
        width: 50%;
        height: 50%;
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

    .auth_settings {
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: flex-end;
        position: absolute;
        top: 0;
        right: 0;
        /* gap: 10px;
        padding-top: 12px;
        padding-right: 12px; */
        pointer-events: none;
    }
</style>
