<script lang="ts">
    import { Swiper, SwiperSlide } from "swiper/svelte"
    import type { Swiper as SwiperType } from "swiper"
    import { toast } from "@zerodevx/svelte-toast"

    import { toastErrorTheme, toastSuccessTheme } from "../const"
    import {
        type UserData,
        canEdit,
        signOut,
        signInGoogle,
        initUserData,
        signInGithub,
        currentUserData,
    } from "../firebase/auth"

    import "swiper/css"
    import "./auth.css"
    import type { User } from "firebase/auth"

    export let loadedUserData: UserData | null

    let swiper: SwiperType
    let swiperSlides
    let loginPopupVisible = false

    let showLoader = false

    const swiperPages = {
        0: {
            insertAt: () => 0,
            show: () => loadedUserData == null,
        },
        1: {
            insertAt: () => swiper.activeIndex + 1,
            show: () => {
                console.log(loadedUserData, $canEdit)

                return (
                    loadedUserData != null && !$canEdit && !loadedUserData.data
                )
            },
        },
    }

    // so jank but cant store elements in an array cause no jsx :(
    const updateSlides = (firstLoad: boolean = false) => {
        let slides = swiper.wrapperEl

        swiperSlides.forEach((slide, i) => {
            if (!swiperPages[i].show()) {
                // only wanna make the slides invisible when first loading since if they disappear the nice
                // slide transition wont play
                if (firstLoad) {
                    slide.classList.remove("swiper-slide")
                    slide.style.display = "none"
                }
            } else {
                // if we dont skip on first call all the visible slides would be duplicated
                // since they wouldnt have been removed from the array yet
                if (!firstLoad) {
                    slide.classList.add("swiper-slide")
                    slide.style.display = "flex"

                    slides.insertBefore(
                        slide,
                        slides.children[swiperPages[i].insertAt()]
                    )
                }
            }
        })

        swiper.update()
    }
    const disableCurrentSlide = () => {
        swiper.slides[swiper.activeIndex].classList.add("disabled_slide")
        showLoader = true
    }
    const enableCurrentSlide = () => {
        swiper.slides[swiper.activeIndex].classList.remove("disabled_slide")
        showLoader = false
    }
    const slideNextOrFinish = () => {
        if (swiper.isEnd) {
            loginPopupVisible = false
            showLoader = false
        } else {
            swiper.slideNext()
        }
    }

    const logInSuccess = () => {
        toast.push("Login successful!", toastSuccessTheme)
    }
    const logInFailed = (err) => {
        console.error(err)

        toast.push("Failed to login!", toastErrorTheme)

        enableCurrentSlide()
    }

    let unsub

    const loginButtons = [
        {
            image: "google.svg",
            name: "Google",
            cb: () => {
                disableCurrentSlide()
                signInGoogle().then(logInSuccess).catch(logInFailed)
                unsub = currentUserData.subscribe((user) => {
                    if (user && typeof user != "string" && user.data) {
                        unsub()
                        updateSlides()
                        slideNextOrFinish()
                    }
                })
            },
        },
        {
            image: "github.svg",
            name: "GitHub",
            cb: () => {
                disableCurrentSlide()
                signInGithub().then(logInSuccess).catch(logInFailed)
                unsub = currentUserData.subscribe((user) => {
                    if (user && typeof user != "string" && user.data) {
                        unsub()
                        updateSlides()
                        slideNextOrFinish()
                    }
                })
            },
        },
        {
            disabled: true,
            image: "twitter.svg",
            name: "Twitter",
            cb: () => {
                //signInTwitter().then(logInSuccess).catch(logInFailed)
            },
        },
        {
            disabled: true,
            image: "gd.png",
            name: "GD",
            cb: () => {},
        },
    ]

    let usernameInput = ""
    $: validUsername = usernameInput.match(/^[A-Za-z0-9_-]{3,16}$/)
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
                src="/login/profile_in.png"
                alt="login button"
            />
        </button>
    {:else}
        <button
            class="log_in_out_button invis_button wiggle_button"
            on:click={() => {
                signOut()
                    .then(() => {
                        toast.push(
                            "Successfully logged out!",
                            toastSuccessTheme
                        )
                    })
                    .catch((err) => {
                        console.error(err)
                        toast.push("Failed to log out!", toastErrorTheme)
                    })
            }}
        >
            <img
                draggable="false"
                src="/login/profile_out.png"
                alt="logout button"
            />
        </button>
        {#if loadedUserData.data != null && typeof loadedUserData.data != "string"}
            <div class="username_display">{loadedUserData.data.username}</div>
        {/if}
    {/if}

    {#if loginPopupVisible}
        <div class="login_popup_container">
            {#if loadedUserData == null}
                <button
                    class="back_button invis_button wiggle_button blur_bg"
                    on:click={async () => {
                        loginPopupVisible = false
                    }}
                >
                    <img
                        draggable="false"
                        src="login/back.svg"
                        alt="back arrow"
                    />
                </button>
            {/if}

            <div class="login_swiper_container">
                {#if showLoader}
                    <div
                        style="font-family: Cabin; color: white; position: absolute;"
                    >
                        LOADING...
                    </div>
                {/if}
                <Swiper
                    slidesPerView={1}
                    centeredSlides={true}
                    allowTouchMove={false}
                    style="width: 100%; height: 100%;"
                    on:swiper={(e) => {
                        swiper = e.detail[0]

                        swiperSlides = swiper.slides
                        updateSlides(true)
                    }}
                    on:slideChangeTransitionStart={() => {
                        showLoader = false
                    }}
                >
                    <SwiperSlide class="login_swiper_slide">
                        <div class="login_popup">
                            <div class="login_popup_title">Login/Register</div>
                            <div class="login_popup_text">
                                Login/register with one of the following
                                services (Twitter and Geometry Dash will be
                                implemented at a later time). After logging in,
                                you will be able to make a username. We will not
                                be able to access any of your data, this is just
                                for authentication.
                            </div>
                            <div class="login_popup_icons">
                                {#each loginButtons as button}
                                    <button
                                        disabled={button?.disabled}
                                        class="login_method_button invis_button"
                                        on:click={button.cb}
                                    >
                                        <img
                                            draggable="false"
                                            src="/login/{button.image}"
                                            alt="{button.name} login provider"
                                        />
                                        Login with {button.name}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    </SwiperSlide>

                    <SwiperSlide class="login_swiper_slide">
                        {#if loadedUserData !== null && typeof loadedUserData.data != "string"}
                            <div class="login_popup">
                                <div class="login_popup_title">
                                    Create Username
                                </div>
                                <div class="login_popup_text">
                                    This will be your username other users will
                                    see. It can only contain alphanumeric
                                    characters, be of length 3 to 16 characters,
                                    and must be unique.
                                </div>

                                <div class="username_form">
                                    Create your username: <input
                                        bind:value={usernameInput}
                                        class="username_input"
                                        type="text"
                                    />
                                    <button
                                        disabled={!validUsername}
                                        style:opacity={validUsername
                                            ? "1"
                                            : "0.25"}
                                        class="checkmark_button invis_button wiggle_button"
                                        on:click={() => {
                                            disableCurrentSlide()

                                            initUserData(
                                                loadedUserData.user.uid,
                                                usernameInput
                                            )
                                                .then(() => {
                                                    loginPopupVisible = false
                                                })
                                                .catch((err) => {
                                                    console.log(err)
                                                    toast.push(
                                                        "Username already taken!",
                                                        toastErrorTheme
                                                    )
                                                })
                                        }}
                                    >
                                        <img
                                            draggable="false"
                                            src="login/check.png"
                                            alt="checkmark"
                                            width="50px"
                                        />
                                    </button>
                                </div>
                            </div>
                        {/if}
                    </SwiperSlide>
                    <!-- {#if loadedUserData == null}
                        <SwiperSlide class="login_swiper_slide">
                            <div class="login_popup">
                                <div class="login_popup_title">
                                    Login/Register
                                </div>
                                <div class="login_text">
                                    Login/register with one of the following
                                    services (Twitter and Geometry Dash will be
                                    implemented at a later time). After logging
                                    in, you will be able to make a username. We
                                    will not be able to access any of your data,
                                    this is just for authentication.
                                </div>
                                <div class="login_popup_icons">
                                    {#each loginButtons as button}
                                        <button
                                            disabled={button?.disabled}
                                            class="login_method_button invis_button"
                                            on:click={button.cb}
                                        >
                                            <img
                                                draggable="false"
                                                src="login/{button.image}"
                                                alt="{button.name} login provider"
                                            />
                                            Login with {button.name}
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        </SwiperSlide>
                    {/if}

                    {#if !loginWithGd && loadedUserData != null && !$canEdit}
                        <SwiperSlide class="login_swiper_slide">
                            {#if typeof loadedUserData.data != "string"}
                                <div class="username_form">
                                    Create your username: <input
                                        bind:value={usernameInput}
                                        class="username_input"
                                        type="text"
                                    />
                                    <button
                                        disabled={!validUsername}
                                        style:opacity={validUsername
                                            ? "1"
                                            : "0.25"}
                                        class="checkmark_button invis_button wiggle_button"
                                        on:click={() => {
                                            // initUserData(
                                            //     loadedUserData.user.uid,
                                            //     usernameInput
                                            // )
                                        }}
                                    >
                                        <img
                                            draggable="false"
                                            src="login/check.png"
                                            alt="checkmark"
                                            width="50px"
                                        />
                                    </button>
                                </div>
                            {/if}
                        </SwiperSlide>
                    {/if} -->
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

    .back_button {
        position: absolute;
        top: 8px;
        left: 8px;
        width: 70px;
        height: 50px;
        color: white;
        border-radius: 8px;
        font-family: Cabin;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.1s;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1;
    }

    .login_popup_container {
        position: relative;
        width: 100%;
        height: 100%;
        background-color: #0009;
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
        background-color: #01010199;
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

    .login_popup {
        position: absolute;
        width: min(600px, 90%);
        height: min(800px, 90%);
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .login_popup_title {
        font-family: "Cabin", sans-serif;
        font-size: var(--font-large);
        color: white;
        margin-bottom: 32px;
        margin-top: 16px;
        text-align: center;
    }

    .login_popup_text {
        font-family: "Cabin", sans-serif;
        font-size: 16px;
        width: 80%;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 12px;
        text-align: center;
    }

    .login_popup_icons {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-rows: 1fr 1fr;
        grid-template-columns: 1fr 1fr;
        padding: 8px;
        gap: 8px;
    }

    .login_method_button > * {
        width: 60px;
        height: 60px;
        object-fit: contain;
    }
    .login_method_button {
        background-color: transparent;
        border-radius: 8px;
        transition: all 0.1s;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        color: white;
        font-family: Cabin;
        font-size: 16px;
        gap: 16px;
    }
    .login_method_button:enabled {
        cursor: pointer;
    }
    .login_method_button:enabled:hover {
        background-color: #fff2;
    }
    .login_method_button:disabled {
        opacity: 0.25;
    }

    .username_form {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        text-align: center;
        justify-content: center;
        align-items: center;
        font-family: Pusab;
        font-size: 32px;
        color: white;
        gap: 16px;
    }
    .username_input {
        width: 300px;
        height: 60px;
        outline: none;
        border: 2px solid white;
        background-color: #1113;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: 8px;
        font-family: Pusab;
        font-size: 24px;
        color: white;
        text-align: center;
    }

    .username_display {
        position: absolute;
        margin-top: 32px;
        margin-right: 100px;
        font-family: Pusab;
        font-size: 32px;
        color: white;
        text-align: right;
        text-shadow: 0 2px 6px #000d;
        -webkit-text-stroke: 1px black;
    }

    .blur_bg {
        background-color: #01010199;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
    }
</style>
