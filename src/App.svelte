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

        let email = window.localStorage.getItem("emailForSignIn")
        if (!email) {
            email = window.prompt("Please provide your email for confirmation")
        }
        signInWithEmailLink(auth, email, window.location.href)
            .then((result) => {
                window.localStorage.removeItem("emailForSignIn")

                emailSuccess =
                    "You are now signed in! You can safely close this tab."

                result.user.getIdToken(true)

                window.localStorage.setItem(
                    "emailUser",
                    JSON.stringify(result.user.toJSON())
                )

                window.dispatchEvent(new Event("storage"))
            })
            .catch((err) => {
                console.error(err)

                toast.push(
                    `Failed to send email! (${err.message})`,
                    toastErrorTheme
                )

                emailSuccess = `Failed to sign in:  ${err.message}`
            })
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
