<script lang="ts">
    import { Swiper, SwiperSlide } from "swiper/svelte"
    import { toast } from "@zerodevx/svelte-toast"

    import { toastErrorTheme, toastSuccessTheme } from "../const"
    import {
        type UserData,
        canEdit,
        signOut,
        signInGoogle,
    } from "../firebase/auth"

    import "swiper/css"
    import "./auth.css"

    export let loadedUserData: UserData | null

    let swiper
    let swiperSlides
    let loginPopupVisible = false

    let loginWithGd = false

    // let test = false

    // const swiperPages = {
    //     0: {
    //         insertAt: () => 0,
    //         //show: (swiper) => swiper.activeIndex == 0 && loadedUserData == null,
    //         show: () => true,
    //     },
    //     1: {
    //         insertAt: () => swiper.activeIndex + 1,
    //         //show: (swiper) => swiper.activeIndex == 1 && loadedUserData != null, // && !$canEdit,
    //         show: () => test,
    //     },
    //     2: {
    //         insertAt: () => swiper.activeIndex + 2,
    //         show: () => test,
    //     },
    //     // 3: {
    //     //     insertAt: () => swiper.activeIndex + 3,
    //     //     //show: (swiper) => swiper.activeIndex == 1 && loadedUserData != null, // && !$canEdit,
    //     //     show: () => false,
    //     // },
    //     // 4: {
    //     //     insertAt: () => swiper.activeIndex + 2,
    //     //     //show: (swiper) => swiper.activeI ndex == 1 && loadedUserData != null, // && !$canEdit,
    //     //     show: () => false,
    //     // },
    // }

    // const updateSlides = (firstLoad: boolean = false) => {
    //     swiperSlides.forEach((slide, i) => {
    //         if (!swiperPages[i].show()) {
    //             slide.classList.remove("swiper-slide")
    //             slide.style.display = "none"
    //         } else {
    //             slide.classList.add("swiper-slide")
    //             slide.style.display = "flex"

    //             if (!firstLoad) {
    //                 // remove slide from old position
    //                 swiper.slides.splice(i, 1)

    //                 // insert slide at new position
    //                 swiper.slides.splice(swiperPages[i].insertAt(), 0, slide)

    //                 console.log(i)
    //             }
    //         }
    //     })

    //     swiper.update()
    // }

    const logInSuccess = () => {
        loginPopupVisible = false
        //buttonsDisabled = false

        toast.push("Login Successful!", toastSuccessTheme)
    }
    const logInFailed = (err) => {
        console.error(err)
        //buttonsDisabled = false

        toast.push("Failed to login!", toastErrorTheme)
    }

    const loginButtons = [
        {
            image: "google.svg",
            name: "Google",
            cb: () => {
                signInGoogle().then(logInSuccess).catch(logInFailed)
            },
        },
        {
            image: "github.svg",
            name: "GitHub",
            cb: () => {
                // signInGithub().then(logInSuccess).catch(logInFailed)
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
                src="login/profile_in.png"
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
            <button
                class="back_button invis_button wiggle_button blur_bg"
                on:click={async () => {
                    if (loadedUserData != null) {
                        signOut().then(() => {
                            loginPopupVisible = false
                        })
                    } else {
                        loginPopupVisible = false
                    }
                }}
            >
                <img draggable="false" src="login/back.svg" alt="back arrow" />
            </button>

            <div class="login_swiper_container">
                <Swiper
                    slidesPerView={1}
                    centeredSlides={true}
                    allowTouchMove={true}
                    style="width: 100%; height: 100%;"
                    on:swiper={(e) => {
                        // swiper = e.detail[0]
                        // console.log(swiper.slides)
                        // // swiper.slides.forEach((slide, i) => {
                        // //     swiperPages[i].el = slide
                        // //     swiper.slides.splice(i, 1)
                        // // })
                        // let x = swiper.slides[2]
                        // swiper.slides[2] = swiper.slides[1]
                        // swiper.slides[1] = x
                        // //swiper.slides.splice(0, swiper.slides.length)
                        // console.log(swiper.slides)
                        // swiper.update()
                        // // updateSlides(true)
                    }}
                >
                    {#if loadedUserData == null}
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
                    {/if}
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
    }

    .login_text {
        font-family: "Cabin", sans-serif;
        font-size: 16px;
        width: 80%;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 12px;
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

    .blur_bg {
        background-color: #01010199;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
    }
</style>
