<script lang="ts">
    import { SvelteToast, toast } from "@zerodevx/svelte-toast"

    import Auth from "./auth/Auth.svelte"
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
    <div
        style="display:flex;justify-content:center;align-items:center;font-size:var(--font-large);font-family:sans-serif;"
    >
        {emailSuccess}
    </div>
{:else if typeof $currentUserData != "string"}
    <Editor />
    <Auth loadedUserData={$currentUserData} />
{:else}
    <h1><pre>loading</pre></h1>
{/if}
