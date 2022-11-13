<script lang="ts">
    import { SvelteToast, toast } from "@zerodevx/svelte-toast"

    import Auth from "./auth/Auth.svelte"
    import Settings from "./settings/Settings.svelte"
    import Editor from "./editor/Editor.svelte"
    import { currentUserData } from "./firebase/auth"
    import { isEmailVerification } from "./firebase/auth"
    import {
        browserLocalPersistence,
        setPersistence,
        signInWithEmailLink,
        signOut,
    } from "firebase/auth"
    import { toastErrorTheme } from "./const"
    import { auth } from "./firebase/init"
    import { onMount } from "svelte"

    let emailSuccess = "loading"

    if (isEmailVerification) {
        //setPersistence(auth, browserLocalPersistence)

        const onStorage2 = (event) => {
            console.log(event)
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

{#if isEmailVerification}
    <div class="email">
        {emailSuccess}
    </div>
{:else if typeof $currentUserData != "string"}
    <Editor />
    <Auth loadedUserData={$currentUserData} />
    <Settings />
{:else}
    <div class="loading">
        <img
            src="/loadinganimcss.svg"
            alt="Loading icon"
            class="loading_icon"
        />
    </div>
{/if}

<style>
    .email {
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: var(--font-large);
        font-family: sans-serif;
    }

    .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        background: #000c;
        backdrop-filter: blur(32px);
        -webkit-backdrop-filter: blur(32px);
        width: 100%;
        height: 25%;
        z-index: 100;
        position: absolute;
        bottom: 0;
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
</style>
