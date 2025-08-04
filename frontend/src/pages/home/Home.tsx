import "./Home.css"

function Home() {
    return (
        <>
            <div className={"navbar"}>
                <div className={"nav"}>
                    <button className={"nav-button-selected"}>about</button>
                    <button className={"nav-button"} onClick={() => window.location.href="/login"}>login</button>
                    <button className={"nav-button"} onClick={() => window.location.href="https://asterisk.lanth.me"}>devs</button>
                    <button className={"nav-button"} onClick={() => window.location.href="/faq"}>faq</button>
                </div>

                <div className={"nav-links"}>
                    <a href="/terms-of-service" className={"nav-link"}>terms of service</a>
                    <a href="/privacy-policy" className={"nav-link"}>privacy policy</a>
                </div>
            </div>

            <div className={"main"}>
                <div className={"hero"}>
                    <h1 className={"heading"}>Meet RAVEN.</h1>
                    <p className={"subheading"}>
                        Say goodbye to juggling multiple accounts and passwords with RAVEN,
                        managing your digital life has never been this simple — or this secure.
                    </p>
                </div>

                <button className={"primary-big"} onClick={() => window.location.href="/register"}>
                    <svg width="53" height="48" viewBox="0 0 53 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16.4103 36.0793L13.2722 33.1827C12.409 32.3859 12.1043 31.2328 12.4902 30.1642C12.7949 29.3298 13.2011 28.2424 13.6886 26.9957H2.94382C2.07043 26.9957 1.25797 26.5644 0.821273 25.8614C0.384577 25.1583 0.394733 24.2959 0.841585 23.6022L6.17334 15.3059C7.49358 13.2529 9.88018 11.9968 12.4597 11.9968H20.8179C21.0616 11.6218 21.3054 11.275 21.5491 10.9375C29.8666 -0.386636 42.2566 -0.761607 49.65 0.494547C50.828 0.691407 51.7421 1.54447 51.9655 2.63188C53.3264 9.46574 52.91 20.893 40.652 28.5705C40.2966 28.7955 39.9106 29.0205 39.5044 29.2455V36.9605C39.5044 39.3416 38.1436 41.5539 35.9194 42.7632L26.9316 47.6847C26.1801 48.0972 25.2458 48.1065 24.4841 47.7034C23.7224 47.3004 23.2553 46.5598 23.2553 45.7442V35.695C21.8233 36.1543 20.5742 36.5293 19.6297 36.8105C18.4922 37.148 17.2532 36.8574 16.4002 36.0793H16.4103ZM39.5044 15.7465C40.5818 15.7465 41.6151 15.3514 42.3769 14.6482C43.1387 13.945 43.5667 12.9913 43.5667 11.9968C43.5667 11.0023 43.1387 10.0486 42.3769 9.34535C41.6151 8.64214 40.5818 8.24708 39.5044 8.24708C38.427 8.24708 37.3938 8.64214 36.6319 9.34535C35.8701 10.0486 35.4421 11.0023 35.4421 11.9968C35.4421 12.9913 35.8701 13.945 36.6319 14.6482C37.3938 15.3514 38.427 15.7465 39.5044 15.7465Z" fill="#D8D7D7"/>
                    </svg> <p>Get Started</p>
                </button>
            </div>

            <div className={"home-effects"}>
                <svg className={"home1"} width="53" height="48" viewBox="0 0 53 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.4103 36.0793L13.2722 33.1827C12.409 32.3859 12.1043 31.2328 12.4902 30.1642C12.7949 29.3298 13.2011 28.2424 13.6886 26.9957H2.94382C2.07043 26.9957 1.25797 26.5644 0.821273 25.8614C0.384577 25.1583 0.394733 24.2959 0.841585 23.6022L6.17334 15.3059C7.49358 13.2529 9.88018 11.9968 12.4597 11.9968H20.8179C21.0616 11.6218 21.3054 11.275 21.5491 10.9375C29.8666 -0.386636 42.2566 -0.761607 49.65 0.494547C50.828 0.691407 51.7421 1.54447 51.9655 2.63188C53.3264 9.46574 52.91 20.893 40.652 28.5705C40.2966 28.7955 39.9106 29.0205 39.5044 29.2455V36.9605C39.5044 39.3416 38.1436 41.5539 35.9194 42.7632L26.9316 47.6847C26.1801 48.0972 25.2458 48.1065 24.4841 47.7034C23.7224 47.3004 23.2553 46.5598 23.2553 45.7442V35.695C21.8233 36.1543 20.5742 36.5293 19.6297 36.8105C18.4922 37.148 17.2532 36.8574 16.4002 36.0793H16.4103ZM39.5044 15.7465C40.5818 15.7465 41.6151 15.3514 42.3769 14.6482C43.1387 13.945 43.5667 12.9913 43.5667 11.9968C43.5667 11.0023 43.1387 10.0486 42.3769 9.34535C41.6151 8.64214 40.5818 8.24708 39.5044 8.24708C38.427 8.24708 37.3938 8.64214 36.6319 9.34535C35.8701 10.0486 35.4421 11.0023 35.4421 11.9968C35.4421 12.9913 35.8701 13.945 36.6319 14.6482C37.3938 15.3514 38.427 15.7465 39.5044 15.7465Z" fill="#D8D7D7"/>
                </svg>
                <svg className={"home2"} width="520" height="124" viewBox="0 0 520 124" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="260" cy="79" rx="260" ry="79" fill="#8A7B8A"/>
                </svg>
                <svg className={"home3"} width="335" height="228" viewBox="0 0 335 228" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="167.5" cy="114" rx="167.5" ry="114" fill="#8A7B8A"/>
                </svg>
                <svg className={"home4"} width="219" height="171" viewBox="0 0 219 171" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="109.5" cy="85.5" rx="109.5" ry="85.5" fill="#8A7B8A"/>
                </svg>
                <svg className={"home5"} width="557" height="355" viewBox="0 0 557 355" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="278.5" cy="177.5" rx="278.5" ry="177.5" fill="#8A7B8A"/>
                </svg>
                <svg className={"home6"} width="368" height="448" viewBox="0 0 368 448" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="222" cy="224" rx="222" ry="224" fill="#8A7B8A"/>
                </svg>
            </div>
        </>
    )
}

export default Home