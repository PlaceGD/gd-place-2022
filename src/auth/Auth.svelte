<script lang="ts">
    import { toast } from "@zerodevx/svelte-toast"
    import { logEvent } from "firebase/analytics"

    import {
        canEdit,
        initUserData,
        signInGD,
        signInGithub,
        signInGoogle,
        signInTwitter,
        signOut,
        type UserData,
    } from "../firebase/auth"
    import { toastErrorTheme, toastSuccessTheme } from "../const"
    import { sendMessage, verifyCode } from "../firebase/init"

    export let loadedUserData: UserData | null

    const logInSuccess = () => {
        loginPopupVisible = false
        buttonsDisabled = false

        toast.push("Login Successful!", toastSuccessTheme)
    }
    const logInFailed = (err) => {
        console.error(err)
        buttonsDisabled = false

        toast.push("Failed to login!", toastErrorTheme)
    }

    const loginButtons = [
        {
            image: "google.svg",
            name: "Google",
            cb: () => {
                buttonsDisabled = true
                signInGoogle().then(logInSuccess).catch(logInFailed)
            },
        },
        {
            image: "github.svg",
            name: "GitHub",
            cb: () => {
                buttonsDisabled = true
                signInGithub().then(logInSuccess).catch(logInFailed)
            },
        },
        {
            disabled: true,
            image: "twitter.svg",
            name: "Twitter",
            cb: () => {
                signInTwitter().then(logInSuccess).catch(logInFailed)
            },
        },
        {
            disabled: true,
            image: "gd.png",
            name: "GD",
            cb: () => {
                gdUsernamePopupVisible = true
                loginPopupVisible = false
            },
        },
    ]

    let loginPopupVisible = false

    let gdUsernamePopupVisible = false
    let gdCodePopupVisible = false

    let buttonsDisabled = false

    let uid

    let usernameInput = ""
    $: validUsername = usernameInput.match(/^[A-Za-z0-9_-]{3,16}$/)

    let gdUsername = ""
    $: validGdUsername = gdUsername.match(/^[A-Za-z0-9 ]{3,15}$/)

    let gdCode = ""
    $: validGdCode = gdCode.match(/^[0-9]{6}$/)
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

    {#if loginPopupVisible && loadedUserData == null}
        <div class="login_popup_container">
            <button
                class="back_button invis_button wiggle_button blur_bg"
                on:click={() => {
                    loginPopupVisible = false
                }}
            >
                <img draggable="false" src="login/back.svg" alt="back arrow" />
            </button>
            <div class="login_popup blur_bg">
                <div class="login_popup_title">Login/Register</div>
                <div class="login_text">
                    Login/register with one of the following services (Twitter
                    and Geometry Dash will be implemented at a later time).
                    After logging in, you will be able to make a username. We
                    will not be able to access any of your data, this is just
                    for authentication.
                </div>
                <div class="login_popup_icons">
                    {#each loginButtons as button}
                        <button
                            disabled={buttonsDisabled || button?.disabled}
                            class="login_method_button invis_button"
                            on:click={button.cb}
                        >
                            <img
                                draggable="false"
                                src="login/{button.image}"
                                alt="login provider"
                            />
                            Login with {button.name}
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    {/if}

    {#if loadedUserData != null && !$canEdit}
        <div class="login_popup_container">
            {#if typeof loadedUserData.data != "string"}
                <div class="username_form">
                    Create your username: <input
                        bind:value={usernameInput}
                        class="username_input"
                        type="text"
                    />
                    <button
                        disabled={!validUsername}
                        style:opacity={validUsername ? "1" : "0.25"}
                        class="checkmark_button invis_button wiggle_button"
                        on:click={() => {
                            initUserData(loadedUserData.user.uid, usernameInput)
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
        </div>
    {/if}

    {#if gdUsernamePopupVisible && !gdCodePopupVisible}
        <div class="login_popup_container">
            <button
                class="back_button invis_button wiggle_button blur_bg"
                on:click={() => {
                    loginPopupVisible = true
                    gdUsernamePopupVisible = false
                    buttonsDisabled = false
                }}
            >
                <img draggable="false" src="login/back.svg" alt="back arrow" />
            </button>

            <div class="username_form">
                Enter your Geometry Dash username: <input
                    bind:value={gdUsername}
                    class="username_input"
                    type="text"
                />
                <button
                    disabled={!validGdUsername || buttonsDisabled}
                    style:opacity={validGdUsername && !buttonsDisabled
                        ? "1"
                        : "0.25"}
                    class="checkmark_button invis_button wiggle_button"
                    on:click={() => {
                        buttonsDisabled = true

                        sendMessage({ username: gdUsername })
                            .then((r) => {
                                uid = r.data

                                gdCodePopupVisible = true
                                gdUsernamePopupVisible = false
                                buttonsDisabled = false
                            })
                            .catch((e) => {
                                console.error(e)
                                toast.push(
                                    `Error sending verification code! (${e.message})`,
                                    toastErrorTheme
                                )

                                buttonsDisabled = false
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

    {#if gdCodePopupVisible && !gdUsernamePopupVisible}
        <div class="login_popup_container">
            <button
                class="back_button invis_button wiggle_button blur_bg"
                on:click={() => {
                    loginPopupVisible = false
                    gdCodePopupVisible = false
                    buttonsDisabled = false
                    loginPopupVisible = true
                }}
            >
                <img draggable="false" src="login/back.svg" alt="back arrow" />
            </button>

            <div class="username_form">
                Enter the verification code: <input
                    bind:value={gdCode}
                    class="username_input"
                    type="text"
                />
                <button
                    disabled={!validGdCode || buttonsDisabled}
                    style:opacity={validGdCode && !buttonsDisabled
                        ? "1"
                        : "0.25"}
                    class="checkmark_button invis_button wiggle_button"
                    on:click={() => {
                        buttonsDisabled = true

                        verifyCode({ uid, code: gdCode })
                            .then((t) => {
                                signInGD(t)
                                    .then(() => {
                                        gdCodePopupVisible = false
                                        gdUsernamePopupVisible = false
                                        buttonsDisabled = false
                                    })
                                    .catch((err) => {
                                        console.error(err)
                                        toast.push(
                                            `${err.message}`,
                                            toastErrorTheme
                                        )

                                        buttonsDisabled = false
                                    })
                            })
                            .catch((err) => {
                                console.error(err)
                                toast.push(`${err.message}`, toastErrorTheme)

                                buttonsDisabled = false
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
        z-index: 50;
    }
    .all * {
        pointer-events: auto;
    }
    .log_in_out_button {
        position: absolute;
        margin-top: 16px;
        margin-right: 14px;
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
    .log_in_out_button > img {
        width: 75px;
    }
    .login_popup_container {
        width: 100%;
        height: 100%;
        background-color: #0008;
        backdrop-filter: blur(32px);
        -webkit-backdrop-filter: blur(32px);
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .blur_bg {
        background-color: #1113;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
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
</style>
