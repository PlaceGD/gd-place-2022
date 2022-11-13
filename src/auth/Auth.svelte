<script lang="ts">
    import { Swiper, SwiperSlide } from "swiper/svelte"
    import type { Swiper as SwiperType } from "swiper"
    import { toast } from "@zerodevx/svelte-toast"
    import {
        browserLocalPersistence,
        setPersistence,
        signInWithEmailLink,
        type User,
    } from "firebase/auth"
    import { get, ref } from "firebase/database"

    import { toastErrorTheme, toastSuccessTheme } from "../const"
    import {
        type UserData,
        canEdit,
        signOut,
        signInGoogle,
        initUserData,
        signInGithub,
        currentUserData,
        type UserProperties,
        signInEmailLink,
        signInTwitter,
    } from "../firebase/auth"

    import { auth, database } from "../firebase/init"

    import "swiper/css"
    import "./auth.css"

    export let loadedUserData: UserData | null
    let userProperties: UserProperties | null = null

    let swiper: SwiperType
    let swiperSlides
    let loginPopupVisible = false

    let showLoader = false

    const swiperPages = {
        0: {
            show: () => loadedUserData == null,
        },
        1: {
            show: () =>
                loadedUserData &&
                (typeof loadedUserData.data === "string" ||
                    loadedUserData.data === null),
        },
    }

    // so jank but cant store elements in an array cause no jsx :(
    const updateSlides = (firstLoad: boolean = false) => {
        let slides = swiper.wrapperEl

        swiperSlides.forEach((slide, i) => {
            if (firstLoad) {
                swiperPages[i].el = slide
            }
            if (!swiperPages[i].show()) {
                // only wanna make the slides invisible when first loading since if they disappear the nice
                // slide transition wont play
                if (firstLoad) {
                    slide.classList.remove("swiper-slide")
                    slide.style.display = "none"
                } else {
                    if (slides.contains(slide)) {
                        slides.removeChild(slide)
                    }
                }
            } else {
                // if we dont skip on first call all the visible slides would be duplicated
                // since they wouldnt have been removed from the array yet
                if (!firstLoad) {
                    slide.classList.add("swiper-slide")
                    slide.style.display = "flex"

                    if (slides.contains(slide)) {
                        slides.removeChild(slide)
                    }
                    slides.appendChild(slide)
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
        showLoader = false

        if (swiper.slides.length === 0) {
            setPersistence(auth, browserLocalPersistence)
            loginPopupVisible = false
        } else {
            swiper.slideNext()
        }
    }

    const logInSuccess = (user) => {
        console.log(user)
        console.log(loadedUserData)
        get(ref(database, `userData/${user.user.uid}`))
            .then((snapshot) => {
                userProperties = snapshot.val()

                toast.push("Signed in successfully!", toastSuccessTheme)

                updateSlides()
                slideNextOrFinish()
            })
            .catch((err) => {
                console.error(err)
            })
    }
    const logInFailed = (err) => {
        console.error(err)

        toast.push("Failed to login!", toastErrorTheme)

        enableCurrentSlide()
    }

    const loginButtons = [
        {
            image: "google.svg",
            name: "Google",
            cb: async () => {
                disableCurrentSlide()
                signInGoogle().then(logInSuccess).catch(logInFailed)
            },
        },
        {
            image: "github.svg",
            name: "GitHub",
            cb: () => {
                disableCurrentSlide()
                signInGithub().then(logInSuccess).catch(logInFailed)
            },
        },
        {
            image: "twitter.svg",
            name: "Twitter",
            cb: () => {
                disableCurrentSlide()
                signInTwitter().then(logInSuccess).catch(logInFailed)
            },
        },
    ]

    let usernameInput = ""
    $: validUsername = usernameInput.match(/^[A-Za-z0-9_-]{3,16}$/)

    let emailInput = window.localStorage.getItem("emailForSignIn") || ""
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
                alt="sign in button"
            />
        </button>
    {:else}
        <button
            class="log_in_out_button invis_button wiggle_button"
            on:click={() => {
                if (confirm("Are you sure you want to sign out?")) {
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
                }
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
                    <div class="loading_container blur_bg">
                        <div class="loading">
                            <img
                                src="/loadinganimcss.svg"
                                alt="Loading icon"
                                class="loading_icon"
                            />
                        </div>
                    </div>
                {/if}
                <Swiper
                    slidesPerView={1}
                    centeredSlides={true}
                    allowTouchMove={false}
                    style="width: 100%; height: 100%;"
                    effect="fade"
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
                            <div class="login_popup_title">
                                Sign in/Register
                            </div>
                            <div class="login_popup_text">
                                Sign in/register with one of the following
                                services. After signing in, you will be able to
                                make a username.
                                <b>
                                    We will not be able to access any of your
                                    data
                                </b>, this is just for authentication.
                            </div>
                            <div class="login_popup_icons">
                                {#each loginButtons as button}
                                    <button
                                        class="login_method_button invis_button"
                                        on:click={button.cb}
                                    >
                                        <img
                                            draggable="false"
                                            src="/login/{button.image}"
                                            alt="{button.name} sign in provider"
                                        />
                                        Sign in with {button.name}
                                    </button>
                                {/each}
                            </div>

                            <div class="email_password_login">
                                <div class="email_password_header">
                                    Or Sign in/Register with Email
                                </div>
                                <input
                                    class="email_password_input"
                                    type="email"
                                    placeholder="Email"
                                    bind:value={emailInput}
                                />
                                <div class="login_register">
                                    <button
                                        class="email_password_login_button"
                                        on:click={() => {
                                            signInEmailLink(emailInput)
                                                .then((user) => {
                                                    const onStorage = (
                                                        event
                                                    ) => {
                                                        if (
                                                            event.key ==
                                                            "emailCode"
                                                        ) {
                                                            window.removeEventListener(
                                                                "storage",
                                                                onStorage
                                                            )

                                                            const href =
                                                                localStorage.getItem(
                                                                    "emailCode"
                                                                )

                                                            signInWithEmailLink(
                                                                auth,
                                                                emailInput,
                                                                href
                                                            )
                                                                .then(
                                                                    (
                                                                        result
                                                                    ) => {
                                                                        let userDataValue =
                                                                            {
                                                                                user: result.user,
                                                                                data: null,
                                                                            }
                                                                        currentUserData.set(
                                                                            userDataValue
                                                                        )

                                                                        localStorage.setItem(
                                                                            "loginSuccess",
                                                                            "You are now logged in!"
                                                                        )
                                                                        window.dispatchEvent(
                                                                            new Event(
                                                                                "storage"
                                                                            )
                                                                        )

                                                                        logInSuccess(
                                                                            userDataValue
                                                                        )
                                                                    }
                                                                )
                                                                .catch(
                                                                    (err) => {
                                                                        console.error(
                                                                            err
                                                                        )
                                                                        toast.push(
                                                                            `Failed to send email! (${err.message})`,
                                                                            toastErrorTheme
                                                                        )

                                                                        localStorage.setItem(
                                                                            "loginSuccess",
                                                                            `Failed to log in! (${err.message})`
                                                                        )
                                                                        window.dispatchEvent(
                                                                            new Event(
                                                                                "storage"
                                                                            )
                                                                        )
                                                                    }
                                                                )
                                                        }
                                                    }

                                                    window.addEventListener(
                                                        "storage",
                                                        onStorage
                                                    )

                                                    toast.push(
                                                        "Email sent!",
                                                        toastSuccessTheme
                                                    )
                                                })
                                                .catch((err) => {
                                                    console.error(err)

                                                    toast.push(
                                                        "Failed to send email!",
                                                        toastErrorTheme
                                                    )
                                                })
                                        }}
                                    >
                                        Send me a verification email
                                    </button>
                                </div>
                            </div>
                        </div></SwiperSlide
                    >

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
                                    Enter username: <input
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
                                                .then((user) => {
                                                    userProperties = user.data

                                                    updateSlides()
                                                    slideNextOrFinish()
                                                })
                                                .catch((err) => {
                                                    console.log(err)
                                                    toast.push(
                                                        "Username already taken!",
                                                        toastErrorTheme
                                                    )
                                                    enableCurrentSlide()
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
        margin-right: calc(14px + 75px + 5px);
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

        align-items: center;
        overflow-y: auto;
    }

    .email_password_login {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        height: fit-content;
        justify-content: center;
    }

    .login_register {
        display: flex;
        flex-direction: row;
        align-items: center;
        margin-top: 0px;
        width: 100%;
        height: 100%;
        justify-content: center;
        margin: 10px;
        column-gap: 10px;
    }

    .email_password_login_button {
        width: 60%;
        border-radius: 8px;
        background-color: #0b0b0e;
        border: 2px solid #bbbbbb;
        color: white;
        font-family: Cabin;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.1s;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 15px;
        transition: 1s;
    }
    .email_password_login_button:hover {
        box-shadow: rgba(76, 255, 40, 0.185) 0px 0px 5px 5px;
        transition: 0.2s;
    }
    .email_password_input {
        border-radius: 8px;
        background-color: #00000000;
        border: 2px solid #bbbbbb;
        color: white;
        font-family: Helvetica, sans-serif;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.1s;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 15px;
        margin: 5px;
        width: 60%;
    }

    .login_popup_title {
        font-family: "Cabin", sans-serif;
        font-size: var(--font-large);
        color: white;
        margin-bottom: 32px;
        margin-top: 16px;
        text-align: center;
    }

    .email_password_header {
        font-family: "Cabin", sans-serif;
        font-size: var(--font-medium);
        color: rgba(255, 255, 255, 0.75);
        margin-bottom: 24px;
        margin-top: 24px;
        text-align: center;
    }

    .login_popup_text {
        font-family: "Cabin", sans-serif;
        font-size: 16px;
        width: 80%;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 12px;
        text-align: center;
        float: top;
    }

    .login_popup_icons {
        width: 100%;
        height: fit-content;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        padding: 8px;
        gap: 20px;
        margin-top: 5vh;
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
        padding: 5px;
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
        margin-right: calc(100px + 75px + 5px);
        font-family: Pusab;
        font-size: var(--font-medium);
        color: white;
        text-align: right;
        text-shadow: 0 2px 6px #000d;
        -webkit-text-stroke: 1px black;
    }

    .loading_container {
        font-family: Cabin;
        color: white;
        position: absolute;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        gap: 20px;
        z-index: 10;
        border-radius: 16px;
        font-style: italic;
    }

    .loading {
        width: 50%;
    }

    .loading_icon {
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

    .blur_bg {
        background-color: #01010199;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
    }
</style>
