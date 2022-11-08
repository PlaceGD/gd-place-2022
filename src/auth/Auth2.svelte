<script lang="ts">
    import { Swiper, SwiperSlide } from "swiper/svelte"

    import type { UserData } from "../firebase/auth"

    import "swiper/css"
    import "./auth.css"

    export let loadedUserData: UserData | null

    let swiper
    let loginPopupVisible = false
</script>

<div class="all">
    {#if loadedUserData == null}
        <button
            class="log_in_out_button invis_button wiggle_button"
            on:click={() => {
                loginPopupVisible = true
            }}
        >
            <img
                draggable="false"
                src="login/profile_in.png"
                alt="login button"
            />
        </button>
    {:else}
        <button
            class="log_in_out_button invis_button wiggle_button"
            on:click={() => {
                // signOut()
                //     .then(() => {
                //         toast.push(
                //             "Successfully logged out!",
                //             toastSuccessTheme
                //         )
                //     })
                //     .catch((err) => {
                //         console.error(err)
                //         toast.push("Failed to log out!", toastErrorTheme)
                //     })
            }}
        >
            <img
                draggable="false"
                src="login/profile_out.png"
                alt="logout button"
            />
        </button>
        {#if loadedUserData.data != null && typeof loadedUserData.data != "string"}
            <div class="username_display">{loadedUserData.data.username}</div>
        {/if}
    {/if}

    {#if loginPopupVisible}
        <div class="login_popup_container">
            <div class="login_swiper_container">
                <Swiper
                    slidesPerView={1}
                    centeredSlides={true}
                    allowTouchMove={false}
                    style="width: 100%; height: 100%;"
                    on:swiper={(e) => (swiper = e.detail[0])}
                >
                    <SwiperSlide class="login_swiper_slide" />
                    <SwiperSlide class="login_swiper_slide">Slide 2</SwiperSlide
                    >
                    <SwiperSlide class="login_swiper_slide">Slide 3</SwiperSlide
                    >
                </Swiper>
            </div>
        </div>
    {/if}
</div>

<style>
    .all {
        position: absolute;
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: flex-end;
        align-items: flex-start;
        z-index: 50;
        pointer-events: none;
    }
    .all * {
        pointer-events: auto;
    }

    .login_popup_container {
        position: relative;
        width: 100%;
        height: 100%;
        background-color: #0008;
        backdrop-filter: blur(32px);
        -webkit-backdrop-filter: blur(32px);
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .login_swiper_container {
        width: min(600px, 90%) !important;
        height: min(800px, 90%);
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
        background-color: #01010188;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
    }

    .log_in_out_button {
        position: absolute;
        margin-top: 16px;
        margin-right: 14px;
    }
    .log_in_out_button > img {
        width: 75px;
    }
</style>
