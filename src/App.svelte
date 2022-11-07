<script lang="ts">
    import { SvelteToast } from "@zerodevx/svelte-toast"
    import { logEvent } from "firebase/analytics"

    import Auth from "./auth/Auth.svelte"
    import Editor from "./editor/Editor.svelte"
    import { currentUserData } from "./firebase/auth"
</script>

<SvelteToast options={{ reversed: true, intro: { y: 192 } }} />

{#if typeof $currentUserData != "string"}
    <Editor />
    <Auth loadedUserData={$currentUserData} />
{:else}
    <h1><pre>loading</pre></h1>
{/if}
